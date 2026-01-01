// apps/pulse-api/src/routes/analytics.precheck.routes.js
const express = require("express");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const LabResult = require("../models/LabResult");
const CLINICAL = require("../config/clinical.thresholds");
const { apiOk, apiError } = require("../utils/response");

const router = express.Router();

/* ----------------------------
   Helpers (lightweight)
---------------------------- */
function normCode(x) {
  return String(x || "").trim().toUpperCase();
}

function normalizeTimeRange({ startDate, endDate } = {}) {
  const from = startDate ? dayjs(startDate) : null;
  const to = endDate ? dayjs(endDate) : null;
  return {
    from: from && from.isValid() ? from : null,
    to: to && to.isValid() ? to : null,
  };
}

function resolveClinicalConfig(testCode) {
  const tc = normCode(testCode);

  // direct
  if (CLINICAL?.[tc] && !CLINICAL[tc]?.aliasOf) return { tc, cfg: CLINICAL[tc] };

  // aliasOf
  if (CLINICAL?.[tc]?.aliasOf) {
    const base = normCode(CLINICAL[tc].aliasOf);
    if (CLINICAL?.[base]) return { tc: base, cfg: CLINICAL[base] };
  }

  // aliases array
  for (const [k, cfg] of Object.entries(CLINICAL || {})) {
    const aliases = (cfg?.aliases || []).map(normCode);
    if (aliases.includes(tc)) return { tc: k, cfg };
  }

  return { tc, cfg: null };
}

function getWeekKey(d) {
  const x = dayjs(d);
  const y = x.isoWeekYear();
  const w = String(x.isoWeek()).padStart(2, "0");
  return `${y}-W${w}`;
}

function weekKeyToStartDate(weekKey) {
  const m = String(weekKey || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const w = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(w)) return null;
  return dayjs().isoWeekYear(y).isoWeek(w).startOf("isoWeek"); // Monday
}

function fillMissingWeeksFromKeys(keysSorted) {
  if (!keysSorted.length) return [];
  const start = weekKeyToStartDate(keysSorted[0]);
  const end = weekKeyToStartDate(keysSorted[keysSorted.length - 1]);
  if (!start || !end) return keysSorted;

  const out = [];
  let cur = start.clone();
  const endIncl = end.clone();

  while (cur.isBefore(endIncl) || cur.isSame(endIncl, "day")) {
    out.push(getWeekKey(cur));
    cur = cur.add(1, "week");
  }
  return out;
}

/**
 * GET /api/analytics/precheck
 * Parameters:
 * - facilityId / regionId (optional)
 * - startDate / endDate (optional)
 * - testCode (optional, default HB)
 * - minWeeksCoverage (optional, default 52)
 */
router.get("/precheck", async (req, res) => {
  try {
    const {
      facilityId,
      regionId,
      startDate,
      endDate,
      testCode = "HB",
      minWeeksCoverage = "52",
    } = req.query;

    const { from, to } = normalizeTimeRange({ startDate, endDate });
    const tcReq = normCode(testCode);

    const { tc: baseTc, cfg: clinicalCfg } = resolveClinicalConfig(tcReq);
    const hasThresholds = !!clinicalCfg;

    // ===== match =====
    const match = {};

    if (facilityId) match.facilityId = String(facilityId).trim();
    if (regionId) match.regionId = String(regionId).trim();

    // date: prefer testDate then collectedAt
    const dateExpr = { $ifNull: ["$testDate", "$collectedAt"] };

    // require at least one date exists
    match.$or = [{ testDate: { $ne: null } }, { collectedAt: { $ne: null } }];

    // IMPORTANT:
    // - لا تقصّي السجلات إذا testCode مفقود (مثل سلوك run عندك)
    // - اقبل tcReq أو baseTc أو null/empty
    match.$and = match.$and || [];
    match.$and.push({
      $or: [
        { testCode: { $in: [tcReq, baseTc] } },
        { testCode: { $exists: false } },
        { testCode: null },
        { testCode: "" },
      ],
    });

    // date range filter via $expr
    const exprAnd = [];
    if (from) exprAnd.push({ $gte: [dateExpr, from.toDate()] });
    if (to) exprAnd.push({ $lte: [dateExpr, to.toDate()] });
    if (exprAnd.length) match.$expr = { $and: exprAnd };

    // ===== pipeline =====
    // بدل $isoWeek / $isoWeekYear (قد لا تكون مدعومة عند بعض النسخ)
    // نستخدم $dateToParts مع iso8601: true (أكثر توافقًا)
    const pipeline = [
      { $match: match },
      { $project: { dt: dateExpr } },

      // toParts gives isoWeekYear/isoWeek when iso8601=true
      {
        $project: {
          parts: { $dateToParts: { date: "$dt", iso8601: true } },
        },
      },
      {
        $group: {
          _id: { isoYear: "$parts.isoWeekYear", isoWeek: "$parts.isoWeek" },
          n: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          weekKey: {
            $concat: [
              { $toString: "$_id.isoYear" },
              "-W",
              {
                $cond: [
                  { $lt: ["$_id.isoWeek", 10] },
                  { $concat: ["0", { $toString: "$_id.isoWeek" }] },
                  { $toString: "$_id.isoWeek" },
                ],
              },
            ],
          },
          n: 1,
        },
      },
      { $sort: { weekKey: 1 } },
    ];

    const byWeek = await LabResult.aggregate(pipeline).allowDiskUse(true);

    const weeksRaw = byWeek.map((x) => x.weekKey);
    const allWeeks = fillMissingWeeksFromKeys(weeksRaw);
    const weeksCoverage = allWeeks.length;

    const overallN = byWeek.reduce((s, x) => s + (Number(x.n) || 0), 0);

    const perMethod = {
      ewma: { ok: overallN > 0 },
      cusum: { ok: overallN > 0 },
      farrington: { ok: false },
    };

    if (overallN <= 0) {
      perMethod.ewma = { ok: false, reason: "NO_DATA" };
      perMethod.cusum = { ok: false, reason: "NO_DATA" };
      perMethod.farrington = { ok: false, reason: "NO_DATA" };
    } else if (!hasThresholds) {
      perMethod.farrington = { ok: false, reason: "NO_THRESHOLDS" };
    } else {
      const minW = Number(minWeeksCoverage);
      if (!Number.isFinite(minW) || minW <= 0) {
        perMethod.farrington = { ok: true, weeksCoverage };
      } else if (weeksCoverage < minW) {
        perMethod.farrington = {
          ok: false,
          reason: "INSUFFICIENT_WEEKS_COVERAGE",
          weeksCoverage,
          minWeeksCoverage: minW,
        };
      } else {
        perMethod.farrington = { ok: true, weeksCoverage };
      }
    }

    return apiOk(res, {
      testCode: baseTc,
      overallN,
      weeksCoverage,
      hasThresholds,
      perMethod,
    });
  } catch (e) {
    return apiError(res, e?.message || String(e));
  }
});

module.exports = router;
