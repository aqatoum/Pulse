// src/pages/surveillance/constants.js

export const PRESETS = {
  low: {
    ewma: { lambda: 0.2, L: 3.5, baselineN: 8 },
    cusum: { baselineN: 8, k: 0.7, h: 7.0 },
    farrington: { baselineWeeks: 12, z: 2.8 },
  },
  standard: {
    ewma: { lambda: 0.3, L: 3.0, baselineN: 4 },
    cusum: { baselineN: 4, k: 0.5, h: 5.0 },
    farrington: { baselineWeeks: 8, z: 2.0 },
  },
  high: {
    ewma: { lambda: 0.45, L: 2.4, baselineN: 4 },
    cusum: { baselineN: 4, k: 0.3, h: 3.5 },
    farrington: { baselineWeeks: 6, z: 1.8 },
  },
};

export const BOUNDS = {
  ewma: {
    lambda: { min: 0.1, max: 0.5 },
    L: { min: 2, max: 4 },
    baselineN: { min: 4, max: 26 },
  },
  cusum: {
    baselineN: { min: 4, max: 26 },
    k: { min: 0.1, max: 1.0 },
    h: { min: 2, max: 10 },
  },
  farrington: {
    baselineWeeks: { min: 4, max: 26 },
    z: { min: 1.5, max: 3.5 },
  },
};
