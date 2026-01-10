// src/utils/country.js
// Robust country/nationality labeling (UI-only)
//
// ✅ Best practice:
// - Store nationality/country as ISO2 codes (JO, PS, US, ...)
// - This file helps you migrate smoothly: accepts ISO2/ISO3, Arabic/English names,
//   and some legacy demonyms/strings, then normalizes to ISO2 for consistent grouping.
//
// Exports:
// - normalizeCountryToISO2(value): returns ISO2 or "" if unknown
// - countryLabel(value, lang): returns localized country name (Arabic/English) or fallback

const ISO2_ALL = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "YE","YT",
  "ZA","ZM","ZW"
];

const ISO3_TO_ISO2 = {
  JOR: "JO", PSE: "PS", USA: "US", GBR: "GB",
  DEU: "DE", FRA: "FR", ITA: "IT", ESP: "ES",
  SAU: "SA", ARE: "AE", EGY: "EG", IRQ: "IQ",
  SYR: "SY", LBN: "LB", YEM: "YE", SDN: "SD",
  QAT: "QA", KWT: "KW", BHR: "BH", OMN: "OM",
  TUR: "TR", IRN: "IR", RUS: "RU", CHN: "CN",
  JPN: "JP", KOR: "KR", IND: "IN", CAN: "CA",
  AUS: "AU"
};

const UNKNOWN_KEYS = new Set([
  "unknown","unk","undefined","null","na","n a","n/a","none","-","—","",
  "other","others","not available","notavailable","missing",
  "غير معروف","غيرمعروف","مجهول","غير محدد","غيرمحدد","لا يوجد","لايوجد"
]);

const LEGACY_TO_ISO2 = {
  // Jordan / فلسطين / ...
  jordan: "JO", jordanian: "JO", "الأردن": "JO", "اردن": "JO", "أردني": "JO", "اردني": "JO",
  palestine: "PS", palestinian: "PS", "فلسطين": "PS", "فلسطيني": "PS",
  syria: "SY", syrian: "SY", "سوريا": "SY", "سوري": "SY",
  iraq: "IQ", iraqi: "IQ", "العراق": "IQ", "عراقي": "IQ",
  egypt: "EG", egyptian: "EG", "مصر": "EG", "مصري": "EG",
  "saudi arabia": "SA", saudi: "SA", ksa: "SA", "السعودية": "SA", "سعودي": "SA",
  lebanon: "LB", lebanese: "LB", "لبنان": "LB", "لبناني": "LB",
  yemen: "YE", yemeni: "YE", "اليمن": "YE", "يمني": "YE",
  sudan: "SD", sudanese: "SD", "السودان": "SD", "سوداني": "SD",
  usa: "US", us: "US", american: "US", "الولايات المتحدة": "US", "أمريكي": "US", "امريكي": "US",
  uk: "GB", british: "GB", "المملكة المتحدة": "GB", "بريطاني": "GB",
  germany: "DE", german: "DE", "ألمانيا": "DE", "المانيا": "DE", "ألماني": "DE", "الماني": "DE",
  france: "FR", french: "FR", "فرنسا": "FR", "فرنسي": "FR",
  turkey: "TR", turkish: "TR", "تركيا": "TR", "تركي": "TR",
  iran: "IR", iranian: "IR", "إيران": "IR", "ايران": "IR", "إيراني": "IR", "ايراني": "IR",
};

function stripArabicDiacritics(s) {
  return String(s || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

function normalizeArabic(s) {
  return stripArabicDiacritics(s)
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(x) {
  const raw = String(x || "").trim();
  if (!raw) return "";
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  const base = hasArabic ? normalizeArabic(raw) : raw;

  return String(base)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[().,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnknownValue(value) {
  const k = normKey(value);
  if (!k) return true;
  return UNKNOWN_KEYS.has(k) || UNKNOWN_KEYS.has(k.replace(/\s/g, ""));
}

function toISO2(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // ISO2
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();

  // ISO3
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const iso2 = ISO3_TO_ISO2[raw.toUpperCase()];
    return iso2 || "";
  }

  // legacy map (names/demonyms)
  const k = normKey(raw);
  const direct = LEGACY_TO_ISO2[k] || LEGACY_TO_ISO2[k.replace(/\s/g, "")];
  if (direct) return direct;

  return "";
}

const REVERSE = { en: null, ar: null };

function buildReverse(lang) {
  const out = new Map();

  // build from Intl.DisplayNames if available
  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      const locale = lang === "ar" ? "ar" : "en";
      const dn = new Intl.DisplayNames([locale], { type: "region" });

      for (const code of ISO2_ALL) {
        const name = dn.of(code);
        if (name) {
          const nk = normKey(name);
          out.set(nk, code);
          out.set(nk.replace(/\s/g, ""), code);
        }
      }
    } catch {
      // ignore
    }
  }

  // add legacy keys too
  for (const [k, v] of Object.entries(LEGACY_TO_ISO2)) {
    const nk = normKey(k);
    out.set(nk, v);
    out.set(nk.replace(/\s/g, ""), v);
  }

  return out;
}

function reverseToISO2(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const k = normKey(raw);
  if (!k) return "";

  if (!REVERSE.en) REVERSE.en = buildReverse("en");
  if (!REVERSE.ar) REVERSE.ar = buildReverse("ar");

  return (
    REVERSE.en.get(k) ||
    REVERSE.ar.get(k) ||
    REVERSE.en.get(k.replace(/\s/g, "")) ||
    REVERSE.ar.get(k.replace(/\s/g, "")) ||
    ""
  );
}

// ✅ Export 1: normalize ANY input to ISO2 (or "" if unknown)
export function normalizeCountryToISO2(value) {
  const raw = String(value ?? "").trim();
  if (isUnknownValue(raw)) return "";
  return toISO2(raw) || reverseToISO2(raw) || "";
}

// ✅ Export 2: user-facing label (localized)
export function countryLabel(value, lang = "en") {
  const raw = String(value ?? "").trim();

  if (isUnknownValue(raw)) {
    return lang === "ar" ? "غير معروف" : "Unknown";
  }

  const iso2 = normalizeCountryToISO2(raw);

  if (iso2 && typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      const locale = lang === "ar" ? "ar" : "en";
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      return dn.of(iso2) || iso2;
    } catch {
      return iso2;
    }
  }

  // fallback during migration
  return raw;
}
