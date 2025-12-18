// src/config/analytics.defaults.js

/**
 * Defaults are the "committee-safe" baseline.
 * We also provide bounded presets + advanced bounds to allow controlled tuning
 * without turning the system into a "random knobs" machine.
 */

module.exports = {
  anemia: {
    // The default (committee-safe) baseline
    defaultPreset: "standard",

    presets: {
      // Lower sensitivity (fewer alerts)
      low: {
        ewma: { lambda: 0.20, L: 3.5, baselineN: 8 },
        cusum: { baselineN: 8, k: 0.6, h: 6.0 },
        farrington: { baselineWeeks: 12, z: 2.5 },
      },

      // Standard sensitivity (recommended)
      standard: {
        ewma: { lambda: 0.30, L: 3.0, baselineN: 4 },
        cusum: { baselineN: 4, k: 0.5, h: 5.0 },
        farrington: { baselineWeeks: 8, z: 2.0 },
      },

      // Higher sensitivity (earlier detection, potentially noisier)
      high: {
        ewma: { lambda: 0.40, L: 2.5, baselineN: 4 },
        cusum: { baselineN: 4, k: 0.4, h: 4.0 },
        farrington: { baselineWeeks: 8, z: 1.8 },
      },
    },

    /**
     * Hard bounds (safety rails).
     * Any user override is clamped to these ranges.
     */
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
};
