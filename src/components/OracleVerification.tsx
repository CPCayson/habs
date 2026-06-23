import React, { useState, useEffect } from "react";
import { NormalizedRow, IngestionMetrics, DbEnvironment } from "../types/habs";
import { Database, AlertTriangle, RefreshCw, BarChart2, CheckCircle2, ShieldAlert, ArrowRight, HelpCircle } from "lucide-react";

interface OracleVerificationProps {
  metrics: IngestionMetrics;
  normalizedRows: NormalizedRow[];
  activeState: string;
}

// Baseline mock DB environment structures matching DEV, TEST, PROD schemas (Pre-Run)
const DATABASE_MODELS: { [envName: string]: DbEnvironment } = {
  DEV: {
    name: "DEV",
    HAB_SAMPLES: { rowCount: 14205, lastUpdated: "2026-06-22 17:12:04", lastDdlTime: "2026-04-10", schemaVersion: "v2.5.4", maxSampleDate: "2026-06-22" },
    STATION_METADATA: { rowCount: 840, lastUpdated: "2026-06-22 09:15:00", lastDdlTime: "2026-03-01", schemaVersion: "v1.2.0", maxSampleDate: "2026-06-22" },
    QA_LOGS: { rowCount: 3504, lastUpdated: "2026-06-22 17:12:04", lastDdlTime: "2026-04-10", schemaVersion: "v2.5.4", maxSampleDate: "2026-06-22" },
  },
  TEST: {
    name: "TEST",
    HAB_SAMPLES: { rowCount: 13950, lastUpdated: "2026-06-21 12:45:10", lastDdlTime: "2026-04-12", schemaVersion: "v2.5.4", maxSampleDate: "2026-06-20" },
    STATION_METADATA: { rowCount: 835, lastUpdated: "2026-06-21 12:00:00", lastDdlTime: "2026-03-01", schemaVersion: "v1.2.0", maxSampleDate: "2026-06-20" },
    QA_LOGS: { rowCount: 3410, lastUpdated: "2026-06-21 12:45:10", lastDdlTime: "2026-04-12", schemaVersion: "v2.5.4", maxSampleDate: "2026-06-20" },
  },
  PROD: {
    name: "PROD",
    HAB_SAMPLES: { rowCount: 145880, lastUpdated: "2026-06-22 18:30:15", lastDdlTime: "2026-01-15", schemaVersion: "v2.5.2", maxSampleDate: "2026-06-22" },
    STATION_METADATA: { rowCount: 1240, lastUpdated: "2026-06-21 04:22:00", lastDdlTime: "2025-11-20", schemaVersion: "v1.1.8", maxSampleDate: "2026-06-21" },
    QA_LOGS: { rowCount: 22105, lastUpdated: "2026-06-22 18:30:15", lastDdlTime: "2026-01-15", schemaVersion: "v2.5.2", maxSampleDate: "2026-06-22" },
  }
};

export default function OracleVerification({ metrics, normalizedRows, activeState }: OracleVerificationProps) {
  const [activeEnvironment, setActiveEnvironment] = useState<"DEV" | "TEST" | "PROD">("DEV");
  const [isSimulatedPostIngest, setIsSimulatedPostIngest] = useState<boolean>(false);
  const [anomalySimulation, setAnomalySimulation] = useState<boolean>(false);
  
  // Calculate potential valid insertions (excluding blocker records)
  const expectedInsertions = normalizedRows.filter(row => row.severity !== "BLOCKER").length;
  
  // Simulated row discrepancy (Pre-flight thought: "If expected rows is 150 but actual inserts are 148 due to relational conflicts")
  const actualDBDelta = anomalySimulation ? Math.max(0, expectedInsertions - 2) : expectedInsertions;
  const isMismatch = isSimulatedPostIngest && expectedInsertions !== actualDBDelta;

  const currentDatabase = DATABASE_MODELS[activeEnvironment];

  // Refresh trigger simulation
  const triggerSimulationRun = () => {
    setIsSimulatedPostIngest(true);
  };

  const resetSimulation = () => {
    setIsSimulatedPostIngest(false);
    setAnomalySimulation(false);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 text-white rounded p-6 shadow-sm relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-44 h-44 bg-slate-850 rounded-full blur-[80px]" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">Oracle Relational System Monitor</span>
            <h1 className="text-xl font-bold font-sans tracking-tight uppercase">Stage 5: Continuous Post-Ingest Verification</h1>
            <p className="text-xs text-slate-400 font-sans leading-relaxed max-w-2xl font-medium">
              Verification evaluates exact Oracle database schemas post-execution. It compares predicted local records with row metrics to ensure data integrity.
            </p>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700/85">
            {(["DEV", "TEST", "PROD"] as const).map(env => (
              <button
                key={env}
                onClick={() => {
                  setActiveEnvironment(env);
                  resetSimulation();
                }}
                className={`px-3 py-1.5 text-xs font-bold font-sans rounded uppercase transition-all cursor-pointer ${
                  activeEnvironment === env 
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid comparison cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Verification Control Console */}
        <div className="bg-white border border-slate-205 rounded p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-tight flex items-center gap-2">
              <Database className="h-4.5 w-4.5 text-slate-800 font-bold" />
              Ingestion Verification Delta Console
            </h3>
            
            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center font-medium">
                <span className="text-slate-500 font-bold">Local File Records count:</span>
                <span className="font-mono text-slate-800 font-bold">{normalizedRows.length}</span>
              </div>
              <div className="flex justify-between items-center font-medium">
                <span className="text-slate-500 font-bold">Expected Ingestion rows (non-blocked):</span>
                <span className="font-mono text-emerald-600 font-bold">+{expectedInsertions}</span>
              </div>
              
              <div className="border-t border-slate-200 pt-2 mt-1 space-y-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-600 font-bold select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anomalySimulation}
                    disabled={isSimulatedPostIngest}
                    onChange={(e) => setAnomalySimulation(e.target.checked)}
                    className="rounded border-slate-350 text-slate-800 focus:ring-slate-500"
                  />
                  <span>Simulate DB Collision (Discrepancy Alarm)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {!isSimulatedPostIngest ? (
                <button
                  onClick={triggerSimulationRun}
                  disabled={expectedInsertions === 0}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-xs rounded uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <RefreshCw className="h-4 w-4" /> Compare Oracle Snapshot Deltas
                </button>
              ) : (
                <button
                  onClick={resetSimulation}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-205 text-slate-700 font-semibold text-xs rounded uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer transition border border-slate-200"
                >
                  Reset Baseline Snapshot
                </button>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-sans mt-4 leading-normal font-medium">
            *Snapshot takes row size delta indicators before and after the transaction committing sequences to isolate silent ingest rejections.
          </p>
        </div>

        {/* Database table snapshots panels (Pre vs Post comparison render) */}
        <div className="lg:col-span-2 bg-white border border-slate-205 rounded p-6 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-slate-800 font-sans uppercase tracking-tight">
              Snapshot Comparison Metrics ({activeEnvironment})
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-700 rounded font-mono px-2 py-0.5 border border-slate-200">
              Schema version: {currentDatabase.HAB_SAMPLES.schemaVersion}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pre Ingest Column */}
            <div className="border border-slate-200 rounded p-4 bg-slate-50/50">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">Pre-Ingest Baseline Database</div>
              
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2 bg-white rounded border border-slate-150">
                  <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: HAB_SAMPLES</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-slate-850 font-bold text-sm">{currentDatabase.HAB_SAMPLES.rowCount.toLocaleString()} rows</span>
                    <span className="text-[9px] text-slate-400">Date: {currentDatabase.HAB_SAMPLES.maxSampleDate}</span>
                  </div>
                </div>

                <div className="p-2 bg-white rounded border border-slate-150">
                  <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: STATION_METADATA</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-slate-850 font-bold text-sm">{currentDatabase.STATION_METADATA.rowCount.toLocaleString()} rows</span>
                    <span className="text-[9px] text-slate-400">DDL Dt: {currentDatabase.STATION_METADATA.lastDdlTime}</span>
                  </div>
                </div>

                <div className="p-2 bg-white rounded border border-slate-150">
                  <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: QA_LOGS</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-slate-850 font-bold text-sm">{currentDatabase.QA_LOGS.rowCount.toLocaleString()} entries</span>
                    <span className="text-[9px] text-slate-400">Update: {currentDatabase.QA_LOGS.lastUpdated.split(" ")[1]}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Post Ingest Column (Simulated Live comparison) */}
            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <div className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Post-Ingest Oracle State</span>
                {isSimulatedPostIngest && <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-sans uppercase font-bold tracking-tight border border-emerald-200">Delta Computed</span>}
              </div>

              {!isSimulatedPostIngest ? (
                <div className="h-44 border border-dashed border-slate-250 rounded flex flex-col items-center justify-center text-center p-4">
                  <span className="text-xs text-slate-400 font-sans font-bold">Click "Compare Oracle Snapshot Deltas" to verify database integration values</span>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-[11px] animate-in fade-in slide-in-from-right-3 duration-200">
                  {/* HAB_SAMPLES */}
                  <div className="p-2 bg-white rounded border border-slate-200 relative overflow-hidden">
                    <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: HAB_SAMPLES</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-slate-850 font-extrabold text-sm">
                        {(currentDatabase.HAB_SAMPLES.rowCount + actualDBDelta).toLocaleString()} rows
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold font-mono">
                        +{actualDBDelta} rows
                      </span>
                    </div>
                  </div>

                  {/* STATION_METADATA */}
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: STATION_METADATA</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-slate-850 font-extrabold text-sm">
                        {currentDatabase.STATION_METADATA.rowCount.toLocaleString()} rows
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        +0 (No STN change)
                      </span>
                    </div>
                  </div>

                  {/* QA_LOGS */}
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <div className="flex justify-between text-slate-500 font-sans text-[10px] font-bold uppercase">TABLE: QA_LOGS</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-slate-850 font-extrabold text-sm">
                        {/* We add QA logs entries for conversions of temps or out of bound warnings */}
                        {(currentDatabase.QA_LOGS.rowCount + metrics.warningRecords).toLocaleString()} entries
                      </span>
                      <span className={`text-[10px] font-bold font-mono ${metrics.warningRecords > 0 ? "text-amber-500" : "text-slate-400"}`}>
                        +{metrics.warningRecords} checks
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discrepancy alarm alerts (The Difference Engine alarm) */}
      {isSimulatedPostIngest && (
        <div className="animate-in slide-in-from-bottom-2 duration-150">
          {isMismatch ? (
            <div className="bg-rose-50 border border-rose-200 rounded p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-3 bg-white rounded shadow-xs border border-rose-100 text-rose-500 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-rose-900 font-sans tracking-tight uppercase">DISCREPANCY ALERT: Oracle Relational Rejection Isolate</h4>
                <p className="text-xs text-rose-700 leading-relaxed font-sans font-bold">
                  Relational Match failure. Preflight expected <span className="font-bold font-mono">{expectedInsertions}</span> rows inserted, but Oracle row increase is only <span className="font-bold font-mono">{actualDBDelta}</span>. Missing <span className="font-bold font-mono">2 records</span>.
                </p>
                <div className="text-[10px] text-rose-600 font-mono mt-2 bg-white/70 p-2 rounded border border-rose-100 max-w-2xl leading-normal font-medium">
                  REASON FOR ERROR: Unique Constraint Violation on `PK_HAB_SAMPLES` [STN_ID = "AL-BLOCK-04", TIMESTAMP = "2026-06-18 07:30:00"]. An identical spatial-temporal observations index already occupies row allocation inside Oracle test table space.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-250 rounded p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-3 bg-white rounded shadow-xs border border-emerald-100 text-emerald-500 shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-900 font-sans tracking-tight uppercase">Database Integrity Validated Successfully</h4>
                <p className="text-xs text-emerald-700 font-sans leading-relaxed font-medium">
                  Both preflight metrics and Oracle row counters coincide flawlessly (expected <span className="font-bold font-mono">+{expectedInsertions}</span> records, inserted <span className="font-bold font-mono">+{actualDBDelta}</span> into transactional table indices).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEV vs TEST Comparison grid */}
      <div className="bg-white border border-slate-205 rounded p-6 shadow-xs">
        <h3 className="text-sm font-extrabold text-slate-800 font-sans uppercase tracking-tight mb-3">
          Relational Environments Alignment Monitor
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-2">
            <h4 className="font-extrabold text-xs text-slate-700 uppercase font-sans tracking-wider">DEV Table Properties</h4>
            <ul className="text-xs font-mono text-slate-600 space-y-1 pl-1 list-none font-sans font-medium">
              <li>• Main table row capacity: <span className="font-bold text-slate-800">14,205 rows</span></li>
              <li>• Table schema state: <span className="font-bold text-slate-800">Clob format mapped</span></li>
              <li>• Constraints: <span className="font-bold text-slate-800">PK_HAB_SAMPLES UNIQUE (STN, TS)</span></li>
            </ul>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-2">
            <h4 className="font-extrabold text-xs text-slate-705 uppercase font-sans tracking-wider">TEST Table Properties</h4>
            <ul className="text-xs font-mono text-slate-600 space-y-1 pl-1 list-none font-sans font-medium">
              <li>• Main table row capacity: <span className="font-bold text-slate-800">13,950 rows</span></li>
              <li>• Table schema state: <span className="font-bold text-slate-800">Clob format mapped (Synchronized)</span></li>
              <li>• Alignment: DEV matches Test table constraint specs perfectly.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
