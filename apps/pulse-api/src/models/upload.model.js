const mongoose = require("mongoose");

const UploadSchema = new mongoose.Schema(
  {
    // من يرفع
    facilityId: { type: String, default: null, index: true },
    regionId: { type: String, default: null, index: true },

    // معلومات الملف
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, default: "text/csv" },
    sizeBytes: { type: Number, default: 0 },

    // إحصاءات سريعة من الملف
    totalRows: { type: Number, default: 0 },        // عدد السجلات/الصفوف المستوردة
    totalTests: { type: Number, default: 0 },       // نفس totalRows غالبًا (إن كان كل صف فحص)
    testsByCode: { type: Map, of: Number, default: {} }, // {"HB": 1200, "WBC": 300...}

    // نطاق التاريخ إن وُجد
    dateRange: {
      start: { type: String, default: null }, // "YYYY-MM-DD"
      end: { type: String, default: null },
    },

    // ملاحظات
    note: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", UploadSchema);
