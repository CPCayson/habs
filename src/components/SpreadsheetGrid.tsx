import React, { useState } from "react";
import { NormalizedRow, RawRow, Severity, ValidationDetail } from "../types/habs";
import { Sparkles, Edit2, Check, AlertCircle, XCircle, Info, Edit, Trash, Plus } from "lucide-react";

interface SpreadsheetGridProps {
  normalizedRows: NormalizedRow[];
  onUpdateRow: (rowIndex: number, updatedRaw: RawRow) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onAddRow?: () => void;
}

export default function SpreadsheetGrid({ 
  normalizedRows, 
  onUpdateRow,
  onDeleteRow,
  onAddRow
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; fieldKey: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [activeRowHelp, setActiveRowHelp] = useState<number | null>(null);

  // Trigger inline cell editing
  const startEditing = (rowIndex: number, fieldKey: string, currentValue: string) => {
    setEditingCell({ rowIndex, fieldKey });
    setEditingValue(currentValue);
  };

  // Save the corrected value back to raw state array in parent
  const saveCell = (rowIndex: number, fieldKey: string) => {
    const row = normalizedRows[rowIndex];
    const originalRaw = { ...row.raw };
    originalRaw[fieldKey] = editingValue;
    onUpdateRow(rowIndex, originalRaw);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, fieldKey: string) => {
    if (e.key === "Enter") {
      saveCell(rowIndex, fieldKey);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Helper to determine background colors for cells based on specific validation logs
  const getCellClassName = (row: NormalizedRow, rawFieldName: string) => {
    if (!rawFieldName) return "bg-white text-gray-700";

    // Find any validation details for this precise raw field (matched via columns or descriptions)
    const normalizedLower = rawFieldName.toLowerCase();
    const cellIssues = row.details.filter(d => 
      d.column?.toLowerCase() === normalizedLower ||
      (d.column && d.column.toLowerCase().includes(normalizedLower)) || 
      (normalizedLower.includes("lat") && d.step === 5) || // Coordinate conversion issues
      (normalizedLower.includes("lon") && d.step === 5) || 
      (normalizedLower.includes("temp") && d.step === 7) || // Temperature range issues
      (normalizedLower.includes("sal") && d.step === 7) // Salinity range issues
    );

    const hasBlocker = cellIssues.some(d => d.severity === "BLOCKER");
    const hasWarning = cellIssues.some(d => d.severity === "WARNING");
    
    if (hasBlocker) {
      return "bg-rose-50 border-rose-300 text-rose-900 font-medium hover:bg-rose-100/50";
    }
    if (hasWarning) {
      return "bg-amber-50 border-amber-300 text-amber-900 font-medium hover:bg-amber-100/50";
    }
    
    return "bg-white text-gray-800 hover:bg-gray-50/70";
  };

  // Extract cell issue tooltip descriptors
  const getCellDiagnosticMessage = (row: NormalizedRow, rawFieldName: string): string => {
    if (!rawFieldName) return "";
    const normalizedLower = rawFieldName.toLowerCase();
    const issues = row.details.filter(d => 
      d.column?.toLowerCase() === normalizedLower ||
      (normalizedLower.includes("lat") && d.step === 5) ||
      (normalizedLower.includes("lon") && d.step === 5) ||
      (normalizedLower.includes("temp") && d.step === 7) ||
      (normalizedLower.includes("sal") && d.step === 7)
    );
    return issues.map(i => `${i.severity}: ${i.message}`).join(" | ");
  };

  // We find corresponding original header name matching the concepts
  const getRawHeaderName = (row: NormalizedRow, targetConcept: string): string => {
    const synonyms = {
      STATION_ID: ["station id", "station", "locid", "stationname", "station_id", "stat_id", "stnid"],
      DATE: ["sample date", "date", "sdate", "collectiondate", "date_collected", "sampledate", "colldate"],
      TIME: ["sample time", "time", "stime", "collectiontime", "time_collected", "sampletime", "colltime"],
      LATITUDE: ["latitude", "lat", "y", "latitude_dd", "lat_dd", "latdd", "npos", "gpslat"],
      LONGITUDE: ["longitude", "lon", "lng", "x", "longitude_dd", "lon_dd", "londd", "wpos", "gpslon"],
      WTEMP: ["water temp (c)", "water temp (f)", "s. temp", "watertemp", "temp", "temperature", "w_temp", "temp_c", "temp_f", "wtemp"],
      SALINITY: ["salinity (psu)", "salinity", "sal", "s", "salinity_ppt", "salinity_psu"],
      CELL_COUNT: ["cell count (cells/l)", "cellcount", "abundance", "cells", "karenia brevis", "k. brevis", "concentration"],
      DEPTH: ["depth (m)", "depth", "sdepth", "sampledepth", "depth_m"]
    }[targetConcept] || [];

    const keys = Object.keys(row.raw);
    for (const key of keys) {
      if (synonyms.includes(key.trim().toLowerCase())) {
        return key;
      }
    }
    // Fallback back-to-raw map
    return keys[0] || "";
  };

  return (
    <div className="bg-white border border-slate-205 rounded p-6 shadow-xs flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 font-sans tracking-tight uppercase">Interactive Local Data Editor</h2>
            <span className="bg-slate-100 text-slate-800 text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Live Synced
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Double-click any cell to correct data on-the-fly. Color indicators trace validation constraints.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-stretch md:self-auto font-sans">
          {onAddRow && (
            <button
              onClick={onAddRow}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Record Row
            </button>
          )}
          <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
            Records Count: {normalizedRows.length}
          </span>
        </div>
      </div>

      {/* Grid container with overflow-x scroll */}
      <div className="overflow-x-auto flex-1 border border-slate-200 rounded bg-slate-50/50">
        <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold tracking-wider font-sans uppercase">
              <th className="w-[45px] py-3 text-center">Set</th>
              <th className="w-[120px] py-3 px-3">Station ID</th>
              <th className="w-[110px] py-3 px-3">Date (UTC)</th>
              <th className="w-[100px] py-3 px-3">Time</th>
              <th className="w-[110px] py-3 px-3">Latitude</th>
              <th className="w-[110px] py-3 px-3">Longitude</th>
              <th className="w-[125px] py-3 px-3">Abundance (cells/L)</th>
              <th className="w-[100px] py-3 px-3">Temp (Water)</th>
              <th className="w-[105px] py-3 px-3">Salinity (psu)</th>
              <th className="w-[90px] py-3 px-3">Depth (m)</th>
              <th className="w-[140px] py-3 px-3 text-center">Validation Remarks</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-150 bg-white text-xs font-sans">
            {normalizedRows.map((row, rowIndex) => {
              const stationKey = getRawHeaderName(row, "STATION_ID");
              const dateKey = getRawHeaderName(row, "DATE");
              const timeKey = getRawHeaderName(row, "TIME");
              const latKey = getRawHeaderName(row, "LATITUDE");
              const lonKey = getRawHeaderName(row, "LONGITUDE");
              const tempKey = getRawHeaderName(row, "WTEMP");
              const salKey = getRawHeaderName(row, "SALINITY");
              const cellKey = getRawHeaderName(row, "CELL_COUNT");
              const depthKey = getRawHeaderName(row, "DEPTH");

              const rowSeverityColor = {
                PASS: "bg-emerald-500 ring-2 ring-emerald-100",
                WARNING: "bg-amber-400 ring-2 ring-amber-100",
                BLOCKER: "bg-rose-500 ring-2 ring-rose-100"
              }[row.severity];

              const renderEditableCell = (key: string, label: string) => {
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.fieldKey === key;
                const cellClassName = getCellClassName(row, key);
                const rawVal = row.raw[key] || "";
                const cellDiagnostic = getCellDiagnosticMessage(row, key);

                return (
                  <td 
                    title={cellDiagnostic || "Double-click to edit cell"}
                    className={`py-2 px-3 border-r border-slate-150 truncate relative cursor-pointer group transition-colors duration-200 ${cellClassName}`}
                    onDoubleClick={() => startEditing(rowIndex, key, rawVal)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveCell(rowIndex, key)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, key)}
                        className="absolute inset-0 w-full h-full px-2.5 py-1 text-xs font-sans bg-slate-50 focus:bg-white text-slate-800 border border-slate-900 outline-none shadow-xs rounded focus:ring-1 focus:ring-slate-500"
                      />
                    ) : (
                      <div className="flex items-center justify-between min-w-0 pr-1">
                        <span className="truncate">{rawVal || <span className="text-slate-400 italic">empty</span>}</span>
                        <Edit2 className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5" />
                      </div>
                    )}
                  </td>
                );
              };

              return (
                <tr key={row.id} className="hover:bg-slate-50/40 relative">
                  {/* Ledger Dot and Status Index */}
                  <td className="py-2.5 text-center border-r border-slate-150 align-middle">
                    <div className="flex items-center justify-center gap-1.5 h-full">
                      <span className={`h-2.5 w-2.5 rounded-full inline-block ${rowSeverityColor}`} />
                      <span className="text-[10px] text-slate-400 font-mono">#{rowIndex + 1}</span>
                    </div>
                  </td>

                  {/* Render editable parameters corresponding to Python ingestion targets */}
                  {renderEditableCell(stationKey, "Station")}
                  {renderEditableCell(dateKey, "Date")}
                  {renderEditableCell(timeKey, "Time")}
                  {renderEditableCell(latKey, "Latitude")}
                  {renderEditableCell(lonKey, "Longitude")}
                  {renderEditableCell(cellKey, "Abundance")}
                  {renderEditableCell(tempKey, "Temperature")}
                  {renderEditableCell(salKey, "Salinity")}
                  {renderEditableCell(depthKey, "Depth")}

                  {/* Operational diagnostics view row */}
                  <td className="py-2 px-2 border-r border-slate-150 bg-slate-50/50 align-middle">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => setActiveRowHelp(activeRowHelp === rowIndex ? null : rowIndex)}
                        className="text-[10px] font-bold uppercase text-slate-700 bg-slate-100 hover:bg-slate-205 px-2 py-1 rounded border border-slate-200 flex items-center gap-1 min-w-0 truncate select-none cursor-pointer"
                      >
                        <Info className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {row.details.filter(d => d.severity !== "PASS").length} Diagnostic{row.details.filter(d => d.severity !== "PASS").length !== 1 ? 's' : ''}
                        </span>
                      </button>
                      
                      {onDeleteRow && (
                        <button
                          onClick={() => onDeleteRow(rowIndex)}
                          title="Delete row"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Popover detailed diagnostic codes for this specific row */}
                    {activeRowHelp === rowIndex && (
                      <div className="absolute right-6 top-10 mt-1 w-80 bg-white border border-slate-205 rounded p-4 z-50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                          <span className="font-extrabold text-xs text-slate-800 uppercase">Row #{rowIndex + 1} Verification Report</span>
                          <button 
                            onClick={() => setActiveRowHelp(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs"
                          >
                            Close
                          </button>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {row.details.filter(d => d.severity !== "PASS").length === 0 ? (
                            <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5" /> This row matches 100% of physical and relational guidelines.
                            </div>
                          ) : (
                            row.details.map((detail, dIdx) => (
                              <div key={dIdx} className="border-b border-slate-100 pb-2 last:border-b-0">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                  {detail.severity === "BLOCKER" ? (
                                    <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span className={detail.severity === "BLOCKER" ? "text-rose-700" : "text-amber-700 font-bold"}>
                                    Level {detail.step}: {detail.stepName}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 ml-5 font-sans leading-tight">
                                  {detail.message}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
