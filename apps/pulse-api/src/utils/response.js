function apiOk({ facilityId = null, analysis = null, data = null, interpretation = null }) {
  return {
    ok: true,
    service: "PULSE API",
    facilityId,
    analysis,
    data,
    interpretation,
    generatedAt: new Date().toISOString(),
  };
}

function apiError({ status = 500, error = "Server error", details = null }) {
  return {
    ok: false,
    service: "PULSE API",
    error,
    details,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { apiOk, apiError };
