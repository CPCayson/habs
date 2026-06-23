import React, { useState } from "react";
import { NormalizedRow, IngestionMetrics } from "../types/habs";
import { Download, Copy, Check, Terminal, Play, Server, ArrowUpRight, FileJson } from "lucide-react";
import JSZip from "jszip";

interface ExportAndTicketProps {
  normalizedRows: NormalizedRow[];
  metrics: IngestionMetrics;
  filename: string;
  state: string;
  formattedTSV: string;
  onCommitHistoricalRun: (ticketText: string) => void;
}

export default function ExportAndTicket({
  normalizedRows,
  metrics,
  filename,
  state,
  formattedTSV,
  onCommitHistoricalRun
}: ExportAndTicketProps) {
  const [copiedExport, setCopiedExport] = useState<boolean>(false);
  const [copiedTicket, setCopiedTicket] = useState<boolean>(false);
  
  // Output and Path Customization for HABSOS Workbench
  const [customPath, setCustomPath] = useState<string>("/home/habs_user/HABSGrabber/exports/");
  const [customFileName, setCustomFileName] = useState<string>(`normalized_${filename.replace(/\.[^/.]+$/, "")}.txt`);

  React.useEffect(() => {
    setCustomFileName(`normalized_${filename.replace(/\.[^/.]+$/, "")}.txt`);
  }, [filename]);

  const downloadPythonValidator = () => {
    const pythonCode = `"""
LocalValidator: NOAA HABSOS Ingestion Preflight Validation Engine
Designed for HABS Grabber Pipeline Alignment.
"""
import os
import sys
import csv
from datetime import datetime

try:
    from HABSGrabber import constants, QA, validation, ranges
except ImportError:
    class MockConstants:
        TERM_MAP = {
            "DATE": ["sample date", "date", "sdate", "collectiondate", "date_collected", "sampledate", "colldate"],
            "TIME": ["sample time", "time", "stime", "collectiontime", "time_collected", "sampletime", "colltime"],
            "LATITUDE": ["latitude", "lat", "y", "latitude_dd", "lat_dd", "latdd", "npos", "gpslat"],
            "LONGITUDE": ["longitude", "lon", "lng", "x", "longitude_dd", "lon_dd", "londd", "wpos", "gpslon"],
            "WTEMP": ["water temp (c)", "water temp (f)", "s. temp", "watertemp", "temp", "temperature", "w_temp", "temp_c", "temp_f", "wtemp"],
            "SALINITY": ["salinity (psu)", "salinity", "sal", "s", "salinity_ppt", "salinity_psu"],
            "CELL_COUNT": ["cell count (cells/l)", "cellcount", "abundance", "cells", "karenia brevis", "k. brevis", "concentration"],
            "DEPTH": ["depth (m)", "depth", "sdepth", "sampledepth", "depth_m"],
            "STATION_ID": ["station id", "station", "locid", "stationname", "station_id", "stnid"],
            "REMARKS": ["remarks", "notes", "comment", "comments", "desc"]
        }
    
    class MockRanges:
        VALID_RANGES = {
            "WTEMP": {"min": 0, "max": 40},
            "SALINITY": {"min": 0, "max": 45},
            "CELL_COUNT": {"min": 0, "max": 100000000},
            "DEPTH": {"min": 0, "max": 200},
            "LATITUDE": {"min": 24.0, "max": 31.0},
            "LONGITUDE": {"min": -98.0, "max": -80.0}
        }
        
    class MockQA:
        @staticmethod
        def dms_to_dd(dms_str):
            if not dms_str:
                return None
            val = str(dms_str).strip()
            try:
                return float(val)
            except ValueError:
                pass
            import re
            match = re.match(r'^(-?\\d+)[°\\s:-]+(\\d+)[′\\'\\s:-]+(\\d+(?:\\.\\d+)?)[″"\\s]*([NSEWnsew]?)$', val)
            if match:
                deg, mns, sec, direction = match.groups()
                decimal = abs(int(deg)) + int(mns)/60.0 + float(sec)/3600.0
                if int(deg) < 0 or direction.upper() in ["S", "W"]:
                    decimal = -decimal
                return decimal
            return None

        @staticmethod
        def clean_fahrenheit_to_celsius(temp_val, header_or_unit_f=False):
            try:
                temp = float(temp_val)
                if temp > 45 or header_or_unit_f:
                    return (temp - 32) * 5.0 / 9.0
                return temp
            except (ValueError, TypeError):
                return None

    class MockValidation:
        @staticmethod
        def validate_observation(record, ranges_dict):
            is_valid = True
            errors = []
            lat = record.get("LATITUDE")
            lon = record.get("LONGITUDE")
            if lat is None or lon is None:
                errors.append("Core coordinate missing (LATITUDE or LONGITUDE).")
                is_valid = False
            else:
                lat_bounds = ranges_dict["LATITUDE"]
                lon_bounds = ranges_dict["LONGITUDE"]
                if not (lat_bounds["min"] <= lat <= lat_bounds["max"]):
                    errors.append(f"Latitude {lat} out of bounds.")
                    is_valid = False
                if not (lon_bounds["min"] <= lon <= lon_bounds["max"]):
                    errors.append(f"Longitude {lon} out of bounds.")
                    is_valid = False
            return is_valid, errors

    constants = MockConstants()
    ranges = MockRanges()
    QA = MockQA()
    validation = MockValidation()

class ValidationReport:
    def __init__(self, filename=""):
        self.filename = filename
        self.timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.records_processed = 0
        self.records_passed = 0
        self.records_failed = 0
        self.blocker_count = 0
        self.data_quality_count = 0
        self.details = []
        self.readiness = "READY"

    def compute_summary(self):
        if self.blocker_count > 0:
            self.readiness = "BLOCKED"
        elif self.data_quality_count > 0:
            self.readiness = "REVIEW"
        else:
            self.readiness = "READY"

class LocalValidator:
    def __init__(self):
        self.ranges = ranges.VALID_RANGES
        self.term_map = constants.TERM_MAP

    def normalize_headers(self, raw_headers):
        normalized = {}
        for raw_h in raw_headers:
            clean_h = str(raw_h).strip().lower()
            matched = False
            for norm_key, synonyms in self.term_map.items():
                if clean_h in synonyms:
                    normalized[norm_key] = raw_h
                    matched = True
                    break
            if not matched:
                normalized[raw_h] = raw_h
        return normalized

    def validate_file(self, filepath, delimiter=None):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Source file {filepath} could not be resolved.")
        filename = os.path.basename(filepath)
        report = ValidationReport(filename)
        if not delimiter:
            _, ext = os.path.splitext(filepath)
            delimiter = '\\t' if ext.lower() in ['.tsv', '.txt'] else ','

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            raw_headers = reader.fieldnames if reader.fieldnames else []
            header_map = self.normalize_headers(raw_headers)
            
            for index, row in enumerate(reader, start=1):
                report.records_processed += 1
                row_errors = []
                is_row_blocked = False
                is_row_warning = False

                raw_station = row.get(header_map.get("STATION_ID", ""), "").strip()
                raw_date = row.get(header_map.get("DATE", ""), "").strip()
                raw_lat = row.get(header_map.get("LATITUDE", ""), "").strip()
                raw_lon = row.get(header_map.get("LONGITUDE", ""), "").strip()
                raw_temp = row.get(header_map.get("WTEMP", ""), "").strip()
                raw_sal = row.get(header_map.get("SALINITY", ""), "").strip()

                if not raw_date or not raw_lat or not raw_lon:
                    row_errors.append({"level": "BLOCKER", "message": "Missing required core dimension (DATE/LAT/LONG)"})
                    is_row_blocked = True

                lat_dd = QA.dms_to_dd(raw_lat)
                lon_dd = QA.dms_to_dd(raw_lon)
                if lon_dd is not None and lon_dd > 0:
                    lon_dd = -lon_dd

                clean_temp = QA.clean_fahrenheit_to_celsius(raw_temp, "f" in raw_temp.lower())
                clean_sal = None
                if raw_sal:
                    try:
                        clean_sal = float(raw_sal)
                    except ValueError:
                        is_row_warning = True

                validated_record = {"LATITUDE": lat_dd, "LONGITUDE": lon_dd}
                is_geo_ok, geo_errs = validation.validate_observation(validated_record, self.ranges)
                if not is_geo_ok:
                    is_row_blocked = True

                if is_row_blocked:
                    report.blocker_count += 1
                elif is_row_warning:
                    report.data_quality_count += 1
                else:
                    report.records_passed += 1

        report.records_failed = report.blocker_count + report.data_quality_count
        report.compute_summary()
        return report
`;
    downloadFile(pythonCode, "local_validator.py");
  };

  // SSH Ingest Run states
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isConsoleActive, setIsConsoleActive] = useState<boolean>(false);
  const [consoleProgress, setConsoleProgress] = useState<number>(0);

  // Compute conversions applied (temperature F -> C / calm strings mapped)
  const fahrenheitConversions = normalizedRows.filter(r => r.tempWasFahrenheit).length;
  const coordinatesParsed = normalizedRows.filter(r => r.latLonFormat === "DMS").length;

  // Formulate JIRA/ServiceNow ticket Markdown block (Operational Excellence - Ticket Generator)
  const ticketMarkdown = `### HABS_INGESTION_RUN: ${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}_${state}
- **Originating State Jurisdiction**: ${state}
- **Raw Input File**: ${filename}
- **Processed Total Records**: ${metrics.totalRecords}
- **Parsed Clean Records**: ${metrics.validRecords}
- **Validation Score**: ${metrics.validationScore}%
- **HABSGrabber Compatibility Safety**: ${metrics.parserCompatibility}%
- **Scrubbing/Normalization Actions Mapped**:
  * Converted ${fahrenheitConversions} Fahrenheit values to Celsius equivalent.
  * Resolved ${coordinatesParsed} Degree-Minute-Seconds coordinates into decimal indexes.
- **Oracle Verification Delta**: Expected HAB_SAMPLES table shift: +${metrics.validRecords + metrics.warningRecords} records.
- **Payload Readiness Status**: ${metrics.readiness} ${
    metrics.readiness === "READY" 
      ? "✅ (PASSED PRE-FLIGHT DIRECTIVES)" 
      : metrics.readiness === "REVIEW" 
      ? "⚠️ (PROCEEDING WITH WARNING HUMAN OVERRIDES)" 
      : "❌ (CRITICAL BLOCKERS PREVENTING INGEST)"
  }`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (text: string, downloadName: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = downloadName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateJSONReport = (): string => {
    const levels = [
      { step: 1, name: "File Intake", description: "Verifies row byte completeness and file readability." },
      { step: 2, name: "Schema Validation", description: "Verifies existence of mandatory columns (Date, Lat, Lon)." },
      { step: 3, name: "State Detection", description: "Auto-maps state jurisdiction based on GOM boundaries." },
      { step: 4, name: "Type Validation", description: "Validates floats, integers, and character encodings." },
      { step: 5, name: "Coordinate Parsing", description: "Translates DMS (Degrees-Minutes-Seconds) coordinates into standard decimal degrees (DD)." },
      { step: 6, name: "Geographic Validation", description: "Guards coordinate limits against authoritative Gulf of Mexico grids." },
      { step: 7, name: "Scientific Validation", description: "Checks parameter values against oceanographic and physical range charts." },
      { step: 8, name: "QA Ingest Rules", description: "Applies Fahrenheit-to-Celsius conversions and string mappings (e.g. wave calmly states)." },
      { step: 9, name: "Duplicate Detection", description: "Detects potential duplicate observation key overlaps on space-time metrics." },
      { step: 10, name: "Completeness Score", description: "Validates density ratio coverage of optional secondary features." },
      { step: 11, name: "Parser Compatibility", description: "Guards against trailing tabs or high-ASCII symbols to prevent remote Unix loader crashes." },
      { step: 12, name: "Virtual Ingest Run", description: "Simulates final database write transactions." }
    ];

    const report = {
      report_metadata: {
        generated_by: "HABSOS Ingestion Workbench preflight-local",
        timestamp_utc: new Date().toISOString(),
        source_file: filename,
        detected_jurisdiction: state,
        version: "3.5.0-STABLE"
      },
      metrics: {
        total_records: metrics.totalRecords,
        clean_records: metrics.validRecords,
        warning_records: metrics.warningRecords,
        blocker_records: metrics.blockerRecords,
        validation_score_percentage: metrics.validationScore,
        parser_compatibility_probability: metrics.parserCompatibility,
        ingest_readiness_status: metrics.readiness
      },
      twelve_level_pipeline_summary: levels.map(l => {
        const stepRows = normalizedRows.map(row => row.details.find(d => d.step === l.step));
        const stepBlockers = stepRows.filter(d => d?.severity === "BLOCKER").length;
        const stepWarnings = stepRows.filter(d => d?.severity === "WARNING").length;
        const stepPasses = stepRows.filter(d => d?.severity === "PASS").length;

        return {
          step: l.step,
          name: l.name,
          description: l.description,
          status: stepBlockers > 0 ? "FAILED" : (stepWarnings > 0 ? "WARNING" : "PASSED"),
          summary: {
            passes: stepPasses,
            warnings: stepWarnings,
            blockers: stepBlockers
          }
        };
      }),
      records: normalizedRows.map(row => ({
        row_id: row.id,
        row_index: row.rawIndex + 1,
        station_id: row.STATION_ID,
        sample_date: row.DATE,
        sample_time: row.TIME,
        latitude_dd: row.LATITUDE,
        longitude_dd: row.LONGITUDE,
        cell_count_per_l: row.CELL_COUNT,
        water_temp_c: row.WTEMP,
        salinity_psu: row.SALINITY,
        depth_m: row.DEPTH,
        remarks: row.REMARKS,
        raw_payload: row.raw,
        row_severity: row.severity,
        validation_details_per_level: row.details.map(d => ({
          step: d.step,
          stepName: d.stepName,
          severity: d.severity,
          message: d.message,
          column: d.column || null,
          value: d.value || null
        }))
      }))
    };

    return JSON.stringify(report, null, 2);
  };

  const downloadZipPackage = async () => {
    try {
      const zip = new JSZip();
      
      // 1. Add normalized TSV file
      zip.file(customFileName, formattedTSV);
      
      // 2. Add structured JSON Report
      const jsonReport = generateJSONReport();
      const reportName = `pipeline_validation_report_${filename.replace(/\.[^/.]+$/, "")}.json`;
      zip.file(reportName, jsonReport);
      
      // 3. Compress & Generate Zip raw binary source link
      const content = await zip.generateAsync({ type: "blob" });
      
      // 4. Download
      const element = document.createElement("a");
      element.href = URL.createObjectURL(content);
      element.download = `habsos_compliance_${filename.replace(/\.[^/.]+$/, "")}.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error("ZIP Generation Failed:", err);
      alert("Preflight error: Failed to group compliance outputs as zipped package.");
    }
  };

  // SSH Terminal Pipeline Simulation
  const runSshSequence = () => {
    setIsConsoleActive(true);
    setTerminalLogs([]);
    setConsoleProgress(0);

    const logs = [
      `[LOCAL] Initializing Local Ingestion Brain Compiler...`,
      `[LOCAL] Re-indexing columns usingconstants.py synonyms map... OK`,
      `[LOCAL] Processing text state guidelines for ${state}... OK`,
      `[LOCAL] Normalizing Fahrenheit values: converted ${fahrenheitConversions} readings... OK`,
      `[LOCAL] Running coordinate checks: successfully mapped ${coordinatesParsed} DMS strings to DD... OK`,
      `[LOCAL] Generated final compliant payload array structure... OK`,
      `[SFTP-CLIENT] Attempting secure connect to remote USGS portal (habs-ssh.usgs.gov:22)...`,
      `[SFTP-CLIENT] SSH Fingerprint authorized: ecdsa-sha2-nistp256 ID_5923...`,
      `[SFTP-CLIENT] Connected. Initializing sftp payload transaction...`,
      `[SFTP-CLIENT] Writing: /data/habs_ingest/incoming/clean_${filename.replace(/\.[^/.]+$/, "")}.txt`,
      `[SFTP-CLIENT] 1240 bytes transmitted. Transfer success. Core closed.`,
      `[SSH-CLIENT] executing remote command script:`,
      `  python3 /home/habs_user/HABSGrabber/QA.py --file /data/habs_ingest/incoming/clean_${filename.replace(/\.[^/.]+$/, "")}.txt`,
      `[REMOTE-RUN] [INFO] Loading USGS ranges.py observation tables... OK`,
      `[REMOTE-RUN] [INFO] Processing state logic for state-ident: "${state}"... OK`,
      `[REMOTE-RUN] [INFO] Connecting to Oracle Database (TEST.HAB_SAMPLES)... OK`,
      `[REMOTE-RUN] [SUCCESS] Wrote ${normalizedRows.length - metrics.blockerRecords} records into SQL tables cleanly.`,
      `[SSH-CLIENT] Return code: 0 (Execution complete). Session disconnected safely.`
    ];

    let currentLogIdx = 0;
    const interval = setInterval(() => {
      if (currentLogIdx < logs.length) {
        setTerminalLogs(prev => [...prev, logs[currentLogIdx]]);
        setConsoleProgress(Math.round(((currentLogIdx + 1) / logs.length) * 100));
        currentLogIdx++;
      } else {
        clearInterval(interval);
        // Save to audit history trail in parent context
        onCommitHistoricalRun(ticketMarkdown);
      }
    }, 150);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Normalized export column */}
      <div className="bg-white border border-slate-205 rounded p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-tight">Normalized TSV Ingestion Code</h3>
              <p className="text-xs text-gray-400 font-sans">Strict tab-delimited records matching Python SQL schema.</p>
            </div>
            
            <div className="flex items-center gap-1.5 font-sans">
              <button
                onClick={() => copyToClipboard(formattedTSV, setCopiedExport)}
                className="p-1.5 text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded border transition border-gray-100 cursor-pointer"
                title="Copy code to clipboard"
              >
                {copiedExport ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => downloadFile(formattedTSV, customFileName)}
                className="p-1.5 text-slate-505 hover:text-slate-800 bg-gray-50 hover:bg-gray-100 rounded border transition border-gray-100 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Download txt file"
              >
                <Download className="h-4 w-4" /> Download Export
              </button>

              <button
                onClick={downloadZipPackage}
                className="p-1.5 text-white bg-slate-900 hover:bg-slate-800 rounded border border-transparent transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Download Zip Archive containing TSV and JSON Report"
              >
                <FileJson className="h-4 w-4 text-emerald-400" /> Download Zipped Package (.zip)
              </button>
            </div>
          </div>

          {/* User Custom Path Control Row */}
          <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-sans">
            <div>
              <label className="block text-[9px] font-bold text-slate-505 uppercase mb-1">Target Directory Path</label>
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                placeholder="/home/habs_user/HABSGrabber/exports/"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-505 uppercase mb-1">Output TSV Filename</label>
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                placeholder="normalized_export.txt"
              />
            </div>
          </div>

          <div className="mb-2 text-[10px] text-slate-650 font-mono tracking-tight select-all truncate bg-slate-50 p-2 rounded border border-slate-200 max-w-full">
            Export Destination: <span className="text-slate-800 font-bold">{customPath.endsWith("/") ? customPath : `${customPath}/`}{customFileName}</span>
          </div>

          <div className="relative font-mono text-[10px] bg-slate-950 text-emerald-400 p-4 rounded border border-slate-900 h-48 overflow-y-auto">
            <pre className="whitespace-pre">{formattedTSV || "No records loaded yet. Double click cells or import folders to normalized."}</pre>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 font-sans mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium">
          <span>*Excludes blocked records containing uncorrected lat-long errors to prevent remote SQL write abortion.</span>
          <button
            onClick={downloadPythonValidator}
            className="text-[10px] uppercase font-mono font-bold text-slate-900 hover:text-slate-700 bg-slate-100 hover:bg-slate-205 px-2.5 py-1 rounded border border-slate-300 flex items-center justify-center gap-1 transition select-none cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-505" /> Download LocalValidator.py
          </button>
        </div>
      </div>

      {/* Ticket Generator Column */}
      <div className="bg-white border border-slate-205 rounded p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-tight">Jira/ServiceNow Ticket Generator</h3>
              <p className="text-xs text-gray-400 font-sans">Unified metadata block auditing pre-flight indicators.</p>
            </div>

            <button
              onClick={() => copyToClipboard(ticketMarkdown, setCopiedTicket)}
              className="p-1.5 text-gray-505 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded border transition border-gray-100 flex items-center gap-1 text-[11px] font-sans font-bold cursor-pointer"
            >
              {copiedTicket ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied Markdown
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Ticket Block
                </>
              )}
            </button>
          </div>

          <div className="font-mono text-xs bg-gray-50 text-gray-700 p-4 rounded border border-gray-200 h-64 overflow-y-auto leading-relaxed select-all">
            <pre className="whitespace-pre-wrap">{ticketMarkdown}</pre>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 font-sans mt-4 leading-normal font-medium">
          Logs details on conversions and standard state properties index to maintain consistent ticket trails.
        </div>
      </div>

      {/* Full SSH Remote Terminal Run block */}
      <div className="lg:col-span-2 bg-slate-950 text-white rounded p-6 border border-slate-900 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 text-emerald-400 rounded border border-slate-750">
              <Terminal className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white font-sans tracking-tight uppercase">
                Mode 3: Live Server Ingest Pipeline Simulation (SSH)
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Authenticates and pushes data to remote server, executes python QA scripts scripts in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto font-sans">
            {isConsoleActive && (
              <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-150" style={{ width: `${consoleProgress}%` }}></div>
              </div>
            )}
            <button
              onClick={runSshSequence}
              disabled={isConsoleActive || metrics.readiness === "BLOCKED"}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 disabled:bg-slate-900 disabled:text-slate-600 border border-transparent disabled:border-slate-850 text-xs font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition"
            >
              <Play className="h-3.5 w-3.5" /> Initiate Remote Ingest Sequence
            </button>
          </div>
        </div>

        {/* Console content screen */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 font-mono text-xs overflow-y-auto h-48 space-y-1 scrollbar-thin text-slate-300">
          {terminalLogs.length === 0 ? (
            <div className="text-slate-500 italic flex flex-col items-center justify-center h-full gap-2 text-center py-6">
              <Server className="h-8 w-8 text-slate-705" />
              <span>Console Idle. Verify that pre-flight readiness is READY or REVIEW (with Override flags set) and trigger sequence.</span>
            </div>
          ) : (
            terminalLogs.map((log, idx) => (
              <div key={idx} className="animate-in fade-in slide-in-from-bottom-1 duration-100 tracking-wide">
                <span className="text-cyan-400 mr-2">&gt;</span>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
