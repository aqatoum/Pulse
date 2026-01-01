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
  return { from, to };
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

function weekKeyToStartDate(weekKey) {
  const m = String(weekKey || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const w = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(w)) return null;
  return dayjs().isoWeekYear(y).isoWeek(w).startOf("isoWeek"); // Monday
}

function getWeekKey(d) {
  const x = dayjs(d);
  const y = x.isoWeekYear();
  const w = String(x.isoWeek()).padStart(2, "0");
  return `${y}-W${w}`;
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
 * Returns:
 * - overallN
 * - weeksCoverage
 * - hasThresholds
 * - perMethod readiness
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
    const tc = normCode(testCode);

    const { tc: baseTc, cfg: clinicalCfg } = resolveClinicalConfig(tc);
    const hasThresholds = !!clinicalCfg;

    const match = {};
    if (facilityId) match.facilityId = String(facilityId).trim();
    if (regionId) match.regionId = String(regionId).trim();

    // require date exists
    match.$or = [{ testDate: { $ne: null } }, { collectedAt: { $ne: null } }];

    // match testCode (allow alias)
    match.testCode = { $in: [tc, baseTc] };

    // range via $expr on chosen date
    const dateExpr = { $ifNull: ["$testDate", "$collectedAt"] };
    const exprAnd = [];
    if (from) exprAnd.push({ $gte: [dateExpr, from.toDate()] });
    if (to) exprAnd.push({ $lte: [dateExpr, to.toDate()] });
    if (exprAnd.length) match.$expr = { $and: exprAnd };

    const pipeline = [
      { $match: match },
      { $project: { dt: dateExpr } },
      {
        $group: {
          _id: {
            isoYear: { $isoWeekYear: "$dt" },
            isoWeek: { $isoWeek: "$dt" },
          },
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
      if (weeksCoverage < minW) {
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

    const data = {
      testCode: baseTc,
      overallN,
      weeksCoverage,
      hasThresholds,
      perMethod,
    };

    // ✅ IMPORTANT: make response shape consistent with the rest of your API
    return res.json(apiOk({ data }));
  } catch (e) {
    return res
      .status(500)
      .json(apiError({ status: 500, error: e?.message || String(e) }));
  }
});

module.exports = router;
