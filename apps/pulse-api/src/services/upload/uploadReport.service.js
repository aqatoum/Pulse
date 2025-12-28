const labResultRepository = require("../../repositories/labResult.repository");
const uploadRepository = require("../../repositories/upload.repository");

const buildUploadReport = async () => {
  const [
    files,
    tests,
    facilityIds,
    regionIds,
    byTest,
    facilities,
    regions,
    uploads,
  ] = await Promise.all([
    uploadRepository.countUploads(),
    labResultRepository.countLabResults(),
    labResultRepository.distinctFacilityIds(),
    labResultRepository.distinctRegionIds(),
    labResultRepository.aggregateByTest(),
    labResultRepository.aggregateFacilities(),
    labResultRepository.aggregateRegions(),
    uploadRepository.listRecentUploads(),
  ]);

  return {
    data: {
      totals: {
        files,
        tests,
        facilities: facilityIds.length,
        regions: regionIds.length,
      },
      byTest,
      facilities,
      regions,
      uploads,
    },
  };
};

module.exports = {
  buildUploadReport,
};
