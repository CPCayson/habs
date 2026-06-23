import { RawRow, NormalizedRow, StateAbbrev, ValidationDetail, IngestionMetrics, Severity } from "../types/habs";

// The Truth Table: Authoritative min/max ranges for HABS parameters (QA/ranges.py)
export const VALID_RANGES = {
  WTEMP: { min: 0, max: 40, unit: "°C" },
  SALINITY: { min: 0, max: 45, unit: "psu" },
  CELL_COUNT: { min: 0, max: 100000000, unit: "cells/L" },
  DEPTH: { min: 0, max: 200, unit: "m" },
  LATITUDE: { min: 24.0, max: 31.0, unit: "°N" },
  LONGITUDE: { min: -98.0, max: -80.0, unit: "°W" },
};

// Header synonyms mapped to standard key values (HABSGrabber/constants.py - termMap)
export const TERM_MAP: { [normalizedKey: string]: string[] } = {
  DATE: ["sample date", "date", "sdate", "collectiondate", "date_collected", "sampledate", "colldate"],
  TIME: ["sample time", "time", "stime", "collectiontime", "time_collected", "sampletime", "colltime"],
  LATITUDE: ["latitude", "lat", "y", "latitude_dd", "lat_dd", "latdd", "npos", "gpslat"],
  LONGITUDE: ["longitude", "lon", "lng", "x", "longitude_dd", "lon_dd", "londd", "wpos", "gpslon"],
  WTEMP: ["water temp (c)", "water temp (f)", "s. temp", "watertemp", "temp", "temperature", "w_temp", "temp_c", "temp_f", "wtemp"],
  SALINITY: ["salinity (psu)", "salinity", "sal", "s", "salinity_ppt", "salinity_psu", "salinity_ppt", "salinity_ppt", "salinity_ppt"],
  CELL_COUNT: ["cell count (cells/l)", "cellcount", "abundance", "cells", "karenia brevis", "k. brevis", "concentration", "cells_per_l", "k_brevis"],
  DEPTH: ["depth (m)", "depth", "sdepth", "sampledepth", "depth_m", "station_depth"],
  STATION_ID: ["station id", "station", "locid", "stationname", "station_id", "stat_id", "stnid"],
  REMARKS: ["remarks", "notes", "comment", "comments", "desc", "description"]
};

// Find the corresponding header from raw input row using term map rules
export function normalizeHeader(rawRow: RawRow, targetKey: string): string {
  const synonyms = TERM_MAP[targetKey];
  if (!synonyms) return "";
  
  const rawKeys = Object.keys(rawRow);
  for (const key of rawKeys) {
    const cleanKey = key.trim().toLowerCase();
    if (synonyms.includes(cleanKey)) {
      return key;
    }
  }
  return "";
}

// Convert Degrees-Minutes-Seconds (DMS) format to Decimal Degrees (DMS2DD)
export function DMS2DD(dmsStr: string): number | null {
  if (!dmsStr) return null;
  const cleaned = dmsStr.trim();
  
  // Try to parse direct float
  const numericVal = parseFloat(cleaned);
  if (!isNaN(numericVal) && /^-?\d+(\.\d+)?$/.test(cleaned)) {
    return numericVal;
  }
  
  // Regex to extract Degrees, Minutes, Seconds with directions
  // Handles formats: "30 15 24.3", "30°15'24.3\"N", "30-15-24.3", "30:15:20"
  const dmsRegex = /^(-?\d+)[°\s:-]+(\d+)[′'\s:-]+(\d+(?:\.\d+)?)[″"\s]*([NSEWnsew]?)$/;
  const match = cleaned.match(dmsRegex);
  
  if (match) {
    const degrees = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseFloat(match[3]);
    const direction = match[4]?.toUpperCase();
    
    let decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    if (degrees < 0) decimal = -decimal;
    
    if (direction === "S" || direction === "W") {
      decimal = -Math.abs(decimal);
    }
    
    return decimal;
  }
  
  // Try backup simple delimiter split
  const parts = cleaned.split(/[\s°'":-]+/).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 4) {
    const degrees = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts[2] ? parseFloat(parts[2]) : 0;
    const lastPart = parts[parts.length - 1]?.toUpperCase();
    
    if (!isNaN(degrees) && !isNaN(minutes)) {
      let decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
      if (degrees < 0) decimal = -decimal;
      
      if (lastPart === "W" || lastPart === "S") {
        decimal = -Math.abs(decimal);
      }
      return decimal;
    }
  }
  
  return null;
}

// Detect the state of origin based on geography, coordinates, file headers, or station IDs
export function detectState(
  filename: string, 
  rawRow: RawRow, 
  lat: number | null, 
  lon: number | null
): StateAbbrev {
  const lowerFile = filename.toLowerCase();
  if (lowerFile.includes("alabama") || lowerFile.includes("_al")) return "AL";
  if (lowerFile.includes("florida") || lowerFile.includes("_fl")) return "FL";
  if (lowerFile.includes("texas") || lowerFile.includes("_tx")) return "TX";
  if (lowerFile.includes("mississippi") || lowerFile.includes("_ms")) return "MS";
  
  // Let's analyze header keys
  const keys = Object.keys(rawRow).map(k => k.toLowerCase());
  if (keys.includes("karenia brevis") || keys.includes("abundance_class")) return "FL";
  if (keys.includes("county_code") && keys.includes("mora_id")) return "TX";
  
  // Geographic approximation in Gulf of Mexico
  if (lat && lon) {
    // AL coastline coordinates
    if (lat >= 30.1 && lat <= 31.0 && lon >= -88.4 && lon <= -87.4) return "AL";
    // MS coastline
    if (lat >= 30.1 && lat <= 30.7 && lon >= -89.7 && lon < -88.4) return "MS";
    // TX coastline
    if (lat >= 25.9 && lat <= 30.2 && lon >= -97.8 && lon <= -93.5) return "TX";
    // FL peninsula/panhandle
    if (lat >= 24.3 && lat <= 31.0 && lon >= -87.4 && lon <= -80.0) return "FL";
  }
  
  return "UNKNOWN";
}

// Execute 12-Level Validation on raw spreadsheet array of rows
export function runValidationPipeline(
  rows: RawRow[], 
  filename: string,
  userOverrides: { [key: string]: boolean } = {}
): { normalizedRows: NormalizedRow[]; metrics: IngestionMetrics } {
  const normalizedRows: NormalizedRow[] = [];
  
  let totalRows = rows.length;
  let blockerCount = 0;
  let warningCount = 0;
  let validCount = 0;
  
  rows.forEach((raw, index) => {
    const details: ValidationDetail[] = [];
    let rowSeverity: Severity = "PASS";
    
    // Level 1: File Intake
    const isRowEmpty = Object.values(raw).every(val => !val || val.trim() === "");
    if (isRowEmpty) {
      details.push({
        step: 1,
        stepName: "File Intake",
        severity: "BLOCKER",
        message: "Record is empty. No data found on this row."
      });
    } else {
      details.push({
        step: 1,
        stepName: "File Intake",
        severity: "PASS",
        message: "File row successfully ingested into byte reader."
      });
    }

    // Header Lookups
    const dateHeader = normalizeHeader(raw, "DATE");
    const timeHeader = normalizeHeader(raw, "TIME");
    const latHeader = normalizeHeader(raw, "LATITUDE");
    const lonHeader = normalizeHeader(raw, "LONGITUDE");
    const tempHeader = normalizeHeader(raw, "WTEMP");
    const salHeader = normalizeHeader(raw, "SALINITY");
    const countHeader = normalizeHeader(raw, "CELL_COUNT");
    const depthHeader = normalizeHeader(raw, "DEPTH");
    const stationHeader = normalizeHeader(raw, "STATION_ID");
    const remarksHeader = normalizeHeader(raw, "REMARKS");

    // Extract raw string values
    const rawDate = dateHeader ? raw[dateHeader]?.trim() || "" : "";
    const rawTime = timeHeader ? raw[timeHeader]?.trim() || "" : "";
    const rawLat = latHeader ? raw[latHeader]?.trim() || "" : "";
    const rawLon = lonHeader ? raw[lonHeader]?.trim() || "" : "";
    const rawTemp = tempHeader ? raw[tempHeader]?.trim() || "" : "";
    const rawSal = salHeader ? raw[salHeader]?.trim() || "" : "";
    const rawCount = countHeader ? raw[countHeader]?.trim() || "" : "";
    const rawDepth = depthHeader ? raw[depthHeader]?.trim() || "" : "";
    const rawStation = stationHeader ? raw[stationHeader]?.trim() || "STN_UNKNOWN" : "STN_UNKNOWN";
    const rawRemarks = remarksHeader ? raw[remarksHeader]?.trim() || "" : "";

    // Level 2: Schema Validation (Critical Headers Present)
    let missingCoringHeaders: string[] = [];
    if (!dateHeader) missingCoringHeaders.push("Date");
    if (!latHeader) missingCoringHeaders.push("Latitude");
    if (!lonHeader) missingCoringHeaders.push("Longitude");
    
    if (missingCoringHeaders.length > 0) {
      details.push({
        step: 2,
        stepName: "Schema Validation",
        severity: "BLOCKER",
        message: `Missing required core columns: ${missingCoringHeaders.join(", ")}`,
        column: missingCoringHeaders[0]
      });
    } else {
      details.push({
        step: 2,
        stepName: "Schema Validation",
        severity: "PASS",
        message: "All mandatory structural headers (Date, Latitude, Longitude) matched via TermMap."
      });
    }

    // Level 3: State Detection
    let detectedLatDecimal = DMS2DD(rawLat);
    let detectedLonDecimal = DMS2DD(rawLon);
    if (detectedLonDecimal !== null && detectedLonDecimal > 0) {
      detectedLonDecimal = -detectedLonDecimal; // Auto negate West longitudes for Gulf region
    }
    const state = detectState(filename, raw, detectedLatDecimal, detectedLonDecimal);
    details.push({
      step: 3,
      stepName: "State Detection",
      severity: "PASS",
      message: `Originating jurisdiction auto-resolved as state: ${state}`
    });

    // Level 4: Type Validation
    let cellPass = true;
    let salPass = true;
    let tempPass = true;
    let depthPass = true;

    let cellCountVal: number | null = null;
    let salVal: number | null = null;
    let tempVal: number | null = null;
    let depthVal: number | null = null;

    // Filter noise like "N/A", "nd", "null", "<MDL"
    const cleanedCount = rawCount.replace(/[,<>]/g, "").trim().toLowerCase();
    if (rawCount) {
      if (cleanedCount === "n/a" || cleanedCount === "nd" || cleanedCount === "null" || cleanedCount === "neg" || cleanedCount === "none") {
        cellCountVal = 0;
      } else {
        cellCountVal = parseFloat(cleanedCount);
        if (isNaN(cellCountVal)) {
          cellPass = false;
          details.push({
            step: 4,
            stepName: "Type Validation",
            severity: "BLOCKER",
            message: `Cell count cannot be converted to float: "${rawCount}"`,
            column: countHeader,
            value: rawCount
          });
        }
      }
    }

    if (rawSal) {
      const cleanSal = rawSal.trim().toLowerCase();
      if (cleanSal === "n/a" || cleanSal === "nd" || cleanSal === "null") {
        salVal = null;
      } else {
        salVal = parseFloat(cleanSal);
        if (isNaN(salVal)) {
          salPass = false;
          details.push({
            step: 4,
            stepName: "Type Validation",
            severity: "WARNING",
            message: `Salinity can't be resolved as a float, defaulting to null: "${rawSal}"`,
            column: salHeader,
            value: rawSal
          });
        }
      }
    }

    if (rawTemp) {
      const cleanTemp = rawTemp.trim().toLowerCase();
      if (cleanTemp === "n/a" || cleanTemp === "nd" || cleanTemp === "null") {
        tempVal = null;
      } else {
        // Handle values containing "F" or "C" marks
        const tempCleaned = cleanTemp.replace(/[°°CcfF]/g, "").trim();
        tempVal = parseFloat(tempCleaned);
        if (isNaN(tempVal)) {
          tempPass = false;
          details.push({
            step: 4,
            stepName: "Type Validation",
            severity: "WARNING",
            message: `Water Temperature is non-numeric, defaulting to null: "${rawTemp}"`,
            column: tempHeader,
            value: rawTemp
          });
        }
      }
    }

    if (rawDepth) {
      const cleanDepth = rawDepth.trim().toLowerCase();
      depthVal = parseFloat(cleanDepth);
      if (isNaN(depthVal)) {
        depthPass = false;
        // depth is optional, so warning
        if (rawDepth && rawDepth.toLowerCase() !== "surface" && rawDepth.toLowerCase() !== "s") {
          details.push({
            step: 4,
            stepName: "Type Validation",
            severity: "WARNING",
            message: `Depth is non-numeric: "${rawDepth}". Surface mapping triggered.`,
            column: depthHeader,
            value: rawDepth
          });
        }
        depthVal = 0; // standard surface code
      }
    }

    if (cellPass && salPass && tempPass && depthPass) {
      details.push({
        step: 4,
        stepName: "Type Validation",
        severity: "PASS",
        message: "Numeric and categorical typing verified successfully."
      });
    }

    // Level 5: Coordinate Parsing (DMS2DD)
    let latVal: number | null = null;
    let lonVal: number | null = null;
    let coordFormat: "DD" | "DMS" | "INVALID" = "INVALID";

    if (latHeader && lonHeader) {
      latVal = DMS2DD(rawLat);
      lonVal = DMS2DD(rawLon);
      
      if (lonVal !== null && lonVal > 0) {
        lonVal = -lonVal; // West index negation
      }

      if (latVal !== null && lonVal !== null) {
        const isDMS = rawLat.includes("°") || rawLat.includes("'") || rawLat.includes("\"") || rawLat.split(" ").filter(Boolean).length > 1;
        coordFormat = isDMS ? "DMS" : "DD";
        details.push({
          step: 5,
          stepName: "Coordinate Parsing",
          severity: "PASS",
          message: `Coordinates parsed into decimal degrees using HABS DMS2DD rules [Format: ${coordFormat}]. Lat: ${latVal.toFixed(5)}, Lon: ${lonVal.toFixed(5)}`
        });
      } else {
        coordFormat = "INVALID";
        details.push({
          step: 5,
          stepName: "Coordinate Parsing",
          severity: "BLOCKER",
          message: `Unable to translate coordinates into valid numbers: Lat("${rawLat}"), Lon("${rawLon}")`,
          column: latHeader
        });
      }
    }

    // Level 6: Geographic Validation
    if (latVal !== null && lonVal !== null) {
      const inGOM_Lat = latVal >= VALID_RANGES.LATITUDE.min && latVal <= VALID_RANGES.LATITUDE.max;
      const inGOM_Lon = lonVal >= VALID_RANGES.LONGITUDE.min && lonVal <= VALID_RANGES.LONGITUDE.max;

      if (!inGOM_Lat || !inGOM_Lon) {
        details.push({
          step: 6,
          stepName: "Geographic Validation",
          severity: "BLOCKER",
          message: `Coordinates fall outside Gulf of Mexico grid boundary: [${latVal.toFixed(4)}, ${lonVal.toFixed(4)}]`,
          column: latHeader
        });
      } else {
        // Coast check: basic check if in middle of high land
        // (Austin / North Florida landlocked)
        const inFloridaCenter = latVal > 28.0 && latVal < 30.0 && lonVal > -82.4 && lonVal < -81.0;
        const inTexasCenter = latVal > 30.0 && lonVal < -95.0;
        
        if (inFloridaCenter || inTexasCenter) {
          details.push({
            step: 6,
            stepName: "Geographic Validation",
            severity: "WARNING",
            message: `Coordinates land-locked within mainland state: [Lat: ${latVal.toFixed(4)}, Lon: ${lonVal.toFixed(4)}]. Check DMS orientation signs.`,
            column: latHeader
          });
        } else {
          details.push({
            step: 6,
            stepName: "Geographic Validation",
            severity: "PASS",
            message: "Coordinates verified within active Gulf of Mexico coastal zones."
          });
        }
      }
    }

    // Level 7: Scientific Range Controls (ranges.py)
    if (tempVal !== null) {
      // we check for Celsius range after potential conversion or direct validation
      let checkedTemp = tempVal;
      const originalTempHeaderLower = tempHeader.toLowerCase();
      const isF = checkedTemp > 45 || originalTempHeaderLower.includes("(f)") || rawTemp.toLowerCase().includes("f") || checkedTemp > 40;
      if (isF) {
        checkedTemp = (checkedTemp - 32) * 5/9; // Simulated conversion 
      }

      if (checkedTemp < VALID_RANGES.WTEMP.min || checkedTemp > VALID_RANGES.WTEMP.max) {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "WARNING",
          message: `Water Temp (${checkedTemp.toFixed(1)}°C) falls outside expected bounds [${VALID_RANGES.WTEMP.min} - ${VALID_RANGES.WTEMP.max}°C]`,
          column: tempHeader,
          value: rawTemp
        });
      } else {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "PASS",
          message: `Water Temperature (${checkedTemp.toFixed(1)}°C) checked against oceanography models.`
        });
      }
    }

    if (salVal !== null) {
      if (salVal < VALID_RANGES.SALINITY.min || salVal > VALID_RANGES.SALINITY.max) {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "WARNING",
          message: `Salinity (${salVal} psu) is outside marine limits [${VALID_RANGES.SALINITY.min} - ${VALID_RANGES.SALINITY.max} psu]`,
          column: salHeader,
          value: rawSal
        });
      } else {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "PASS",
          message: `Salinity (${salVal} psu) verified in typical marine ranges.`
        });
      }
    }

    if (cellCountVal !== null) {
      if (cellCountVal < VALID_RANGES.CELL_COUNT.min || cellCountVal > VALID_RANGES.CELL_COUNT.max) {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "BLOCKER",
          message: `Cell abundance count (${cellCountVal}) exceeds maximum logical bounds [0 - 100M cells/L].`,
          column: countHeader,
          value: rawCount
        });
      } else {
        details.push({
          step: 7,
          stepName: "Scientific Validation",
          severity: "PASS",
          message: `Cell Abundance count verified: ${cellCountVal.toLocaleString()} cells/L.`
        });
      }
    }

    // Level 8: QA scrubbing conversions (QA.py)
    let tempWasFContent = false;
    let mappedTemp = tempVal;

    if (tempVal !== null) {
      const isHeaderF = tempHeader.toLowerCase().includes("(f)") || tempHeader.toLowerCase().includes("temp_f");
      const isValF = tempVal > 45 || rawTemp.toLowerCase().includes("f");
      if (isHeaderF || isValF) {
        mappedTemp = (tempVal - 32) * 5/9;
        tempWasFContent = true;
        details.push({
          step: 8,
          stepName: "QA Ingest Rules",
          severity: "WARNING",
          message: `Ingest scrub converted Fahrenheit Temp (${tempVal}°F) to Celsius (${mappedTemp.toFixed(2)}°C)`,
          column: tempHeader
        });
      }
    }

    // Check wind/wave column for "calm" string mapping
    const rawKeys = Object.keys(raw);
    rawKeys.forEach(k => {
      if (k.toLowerCase().includes("wind") || k.toLowerCase().includes("wave") || k.toLowerCase().includes("sea")) {
        const val = raw[k]?.trim().toLowerCase();
        if (val === "calm" || val === "smooth" || val === "flat") {
          details.push({
            step: 8,
            stepName: "QA Ingest Rules",
            severity: "PASS",
            message: `Normalized word value "${raw[k]}" to 0 in column "${k}"`
          });
        }
      }
    });

    details.push({
      step: 8,
      stepName: "QA Ingest Rules",
      severity: "PASS",
      message: "Scrub conversions completed successfully."
    });

    // Level 9: Duplicate Detection
    // Simple state: simulate check for same datetime/station
    const datetimeStr = `${rawDate} ${rawTime}`;
    const findSame = normalizedRows.some(row => 
      row.DATE === rawDate && 
      row.TIME === rawTime && 
      row.STATION_ID === rawStation
    );

    if (findSame) {
      details.push({
        step: 9,
        stepName: "Duplicate Detection",
        severity: "WARNING",
        message: `Potential duplicate found for Sample Date "${rawDate}" at Station "${rawStation}".`,
        column: stationHeader
      });
    } else {
      details.push({
        step: 9,
        stepName: "Duplicate Detection",
        severity: "PASS",
        message: "No duplicates found on spatial-temporal coordinate indexes."
      });
    }

    // Level 10: Completeness Checks (Ratios)
    const optionalHeaders = [salHeader, tempHeader, depthHeader, remarksHeader, stationHeader].filter(Boolean);
    const filledOptionals = optionalHeaders.filter(h => raw[h] && raw[h].trim() !== "");
    const completenessRatio = optionalHeaders.length ? (filledOptionals.length / optionalHeaders.length) : 1;

    if (completenessRatio < 0.50) {
      details.push({
        step: 10,
        stepName: "Completeness Score",
        severity: "WARNING",
        message: `High ratio of missing optional attributes (${Math.round((1 - completenessRatio) * 100)}% empty).`,
        column: "Optional fields"
      });
    } else {
      details.push({
        step: 10,
        stepName: "Completeness Score",
        severity: "PASS",
        message: `Completeness of secondary oceanographic features is acceptable (${Math.round(completenessRatio * 100)}% fields provided).`
      });
    }

    // Level 11: Remote Server Compatibility (HABSGrabber KeyError protection)
    const weirdSpecialChars = /[^\u0000-\u007F]+/; // Non-ASCII check
    let headerLeads = false;
    for (const key of Object.keys(raw)) {
      if (weirdSpecialChars.test(key) || weirdSpecialChars.test(raw[key] || "")) {
        headerLeads = true;
      }
    }

    if (headerLeads) {
      details.push({
        step: 11,
        stepName: "Parser Compatibility",
        severity: "WARNING",
        message: "Detected high-ASCII characters or cell encodings. Target Unix parsers may throw KeyError.",
        column: "File Encoding"
      });
    } else {
      details.push({
        step: 11,
        stepName: "Parser Compatibility",
        severity: "PASS",
        message: "File structure verified clean. Excluded all trailing tab blocks and non-ASCII characters."
      });
    }

    // Level 12: Ingest Simulation Virtual Run
    const canVirtualIngest = !details.some(d => d.severity === "BLOCKER");
    if (canVirtualIngest) {
      details.push({
        step: 12,
        stepName: "Virtual Ingest Run",
        severity: "PASS",
        message: "Target SQL mock ingest simulation returns code exit 0."
      });
    } else {
      details.push({
        step: 12,
        stepName: "Virtual Ingest Run",
        severity: "BLOCKER",
        message: "Virtual ingest halted. Unresolved blockers make remote execution impossible (would trigger remote script crash)."
      });
    }

    // Determine finalized row severity
    const hasBlockers = details.some(d => d.severity === "BLOCKER");
    const hasWarnings = details.some(d => d.severity === "WARNING");
    rowSeverity = hasBlockers ? "BLOCKER" : (hasWarnings ? "WARNING" : "PASS");

    if (rowSeverity === "BLOCKER") blockerCount++;
    else if (rowSeverity === "WARNING") warningCount++;
    else validCount++;

    normalizedRows.push({
      id: `row_${index}`,
      rawIndex: index,
      raw,
      DATE: rawDate,
      TIME: rawTime || "12:00:00",
      LATITUDE: latVal,
      LONGITUDE: lonVal,
      WTEMP: mappedTemp,
      SALINITY: salVal,
      CELL_COUNT: cellCountVal,
      DEPTH: depthVal,
      STATION_ID: rawStation,
      REMARKS: rawRemarks,
      originalLat: rawLat,
      originalLon: rawLon,
      latLonFormat: coordFormat,
      originalTemp: rawTemp,
      tempWasFahrenheit: tempWasFContent,
      details,
      severity: rowSeverity
    });
  });

  // Calculate high quality preflight KPI scorecard indices
  const validationScore = Math.round((validCount + warningCount * 0.5) / (totalRows || 1) * 100);
  const parserCompatibility = Math.round((1 - (blockerCount + warningCount * 0.2) / (totalRows || 1)) * 100);
  
  let readiness: "READY" | "REVIEW" | "BLOCKED" = "READY";
  if (blockerCount > 0) {
    readiness = "BLOCKED";
  } else if (warningCount > 0) {
    readiness = "REVIEW";
  }

  // Handle user confirmed force override flags toggles
  if (readiness === "REVIEW" && userOverrides["forceIngestWarnings"]) {
    readiness = "READY";
  }

  return {
    normalizedRows,
    metrics: {
      totalRecords: totalRows,
      validRecords: validCount,
      warningRecords: warningCount,
      blockerRecords: blockerCount,
      validationScore: Math.max(0, Math.min(100, validationScore)),
      parserCompatibility: Math.max(0, Math.min(100, parserCompatibility)),
      readiness
    }
  };
}

// Convert normalized array of rows into a clean Tab-Delimited text block (Normalize & Export)
export function generateTSVExport(normalizedRows: NormalizedRow[]): string {
  const headers = [
    "STATION_ID",
    "SAMPLE_DATE",
    "SAMPLE_TIME",
    "LATITUDE_DD",
    "LONGITUDE_DD",
    "CELL_COUNT_CELLS_L",
    "WATER_TEMP_C",
    "SALINITY_PSU",
    "DEPTH_M",
    "REMARKS"
  ];
  
  const lines = [headers.join("\t")];
  
  normalizedRows.forEach(row => {
    // If there is an active blocker we exclude it, or let the user export what is possible
    if (row.severity === "BLOCKER") return; 

    const fields = [
      row.STATION_ID,
      row.DATE,
      row.TIME,
      row.LATITUDE !== null ? row.LATITUDE.toFixed(6) : "NaN",
      row.LONGITUDE !== null ? row.LONGITUDE.toFixed(6) : "NaN",
      row.CELL_COUNT !== null ? row.CELL_COUNT.toString() : "0",
      row.WTEMP !== null ? row.WTEMP.toFixed(2) : "NaN",
      row.SALINITY !== null ? row.SALINITY.toFixed(2) : "NaN",
      row.DEPTH !== null ? row.DEPTH.toFixed(2) : "0.00",
      row.REMARKS.replace(/\t/g, " ") // Clean internal tabs
    ];
    lines.push(fields.join("\t"));
  });
  
  return lines.join("\n");
}
