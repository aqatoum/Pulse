// apps/pulse-api/src/config/analytics.defaults.js

module.exports = {
  global: {
    defaultPreset: "standard",

    presets: {
      low: {
        ewma: { lambda: 0.20, L: 3.5, baselineN: 8 },
        cusum: { baselineN: 8, k: 0.6, h: 6.0 },
        farrington: { baselineWeeks: 12, z: 2.5 },
      },

      standard: {
        ewma: { lambda: 0.30, L: 3.0, baselineN: 6 },
        cusum: { baselineN: 6, k: 0.5, h: 5.0 },
        farrington: { baselineWeeks: 10, z: 2.0 },
      },

      high: {
        ewma: { lambda: 0.40, L: 2.5, baselineN: 6 },
        cusum: { baselineN: 6, k: 0.4, h: 4.0 },
        farrington: { baselineWeeks: 10, z: 1.8 },
      },
    },

    bounds: {
      ewma: {
        lambda: { min: 0.10, max: 0.50 },
        L: { min: 2.0, max: 4.0 },
        baselineN: { min: 4, max: 26 },
      },
      cusum: {
        baselineN: { min: 4, max: 26 },
        k: { min: 0.10, max: 1.00 },
        h: { min: 2.0, max: 10.0 },
      },
      farrington: {
        baselineWeeks: { min: 4, max: 26 },
        z: { min: 1.5, max: 3.5 },
      },
    },
  },

  // optional per-test tuning later
  byTestCode: {
    // مثال: WBC noisy -> baseline أطول
    WBC: {
      presets: {
        standard: {
          cusum: { baselineN: 8, k: 0.55, h: 5.5 },
          ewma: { lambda: 0.25, L: 3.2, baselineN: 8 },
        },
      },
    },
  },

  // ✅ Backward compat: keep anemia pointer if old code expects it
  anemia: null,
};

// map anemia -> global for legacy code paths (if any)
module.exports.anemia = module.exports.global;
