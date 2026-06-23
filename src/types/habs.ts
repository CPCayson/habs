export type StateAbbrev = "AL" | "TX" | "MS" | "FL" | "UNKNOWN";

export interface RawRow {
  [key: string]: string;
}

export type Severity = "PASS" | "WARNING" | "BLOCKER";

export interface ValidationDetail {
  step: number;
  stepName: string;
  severity: Severity;
  message: string;
  column?: string;
  value?: string;
}

export interface NormalizedRow {
  id: string; // Unique row key
  rawIndex: number;
  raw: RawRow;
  
  // Normalized Standard Headers
  DATE: string;        // YYYY-MM-DD standardizer
  TIME: string;        // HH:MM:SS standardizer
  LATITUDE: number | null; // Decimal degrees
  LONGITUDE: number | null; // Decimal degrees
  WTEMP: number | null;    // Celsius
  SALINITY: number | null; // Psu
  CELL_COUNT: number | null; // float/integer
  DEPTH: number | null;    // meters
  STATION_ID: string;
  REMARKS: string;
  
  // Coordinate details for debugging or validation
  originalLat: string;
  originalLon: string;
  latLonFormat: "DD" | "DMS" | "INVALID";

  // Temperature status for QA highlights
  originalTemp: string;
  tempWasFahrenheit: boolean;

  // Validation details
  details: ValidationDetail[];
  severity: Severity;
}

export interface PipelineStep {
  id: number;
  name: string;
  description: string;
  status: "pending" | "pass" | "warn" | "fail";
  count: number;
}

export interface IngestionMetrics {
  totalRecords: number;
  validRecords: number;
  warningRecords: number;
  blockerRecords: number;
  validationScore: number;     // % of records clean metadata
  parserCompatibility: number;  // % probability remote HABSGrabber runs
  readiness: "READY" | "REVIEW" | "BLOCKED";
}

export interface AuditRecord {
  id: string;
  filename: string;
  timestamp: string;
  state: StateAbbrev;
  recordsCount: number;
  validationScore: number;
  status: "SUCCESS" | "WARNING_OVERRIDE" | "BLOCKED";
  ticketMarkdown: string;
  coordinateErrorsPct?: number;
  rangeViolationsPct?: number;
  otherErrorsPct?: number;
  rows?: NormalizedRow[];
}

export interface OracleTableSnapshot {
  lastUpdated: string;
  rowCount: number;
  lastDdlTime: string;
  schemaVersion: string;
  maxSampleDate: string;
}

export interface DbEnvironment {
  name: "DEV" | "TEST" | "PROD";
  HAB_SAMPLES: OracleTableSnapshot;
  STATION_METADATA: OracleTableSnapshot;
  QA_LOGS: OracleTableSnapshot;
}
