import React, { useState, useMemo } from "react";
import { AuditRecord, NormalizedRow } from "../types/habs";
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Plus, 
  Minus, 
  Edit, 
  Search, 
  Info,
  ChevronRight,
  ChevronDown
} from "lucide-react";

interface RunDiffProps {
  auditRuns: AuditRecord[];
}

export default function RunDiff({ auditRuns }: RunDiffProps) {
  const [runAId, setRunAId] = useState<string>("");
  const [runBId, setRunBId] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "added" | "removed" | "modified" | "flagged">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Auto-select defaults on load
  React.useEffect(() => {
    if (auditRuns.length >= 2) {
      if (!runAId) setRunAId(auditRuns[1].id);
      if (!runBId) setRunBId(auditRuns[0].id);
    } else if (auditRuns.length === 1) {
      if (!runAId) setRunAId(auditRuns[0].id);
    }
  }, [auditRuns, runAId, runBId]);

  const runA = useMemo(() => auditRuns.find(r => r.id === runAId), [auditRuns, runAId]);
  const runB = useMemo(() => auditRuns.find(r => r.id === runBId), [auditRuns, runBId]);

  // Compute the comprehensive line-by-line diff
  const diffResults = useMemo(() => {
    if (!runA || !runB) return null;

    const rowsA = runA.rows || [];
    const rowsB = runB.rows || [];

    const mapA = new Map<string, NormalizedRow>();
    rowsA.forEach((row, idx) => {
      // Use Station ID or fallback to stable index key
      const key = row.STATION_ID?.trim() || `row-idx-${idx}`;
      mapA.set(key, row);
    });

    const mapB = new Map<string, NormalizedRow>();
    rowsB.forEach((row, idx) => {
      const key = row.STATION_ID?.trim() || `row-idx-${idx}`;
      mapB.set(key, row);
    });

    const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

    interface RowDiffItem {
      key: string;
      stationId: string;
      type: "added" | "removed" | "modified" | "unchanged";
      flagStatusChanged: boolean;
      rowA?: NormalizedRow;
      rowB?: NormalizedRow;
      changedFields: string[];
    }

    const items: RowDiffItem[] = [];

    allKeys.forEach(key => {
      const rowA = mapA.get(key);
      const rowB = mapB.get(key);

      if (rowA && !rowB) {
        items.push({
          key,
          stationId: rowA.STATION_ID || "UNKNOWN",
          type: "removed",
          flagStatusChanged: rowA.severity !== "PASS",
          rowA,
          changedFields: []
        });
      } else if (!rowA && rowB) {
        items.push({
          key,
          stationId: rowB.STATION_ID || "UNKNOWN",
          type: "added",
          flagStatusChanged: rowB.severity !== "PASS",
          rowB,
          changedFields: []
        });
      } else if (rowA && rowB) {
        // Find specific physical changes
        const changedFields: string[] = [];
        if (rowA.DATE !== rowB.DATE) changedFields.push("Date");
        if (rowA.TIME !== rowB.TIME) changedFields.push("Time");
        if (rowA.LATITUDE !== rowB.LATITUDE) changedFields.push("Latitude");
        if (rowA.LONGITUDE !== rowB.LONGITUDE) changedFields.push("Longitude");
        if (rowA.WTEMP !== rowB.WTEMP) changedFields.push("Water Temp");
        if (rowA.SALINITY !== rowB.SALINITY) changedFields.push("Salinity");
        if (rowA.CELL_COUNT !== rowB.CELL_COUNT) changedFields.push("Cell Count");
        if (rowA.DEPTH !== rowB.DEPTH) changedFields.push("Depth");
        if (rowA.REMARKS !== rowB.REMARKS) changedFields.push("Remarks");

        const flagStatusChanged = rowA.severity !== rowB.severity;
        const isModified = changedFields.length > 0;

        items.push({
          key,
          stationId: rowA.STATION_ID || "UNKNOWN",
          type: isModified ? "modified" : "unchanged",
          flagStatusChanged,
          rowA,
          rowB,
          changedFields
        });
      }
    });

    // Counts
    const addedCount = items.filter(i => i.type === "added").length;
    const removedCount = items.filter(i => i.type === "removed").length;
    const modifiedCount = items.filter(i => i.type === "modified").length;
    const flaggedChangeCount = items.filter(i => i.flagStatusChanged && i.type !== "added" && i.type !== "removed").length;

    return {
      items,
      addedCount,
      removedCount,
      modifiedCount,
      flaggedChangeCount
    };
  }, [runA, runB]);

  // Filtering & Search
  const filteredItems = useMemo(() => {
    if (!diffResults) return [];

    return diffResults.items.filter(item => {
      // 1. Filter Type check
      if (filterType === "added" && item.type !== "added") return false;
      if (filterType === "removed" && item.type !== "removed") return false;
      if (filterType === "modified" && item.type !== "modified") return false;
      if (filterType === "flagged" && !item.flagStatusChanged) return false;

      // 2. Search Query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesStation = item.stationId.toLowerCase().includes(query);
        const matchesRemarks = (item.rowA?.REMARKS?.toLowerCase().includes(query) || false) || 
                               (item.rowB?.REMARKS?.toLowerCase().includes(query) || false);
        return matchesStation || matchesRemarks;
      }

      return true;
    });
  }, [diffResults, filterType, searchQuery]);

  if (auditRuns.length < 2) {
    return (
      <div className="bg-white border border-slate-200 rounded p-6 sm:p-10 text-center max-w-lg mx-auto my-12 shadow-sm">
        <ArrowLeftRight className="h-10 w-10 text-slate-400 mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider font-mono">Insufficient Historical Records</h3>
        <p className="text-xs text-slate-500 mt-2 font-sans">
          The visual diff analyzer requires at least two distinct committed audit runs in the local directory trail. Save a pre-flight run to build comparative data.
        </p>
      </div>
    );
  }

  return (
    <div id="diff-workbench-container" className="space-y-6">
      
      {/* Run Selection Panel */}
      <div className="bg-white border border-slate-200 p-4 rounded shadow-xs">
        <div className="border-b border-slate-100 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-sans uppercase tracking-wider flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4 text-emerald-500" /> Comparison Selection Engine
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Compare two ingested runs side-by-side to track telemetry shifts.</p>
          </div>
          <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase shrink-0 self-start sm:self-auto">
            active comparison
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Run A (Source Stage) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Run A - Reference Baseline</label>
            <select
              value={runAId}
              onChange={(e) => setRunAId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            >
              {auditRuns.map(r => (
                <option key={r.id} value={r.id}>
                  [{r.timestamp}] {r.filename} — {r.state} ({r.recordsCount} rcs, {r.validationScore}% score)
                </option>
              ))}
            </select>
          </div>

          {/* Run B (Audit Stage) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Run B - Target Comparison</label>
            <select
              value={runBId}
              onChange={(e) => setRunBId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            >
              {auditRuns.map(r => (
                <option key={r.id} value={r.id}>
                  [{r.timestamp}] {r.filename} — {r.state} ({r.recordsCount} rcs, {r.validationScore}% score)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate Diff KPI Cards */}
      {diffResults && runA && runB && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 border-l-4 border-emerald-500 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                <Plus className="h-3 w-3 text-emerald-500" /> Records Added
              </div>
              <div className="text-slate-900 font-black text-xl tracking-tight">
                +{diffResults.addedCount}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 mt-2">New entities present only in Run B</div>
          </div>

          <div className="bg-white p-4 border-l-4 border-rose-500 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                <Minus className="h-3 w-3 text-rose-500" /> Records Removed
              </div>
              <div className="text-slate-900 font-black text-xl tracking-tight">
                -{diffResults.removedCount}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 mt-2 font-sans">Entities deleted from reference Run A</div>
          </div>

          <div className="bg-white p-4 border-l-4 border-amber-500 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                <Edit className="h-3.5 w-3.5 text-amber-500" /> Telemetry Modified
              </div>
              <div className="text-slate-900 font-black text-xl tracking-tight">
                {diffResults.modifiedCount}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 mt-2 font-sans">Matching key nodes with cell count/temp updates</div>
          </div>

          <div className="bg-white p-4 border-l-4 border-indigo-500 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-indigo-500" /> Flag Status Shunted
              </div>
              <div className="text-slate-900 font-black text-xl tracking-tight">
                {diffResults.flaggedChangeCount}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 mt-2 font-sans">Severity changed (e.g., warned vs passed)</div>
          </div>
        </section>
      )}

      {/* Filter and Table Core */}
      {diffResults && runA && runB && (
        <div className="bg-white border border-slate-200 rounded shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-205 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer select-none ${
                  filterType === "all" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-650 hover:bg-slate-100"
                }`}
              >
                All Rows ({diffResults.items.length})
              </button>
              <button
                onClick={() => setFilterType("added")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer select-none flex items-center gap-1 ${
                  filterType === "added" ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-emerald-650 hover:bg-slate-100"
                }`}
              >
                Added (+{diffResults.addedCount})
              </button>
              <button
                onClick={() => setFilterType("removed")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer select-none flex items-center gap-1 ${
                  filterType === "removed" ? "bg-rose-500 text-white" : "bg-white border border-slate-200 text-rose-650 hover:bg-slate-100"
                }`}
              >
                Removed (-{diffResults.removedCount})
              </button>
              <button
                onClick={() => setFilterType("modified")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer select-none flex items-center gap-1 ${
                  filterType === "modified" ? "bg-amber-500 text-slate-900" : "bg-white border border-slate-200 text-amber-650 hover:bg-slate-100"
                }`}
              >
                Modified ({diffResults.modifiedCount})
              </button>
              <button
                onClick={() => setFilterType("flagged")}
                className={`px-3 py-1 text-[11px] font-bold rounded cursor-pointer select-none flex items-center gap-1 ${
                  filterType === "flagged" ? "bg-indigo-500 text-white" : "bg-white border border-slate-200 text-indigo-650 hover:bg-slate-100"
                }`}
              >
                Flag Shift ({diffResults.flaggedChangeCount})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search station..."
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Results Table list */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Station ID</th>
                  <th className="p-3 text-center w-28">Diff Type</th>
                  <th className="p-3">Run A Status</th>
                  <th className="p-3">Run B Status</th>
                  <th className="p-3 text-right">Modified fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-750">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      No matching records found comparing selected run paths.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const isExpanded = expandedRow === item.key;
                    
                    const typeBadge = {
                      added: "bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold text-[9px]",
                      removed: "bg-rose-50 text-rose-700 border-rose-100 font-extrabold text-[9px]",
                      modified: "bg-amber-50 text-amber-700 border-amber-100 font-extrabold text-[9px]",
                      unchanged: "bg-slate-50 text-slate-450 border-slate-100 text-[9px]"
                    }[item.type];

                    const statusBadgeA = item.rowA ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.rowA.severity === "PASS" ? "bg-emerald-50 text-emerald-700" :
                        item.rowA.severity === "WARNING" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {item.rowA.severity}
                      </span>
                    ) : <span className="text-slate-350 font-mono text-[10px]">NON-EXISTENT</span>;

                    const statusBadgeB = item.rowB ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.rowB.severity === "PASS" ? "bg-emerald-50 text-emerald-700" :
                        item.rowB.severity === "WARNING" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      } ${item.flagStatusChanged ? "ring-2 ring-indigo-400" : ""}`}>
                        {item.rowB.severity}
                      </span>
                    ) : <span className="text-slate-350 font-mono text-[10px]">DELETED</span>;

                    return (
                      <React.Fragment key={item.key}>
                        <tr 
                          onClick={() => setExpandedRow(isExpanded ? null : item.key)}
                          className={`hover:bg-slate-50/75 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50" : ""}`}
                        >
                          <td className="p-3 text-slate-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">
                            {item.stationId}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-sm border uppercase ${typeBadge}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3">{statusBadgeA}</td>
                          <td className="p-3">{statusBadgeB}</td>
                          <td className="p-3 text-right max-w-xs truncate text-[10.5px] font-mono text-slate-500">
                            {item.type === "modified" && item.changedFields.length > 0 ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                {item.changedFields.join(", ")}
                              </span>
                            ) : item.type === "added" ? (
                              <span className="text-emerald-500 italic font-sans">Full record ingested +</span>
                            ) : item.type === "removed" ? (
                              <span className="text-rose-400 italic line-through font-sans">Dropped from target</span>
                            ) : (
                              <span className="text-slate-350 italic">No delta</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="p-4 sm:p-6 border-t border-slate-100">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                
                                {/* Old State Run A */}
                                <div className="space-y-2 border border-slate-205 p-3 rounded bg-white">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider flex justify-between">
                                    <span>Run A: {runA.filename} (Original)</span>
                                    {item.rowA && <span className="text-slate-600 font-bold">Index #{item.rowA.rawIndex + 1}</span>}
                                  </div>
                                  {item.rowA ? (
                                    <div className="space-y-1.5 font-mono text-[11px] text-slate-755 divide-y divide-slate-100">
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Date:</span> <span>{item.rowA.DATE}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Time:</span> <span>{item.rowA.TIME}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Latitude:</span> <span className={item.changedFields.includes("Latitude") ? "bg-rose-50 text-rose-700 px-1 rounded font-bold" : ""}>{item.rowA.LATITUDE ?? "null"} ({item.rowA.originalLat || "raw"})</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Longitude:</span> <span className={item.changedFields.includes("Longitude") ? "bg-rose-50 text-rose-700 px-1 rounded font-bold" : ""}>{item.rowA.LONGITUDE ?? "null"} ({item.rowA.originalLon || "raw"})</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Temp:</span> <span className={item.changedFields.includes("Water Temp") ? "bg-rose-50 text-rose-700 px-1 rounded font-bold" : ""}>{item.rowA.WTEMP !== null ? `${item.rowA.WTEMP}°C` : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Salinity:</span> <span className={item.changedFields.includes("Salinity") ? "bg-rose-50 text-rose-700 px-1 rounded font-bold" : ""}>{item.rowA.SALINITY !== null ? `${item.rowA.SALINITY} psu` : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Cell Count:</span> <span className={item.changedFields.includes("Cell Count") ? "bg-rose-50 text-rose-700 px-1 rounded font-bold" : ""}>{item.rowA.CELL_COUNT !== null ? item.rowA.CELL_COUNT.toLocaleString() : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Remarks:</span> <span className="max-w-[200px] truncate" title={item.rowA.REMARKS}>{item.rowA.REMARKS || "none"}</span></div>
                                      
                                      <div className="pt-2 font-sans">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1">Row Validation Rules Executed:</div>
                                        {item.rowA.details.length === 0 ? (
                                          <span className="text-emerald-500 font-bold block text-[10px]">✓ All preflight checks passed</span>
                                        ) : (
                                          <div className="space-y-1">
                                            {item.rowA.details.map((d, dIdx) => (
                                              <div key={dIdx} className="text-[10px] flex items-start gap-1">
                                                <span className={`font-mono px-1 rounded text-[8.5px] scale-90 ${d.severity === "BLOCKER" ? "bg-rose-100 text-rose-700 font-bold" : "bg-amber-100 text-amber-700 font-bold"}`}>{d.severity}</span>
                                                <span className="text-slate-655 font-sans leading-tight">{d.message}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-6 text-center text-slate-350 italic text-xs">Record did not exist in reference run.</div>
                                  )}
                                </div>

                                {/* New State Run B */}
                                <div className="space-y-2 border border-slate-205 p-3 rounded bg-white">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider flex justify-between">
                                    <span>Run B: {runB.filename} (Compare Target)</span>
                                    {item.rowB && <span className="text-slate-600 font-bold">Index #{item.rowB.rawIndex + 1}</span>}
                                  </div>
                                  {item.rowB ? (
                                    <div className="space-y-1.5 font-mono text-[11px] text-slate-755 divide-y divide-slate-100">
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Date:</span> <span>{item.rowB.DATE}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Time:</span> <span>{item.rowB.TIME}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Latitude:</span> <span className={item.changedFields.includes("Latitude") ? "bg-emerald-50 text-emerald-700 px-1 rounded font-bold" : ""}>{item.rowB.LATITUDE ?? "null"} ({item.rowB.originalLat || "raw"})</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Longitude:</span> <span className={item.changedFields.includes("Longitude") ? "bg-emerald-50 text-emerald-700 px-1 rounded font-bold" : ""}>{item.rowB.LONGITUDE ?? "null"} ({item.rowB.originalLon || "raw"})</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Temp:</span> <span className={item.changedFields.includes("Water Temp") ? "bg-emerald-50 text-emerald-700 px-1 rounded font-bold" : ""}>{item.rowB.WTEMP !== null ? `${item.rowB.WTEMP}°C` : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Salinity:</span> <span className={item.changedFields.includes("Salinity") ? "bg-emerald-50 text-emerald-700 px-1 rounded font-bold" : ""}>{item.rowB.SALINITY !== null ? `${item.rowB.SALINITY} psu` : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Cell Count:</span> <span className={item.changedFields.includes("Cell Count") ? "bg-emerald-50 text-emerald-700 px-1 rounded font-bold" : ""}>{item.rowB.CELL_COUNT !== null ? item.rowB.CELL_COUNT.toLocaleString() : "null"}</span></div>
                                      <div className="flex justify-between py-1"><span className="text-slate-400">Remarks:</span> <span className="max-w-[200px] truncate" title={item.rowB.REMARKS}>{item.rowB.REMARKS || "none"}</span></div>
                                      
                                      <div className="pt-2 font-sans">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1">Row Validation Rules Executed:</div>
                                        {item.rowB.details.length === 0 ? (
                                          <span className="text-emerald-500 font-bold block text-[10px]">✓ All preflight checks passed</span>
                                        ) : (
                                          <div className="space-y-1">
                                            {item.rowB.details.map((d, dIdx) => (
                                              <div key={dIdx} className="text-[10px] flex items-start gap-1">
                                                <span className={`font-mono px-1 rounded text-[8.5px] scale-90 ${d.severity === "BLOCKER" ? "bg-rose-100 text-rose-700 font-bold" : "bg-amber-100 text-amber-700 font-bold"}`}>{d.severity}</span>
                                                <span className="text-slate-655 font-sans leading-tight">{d.message}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-6 text-center text-slate-350 italic text-xs">Record does not exist in target run (Dropped).</div>
                                  )}
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
