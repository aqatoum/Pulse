// apps/pulse-api/src/utils/paths.js
const path = require("path");

/**
 * Root of the monorepo:
 * PULSE/apps/pulse-api/src/utils/paths.js -> go up 4 levels to PULSE/
 */
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function repoPath(...parts) {
  return path.join(REPO_ROOT, ...parts);
}

module.exports = {
  REPO_ROOT,
  repoPath,
};
