// apps/pulse-api/src/services/aggregate/weeklyAgg.service.js
const WeeklyAggregate = require("../../models/WeeklyAggregate");

/**
 * Age banding for stratified weekly aggregates (general).
 */
function ageBand(ageYears) {
  const a = Number(ageYears);
  if (!Number.isFinite(a)) return "ALL";
  if (a < 5) return "0-4";
  if (a < 15) return "5-14";
  if (a < 50) return "15-49";
  return "50+";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * General weekly aggregates updater:
 * Works for any testCode, not only HB.
 *
 * Expected fields in docs:
 * - yearWeek, year, isoWeek
 * - regionId, facilityId, labId
 * - testCode, sex, ageYears
 * - value (numeric)
 *
 * Aggregates stored per stratum:
 * - n: count
 * - sum: sum(value)
 * - sumSq: sum(value^2)  (for variance later)
 * - min: min(value)
 * - max: max(value)
 *
 * NOTE:
 * - This is population-level aggregation, not individual diagnosis.
 */
async function updateWeeklyAggregatesFromDocs(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return { updated: 0 };

  const map = new Map();

  for (const d of docs) {
    const v = toNum(d.value);
    if (v === null) continue;

    const testCode = String(d.testCode || "UNKNOWN").toUpperCase();
    const sex = String(d.sex || "U").toUpperCase();
    const band = ageBand(d.ageYears);

    const key = [
      d.yearWeek,
      d.regionId || "UNKNOWN",
      d.facilityId || null,
      d.labId || null,
      testCode,
      sex,
      band,
    ].join("|");

    const cur = map.get(key) || {
      yearWeek: d.yearWeek,
      year: d.year,
      isoWeek: d.isoWeek,
      regionId: d.regionId || "UNKNOWN",
      facilityId: d.facilityId || null,
      labId: d.labId || null,
      testCode,
      sex,
      ageBand: band,

      // General stats
      n: 0,
      sum: 0,
      sumSq: 0,
      min: null,
      max: null,
    };

    cur.n += 1;
    cur.sum += v;
    cur.sumSq += v * v;

    cur.min = cur.min === null ? v : Math.min(cur.min, v);
    cur.max = cur.max === null ? v : Math.max(cur.max, v);

    map.set(key, cur);
  }

  const ops = [];
  for (const g of map.values()) {
    const filter = {
      yearWeek: g.yearWeek,
      regionId: g.regionId,
      facilityId: g.facilityId,
      labId: g.labId,
      testCode: g.testCode,
      sex: g.sex,
      ageBand: g.ageBand,
    };

    ops.push({
      updateOne: {
        filter,
        update: {
          $inc: {
            n: g.n,
            sum: g.sum,
            sumSq: g.sumSq,
          },
          $set: {
            year: g.year,
            isoWeek: g.isoWeek,
            updatedAt: new Date(),
          },
          // min/max cannot be done with $inc, we use $min/$max:
          $min: { min: g.min },
          $max: { max: g.max },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) await WeeklyAggregate.bulkWrite(ops, { ordered: false });

  return { updated: ops.length };
}

module.exports = { updateWeeklyAggregatesFromDocs };
