const WeeklyAggregate = require("../../models/WeeklyAggregate");

function ageBand(ageYears) {
  const a = Number(ageYears);
  if (!Number.isFinite(a)) return "ALL";
  if (a < 5) return "0-4";
  if (a < 15) return "5-14";
  if (a < 50) return "15-49";
  return "50+";
}

// MVP low Hb rule (placeholder) — سنجعله WHO لاحقًا
function isLowHb(hb) {
  const v = Number(hb);
  return Number.isFinite(v) && v < 11;
}

async function updateWeeklyAggregatesFromDocs(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return { updated: 0 };

  const map = new Map();

  for (const d of docs) {
    // نتوقع هذه الحقول موجودة في docs القادمة من upload:
    // yearWeek, year, isoWeek, regionId, facilityId, labId, testCode, sex, ageYears, value
    const key = [
      d.yearWeek,
      d.regionId || "UNKNOWN",
      d.facilityId || null,
      d.labId || null,
      d.testCode || "HB",
      d.sex || "U",
      ageBand(d.ageYears),
    ].join("|");

    const cur = map.get(key) || {
      yearWeek: d.yearWeek,
      year: d.year,
      isoWeek: d.isoWeek,
      regionId: d.regionId || "UNKNOWN",
      facilityId: d.facilityId || null,
      labId: d.labId || null,
      testCode: d.testCode || "HB",
      sex: d.sex || "U",
      ageBand: ageBand(d.ageYears),
      n: 0,
      low: 0,
    };

    cur.n += 1;

    if ((cur.testCode || "").toUpperCase() === "HB") {
      if (isLowHb(d.value)) cur.low += 1;
    }

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
          $inc: { n: g.n, low: g.low },
          $set: { year: g.year, isoWeek: g.isoWeek, updatedAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) await WeeklyAggregate.bulkWrite(ops, { ordered: false });

  return { updated: ops.length };
}

module.exports = { updateWeeklyAggregatesFromDocs };
