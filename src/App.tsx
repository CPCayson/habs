import React, { useState, useMemo, useEffect } from "react";
import { PRESETS, PresetDataset } from "./utils/presets";
import { runValidationPipeline, generateTSVExport, VALID_RANGES } from "./utils/habsEngine";
import { RawRow, NormalizedRow, IngestionMetrics, AuditRecord } from "./types/habs";
import DashboardKPIs from "./components/DashboardKPIs";
import ValidationPipeline from "./components/ValidationPipeline";
import SpreadsheetGrid from "./components/SpreadsheetGrid";
import MapVisualization from "./components/MapVisualization";
import OracleVerification from "./components/OracleVerification";
import ExportAndTicket from "./components/ExportAndTicket";
import RunDiff from "./components/RunDiff";

import { 
  Database, 
  MapPin, 
  Settings, 
  History, 
  CheckSquare, 
  UploadCloud, 
  Sparkles, 
  FileText, 
  Sliders, 
  HelpCircle, 
  AlertTriangle,
  FolderOpen,
  ClipboardList,
  ArrowLeftRight,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"preflight" | "oracle" | "rules" | "history" | "diff">("preflight");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Selection states
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [rawRows, setRawRows] = useState<RawRow[]>(PRESETS[0].rows);
  const [filename, setFilename] = useState<string>(PRESETS[0].filename);
  
  // Custom paste states
  const [pasteInputText, setPasteInputText] = useState<string>("");
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);

  // Manual warning overrides & bounds configurable by user (Operational Excellence Rules tab)
  const [forceWarningsOverride, setForceWarningsOverride] = useState<boolean>(false);
  const [scienceTempMax, setScienceTempMax] = useState<number>(VALID_RANGES.WTEMP.max);
  const [scienceSalinityMax, setScienceSalinityMax] = useState<number>(VALID_RANGES.SALINITY.max);

  // Audit run trail (Section 5 - Audit Trails)
  const [auditRuns, setAuditRuns] = useState<AuditRecord[]>(() => {
    // Compile Preset 0 (perfect Alabama)
    const resAL = runValidationPipeline(PRESETS[0].rows, PRESETS[0].filename, { forceIngestWarnings: false });
    // Compile Preset 2 (Florida with warnings)
    const resFL = runValidationPipeline(PRESETS[2].rows, PRESETS[2].filename, { forceIngestWarnings: false });

    return [
      {
        id: "run_2026-06-22_AL_01",
        filename: PRESETS[0].filename,
        timestamp: "2026-06-22 14:15:30",
        state: "AL",
        recordsCount: PRESETS[0].rows.length,
        validationScore: resAL.metrics.validationScore,
        status: "SUCCESS",
        ticketMarkdown: "### INDEPENDENT PRE-FLIGHT AUDITING PASSED...",
        coordinateErrorsPct: 0,
        rangeViolationsPct: 0,
        otherErrorsPct: 0,
        rows: resAL.normalizedRows
      },
      {
        id: "run_2026-06-22_FL_02",
        filename: PRESETS[2].filename,
        timestamp: "2026-06-22 16:32:04",
        state: "FL",
        recordsCount: PRESETS[2].rows.length,
        validationScore: resFL.metrics.validationScore,
        status: "WARNING_OVERRIDE",
        ticketMarkdown: "### WARNING TRIGGERED OVERRIDE RUN COMPLETED...",
        coordinateErrorsPct: 15,
        rangeViolationsPct: 20,
        otherErrorsPct: 5,
        rows: resFL.normalizedRows
      }
    ];
  });

  // Load a preset dataset
  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    setRawRows(PRESETS[idx].rows);
    setFilename(PRESETS[idx].filename);
  };

  // Callback to update row edits directly from Spreadsheet Grid on-the-fly
  const handleUpdateRow = (rowIndex: number, updatedRaw: RawRow) => {
    const updated = [...rawRows];
    updated[rowIndex] = updatedRaw;
    setRawRows(updated);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const updated = rawRows.filter((_, idx) => idx !== rowIndex);
    setRawRows(updated);
  };

  const handleAddRow = () => {
    if (rawRows.length === 0) return;
    // Clone headers configuration from first row to keep matching keys
    const firstRow = rawRows[0];
    const newRaw: RawRow = {};
    Object.keys(firstRow).forEach(key => {
      newRaw[key] = "";
    });
    // Set some basic values
    const stationHeader = Object.keys(firstRow).find(k => k.toLowerCase().includes("stn") || k.toLowerCase().includes("station")) || Object.keys(firstRow)[0];
    const dateHeader = Object.keys(firstRow).find(k => k.toLowerCase().includes("date")) || Object.keys(firstRow)[1];
    
    newRaw[stationHeader] = "AL-NEW-STN";
    newRaw[dateHeader] = "2026-06-22";
    
    setRawRows([...rawRows, newRaw]);
  };

  // Parse raw pasted CSV/TSV text
  const handleImportCustomText = () => {
    if (!pasteInputText.trim()) return;
    
    try {
      const lines = pasteInputText.split(/\r?\n/).filter(l => l.trim() !== "");
      if (lines.length < 2) {
        alert("Must contain at least a header row and one record row.");
        return;
      }

      // Sniff delimiter
      const firstLine = lines[0];
      let delim = ",";
      if (firstLine.includes("\t")) delim = "\t";
      else if (firstLine.includes(";")) delim = ";";

      const headers = firstLine.split(delim).map(h => h.trim().replace(/^["']|["']$/g, ""));
      const parsedRows: RawRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delim).map(v => v.trim().replace(/^["']|["']$/g, ""));
        const row: RawRow = {};
        headers.forEach((header, hIdx) => {
          if (header) {
            row[header] = values[hIdx] || "";
          }
        });
        parsedRows.push(row);
      }

      setRawRows(parsedRows);
      setFilename("pasted_custom_payload.txt");
      setPasteInputText("");
      setShowPasteBox(false);
    } catch (err) {
      alert("Verification error: failed to resolve the tabular layout.");
    }
  };

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteInputText(text);
        setFilename(file.name);
        // Automatically open the paste box to let them preview or trigger immediately
        setShowPasteBox(true);
      }
    };
    reader.readAsText(file);
  };

  // Run the 12-Level validation process reactively
  const pipelineState = useMemo(() => {
    // Inject dynamic configurable ranges from Rules tab
    VALID_RANGES.WTEMP.max = scienceTempMax;
    VALID_RANGES.SALINITY.max = scienceSalinityMax;

    return runValidationPipeline(rawRows, filename, {
      forceIngestWarnings: forceWarningsOverride
    });
  }, [rawRows, filename, forceWarningsOverride, scienceTempMax, scienceSalinityMax]);

  const { normalizedRows, metrics } = pipelineState;

  // Auto-resolve of state indicator
  const activeState = useMemo(() => {
    if (normalizedRows.length > 0) {
      // Find mode state
      const counts: { [key: string]: number } = {};
      normalizedRows.forEach(row => {
        // Simple heuristic lookup
        const s = row.details.find(d => d.step === 3)?.message.split("state: ")[1] || "UNKNOWN";
        counts[s] = (counts[s] || 0) + 1;
      });
      // Sort counts keys
      const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      return sorted[0] || "AL";
    }
    return "AL";
  }, [normalizedRows]);

  // Compute final valid TSV model text
  const formattedTSV = useMemo(() => {
    return generateTSVExport(normalizedRows);
  }, [normalizedRows]);

  // Handle saving run to audit folders
  const handleCommitHistoricalRun = (ticketText: string) => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 19).replace("T", " ");
    
    // Calculate failure distribution counts
    let coordinateErrorsCount = 0;
    let rangeViolationsCount = 0;
    let otherErrorsCount = 0;
    
    normalizedRows.forEach(row => {
      let isCoordError = false;
      let isRangeError = false;
      let isOtherError = false;
      
      row.details.forEach(detail => {
        if (detail.severity !== "PASS") {
          const msg = (detail.message || "").toLowerCase();
          
          if (
            detail.step === 5 || 
            detail.step === 6 || 
            msg.includes("coordinate") || 
            msg.includes("lat") || 
            msg.includes("lon") || 
            msg.includes("geographic") || 
            msg.includes("boundary")
          ) {
            isCoordError = true;
          } else if (
            detail.step === 7 || 
            msg.includes("range") || 
            msg.includes("temp") || 
            msg.includes("salinity") || 
            msg.includes("violat") || 
            msg.includes("limit") || 
            msg.includes("exceed")
          ) {
            isRangeError = true;
          } else {
            isOtherError = true;
          }
        }
      });
      
      if (isCoordError) coordinateErrorsCount++;
      if (isRangeError) rangeViolationsCount++;
      if (isOtherError && !isCoordError && !isRangeError) otherErrorsCount++;
    });

    const total = normalizedRows.length || 1;
    const coordPct = Math.round((coordinateErrorsCount / total) * 100);
    const rangePct = Math.round((rangeViolationsCount / total) * 100);
    const otherPct = Math.round((otherErrorsCount / total) * 100);

    const newRun: AuditRecord = {
      id: `run_${now.toISOString().slice(0, 10).replace(/-/g, "_")}_${activeState}_03`,
      filename: filename,
      timestamp: formattedDate,
      state: activeState as any,
      recordsCount: normalizedRows.length,
      validationScore: metrics.validationScore,
      status: metrics.readiness === "READY" ? "SUCCESS" : "WARNING_OVERRIDE",
      ticketMarkdown: ticketText,
      coordinateErrorsPct: coordPct,
      rangeViolationsPct: rangePct,
      otherErrorsPct: otherPct,
      rows: [...normalizedRows]
    };

    setAuditRuns(prev => [newRun, ...prev]);
    // Smooth scroll back to top or alert success
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans overflow-hidden h-screen">
      
      {/* Mobile-Friendly Top Title Bar */}
      <nav id="mobile-navigation-header" className="flex md:hidden items-center justify-between bg-slate-900 text-white px-5 py-4 border-b border-slate-950 shrink-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-500 rounded-sm"></div>
          <span className="text-white font-bold tracking-tighter text-lg leading-none">HABSOS</span>
        </div>
        <button 
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-1 px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded border border-slate-800 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold"
          title="Open Workbench Menu"
        >
          <Menu className="h-4 w-4 text-emerald-400" /> MENU
        </button>
      </nav>

      {/* Slide-out Mobile Panel Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Dark Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            
            {/* Drawer Container */}
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative flex flex-col w-72 max-w-[80vw] bg-slate-900 text-slate-400 p-6 h-full shadow-2xl z-50 border-r border-slate-950"
            >
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4.5 h-4.5 bg-emerald-500 rounded-sm"></div>
                  <span className="text-white font-black tracking-bighter text-lg">HABSOS Mobile</span>
                </div>
                <button 
                  onClick={() => setIsMobileSidebarOpen(false)} 
                  className="p-1 text-slate-400 hover:text-white active:scale-90 transition-transform"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-650 border-b border-slate-850 pb-1">
                    Workbench Modes
                  </div>
                  
                  <div className="space-y-1.5">
                    <button
                      onClick={() => { setActiveTab("preflight"); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-md text-xs font-bold transition-colors ${
                        activeTab === "preflight" ? "bg-slate-850 text-white font-black" : "hover:bg-slate-850 text-slate-350"
                      }`}
                    >
                      <div className={`w-1 h-3.5 ${activeTab === "preflight" ? "bg-emerald-500" : "bg-slate-700"}`} />
                      <span>Preflight Local</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab("oracle"); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-md text-xs font-bold transition-colors ${
                        activeTab === "oracle" ? "bg-slate-850 text-white font-black" : "hover:bg-slate-850 text-slate-350"
                      }`}
                    >
                      <div className={`w-1 h-3.5 ${activeTab === "oracle" ? "bg-emerald-500" : "bg-slate-700"}`} />
                      <span>Oracle Verification</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab("rules"); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-md text-xs font-bold transition-colors ${
                        activeTab === "rules" ? "bg-slate-850 text-white font-black" : "hover:bg-slate-850 text-slate-350"
                      }`}
                    >
                      <div className={`w-1 h-3.5 ${activeTab === "rules" ? "bg-emerald-500" : "bg-slate-700"}`} />
                      <span>Rules & Bounds</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab("diff"); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-md text-xs font-bold transition-colors ${
                        activeTab === "diff" ? "bg-slate-850 text-white font-white" : "hover:bg-slate-850 text-slate-350"
                      }`}
                    >
                      <div className={`w-1 h-3.5 ${activeTab === "diff" ? "bg-emerald-500" : "bg-slate-700"}`} />
                      <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-450 shrink-0" />
                      <span>Audit Run Diff</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab("history"); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-md text-xs font-bold transition-colors ${
                        activeTab === "history" ? "bg-slate-850 text-white font-black" : "hover:bg-slate-850 text-slate-350"
                      }`}
                    >
                      <div className={`w-1 h-3.5 ${activeTab === "history" ? "bg-emerald-500" : "bg-slate-700"}`} />
                      <span>Audit Run Trail</span>
                    </button>
                  </div>

                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-650 border-b border-slate-855 pb-1 pt-4">
                    Environment Info
                  </div>
                  <div className="space-y-2 text-[11px] font-sans">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-slate-500">Oracle Status:</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/25 font-bold font-mono">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-slate-500">Active State:</span>
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/25 font-bold font-mono uppercase">{activeState}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 text-[9.5px] text-slate-500 space-y-0.5">
                  <p>v3.5.0-STABLE</p>
                  <p>© NOAA / HABSOS Systems</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2.4.0 Side Bar Assembly - Hidden on mobile screens */}
      <aside className="hidden md:flex w-64 bg-slate-900 shrink-0 flex-col text-slate-400 border-r border-slate-950">
        
        {/* Core title badge */}
        <div className="p-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-emerald-500 rounded-sm"></div>
            <span className="text-white font-bold tracking-tighter text-xl">HABSOS</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ingestion Workbench</p>
        </div>

        {/* Level selection menu */}
        <nav className="flex-1 px-4 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold px-2 py-2 text-slate-600 border-b border-slate-800 mb-2">
            Workbench Modes
          </div>
          
          <button
            onClick={() => setActiveTab("preflight")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded cursor-pointer transition-colors text-sm ${
              activeTab === "preflight"
                ? "bg-slate-800 text-white font-medium shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <div className={`w-1 h-4 ${activeTab === "preflight" ? "bg-emerald-500" : "bg-slate-700"}`}></div>
            <span>Preflight Local</span>
          </button>

          <button
            onClick={() => setActiveTab("oracle")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded cursor-pointer transition-colors text-sm ${
              activeTab === "oracle"
                ? "bg-slate-800 text-white font-medium shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <div className={`w-1 h-4 ${activeTab === "oracle" ? "bg-emerald-500" : "bg-slate-700"}`}></div>
            <span>Oracle Verification</span>
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded cursor-pointer transition-colors text-sm ${
              activeTab === "rules"
                ? "bg-slate-800 text-white font-medium shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <div className={`w-1 h-4 ${activeTab === "rules" ? "bg-emerald-500" : "bg-slate-700"}`}></div>
            <span>Rules & Bounds</span>
          </button>

          <button
            onClick={() => setActiveTab("diff")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded cursor-pointer transition-colors text-sm ${
              activeTab === "diff"
                ? "bg-slate-800 text-white font-medium shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <div className={`w-1 h-4 ${activeTab === "diff" ? "bg-emerald-500" : "bg-slate-700"}`}></div>
            <ArrowLeftRight className="h-4 w-4 text-emerald-450" />
            <span>Audit Run Diff</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded cursor-pointer transition-colors text-sm ${
              activeTab === "history"
                ? "bg-slate-800 text-white font-medium shadow-xs"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <div className={`w-1 h-4 ${activeTab === "history" ? "bg-emerald-500" : "bg-slate-700"}`}></div>
            <span>Audit Run Trail</span>
          </button>

          {/* Environment Info */}
          <div className="pt-8 text-[11px] uppercase tracking-wider font-bold px-2 py-2 text-slate-600 border-b border-slate-800 mb-2">
            Environment
          </div>
          
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-400">Oracle TEST</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded border border-emerald-500/30 font-mono tracking-wider">
              CONNECTED
            </span>
          </div>
          
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-400">Active State</span>
            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] rounded border border-amber-500/30 font-mono tracking-wider uppercase font-bold">
              {activeState}
            </span>
          </div>

        </nav>

        {/* Footer brand details */}
        <div className="p-6 border-t border-slate-800 text-[10px] text-slate-500">
          <p>v3.5.0-STABLE</p>
          <p>© NOAA / HABSOS Systems</p>
        </div>

      </aside>

      {/* Main workspace arena */}
      <main className="flex-1 flex flex-col p-6 md:p-8 gap-6 overflow-y-auto h-screen class-custom-workbench">
        
        {/* Dynamic State Office Header */}
        <header className="flex flex-col md:flex-row justify-between items-start gap-4 pb-2 border-b border-slate-200">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
              Shift Intelligence Left
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1.5">
              Virtual Ingest & Validation Dashboard • {
                activeState === "AL" ? "Alabama" : 
                activeState === "FL" ? "Florida" : 
                activeState === "TX" ? "Texas" : 
                activeState === "MS" ? "Mississippi" : "Gulf Regional"
              } Office
            </p>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="bg-white border border-slate-200 px-4 py-2 rounded flex flex-col items-end shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Active Snapshot</span>
              <span className="font-mono text-xs text-slate-800">{filename}</span>
            </div>
            
            <label className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-xs">
              DRAG FILE <span className="text-slate-400">+</span>
              <input 
                type="file" 
                accept=".txt,.csv,.tsv" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>
        </header>

        {/* Display appropriate section according to selected side tab */}
        <AnimatePresence mode="wait">
          {activeTab === "preflight" && (
            <motion.div
              key="preflight-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Presets and custom uploader container bar */}
              <div className="bg-white border border-gray-200 p-5 rounded shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono flex items-center gap-1">
                    <FolderOpen className="h-3.5 w-3.5" /> AUTHORITATIVE DATA SOURCES
                  </div>
                  <h2 className="text-sm font-bold text-gray-800 font-sans tracking-tight">
                    Select a Raw HABSOS Intake Dataset to Evaluate
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto font-sans">
                  {/* Presets Cards */}
                  {PRESETS.map((p, idx) => {
                    const idxColor = {
                      Perfect: "text-emerald-700 bg-emerald-50 border-emerald-200",
                      Blocked: "text-rose-700 bg-rose-50 border-rose-200",
                      Warnings: "text-amber-700 bg-amber-50 border-amber-200",
                      Incomplete: "text-slate-700 bg-slate-50 border-slate-200"
                    }[p.quality];

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectPreset(idx)}
                        className={`text-xs px-3.5 py-1.5 rounded font-bold border transition-all cursor-pointer text-left flex items-center gap-1.5 ${
                          selectedPresetIndex === idx
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : `${idxColor} hover:bg-opacity-85`
                        }`}
                      >
                        <span className="shrink-0">{p.state}</span>
                        <span className={`text-[9.5px] uppercase ${selectedPresetIndex === idx ? "text-slate-400" : "text-gray-400"}`}>
                          ({p.quality})
                        </span>
                      </button>
                    );
                  })}

                  <span className="w-px h-5 bg-gray-200 hidden lg:inline-block" />

                  {/* Manual Paste */}
                  <button
                    onClick={() => setShowPasteBox(!showPasteBox)}
                    className="px-3.5 py-1.5 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
                    Paste Data
                  </button>
                </div>
              </div>

              {/* Paste box conditional container details */}
              {showPasteBox && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border text-sm border-slate-300 p-5 rounded shadow-xl space-y-4 font-sans"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">Paste Delimited (CSV or Tab-Separated) Rows</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Synonym columns mapped automatically using constants rules.</p>
                    </div>
                    <button 
                      onClick={() => setShowPasteBox(false)}
                      className="text-gray-400 hover:text-gray-650 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <textarea
                    rows={5}
                    value={pasteInputText}
                    onChange={(e) => setPasteInputText(e.target.value)}
                    placeholder={`Station,Date,Time,Lat,Lon,Cells,WaterTemp,Sal\nAL-STN-010,2026-06-15,08:30:00,30 15 12 N,87 55 42 W,4500,24.5,32.1`}
                    className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-950 rounded outline-none focus:ring-1 focus:ring-slate-700"
                  />

                  <div className="flex justify-end gap-2 font-sans">
                    <button
                      onClick={handleImportCustomText}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      Re-Compile & Ingest
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Core metrics KPI scorecards */}
              <DashboardKPIs metrics={metrics} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <ValidationPipeline normalizedRows={normalizedRows} />
                </div>

                <div className="lg:col-span-2">
                  <MapVisualization normalizedRows={normalizedRows} />
                </div>
              </div>

              {/* Main Table spreadsheet grid row */}
              <div className="w-full">
                <SpreadsheetGrid 
                  normalizedRows={normalizedRows} 
                  onUpdateRow={handleUpdateRow}
                  onDeleteRow={handleDeleteRow}
                  onAddRow={handleAddRow}
                />
              </div>

              {/* Clean TSV Export generation & JIRA code block generator */}
              <div className="w-full">
                <ExportAndTicket 
                  normalizedRows={normalizedRows}
                  metrics={metrics}
                  filename={filename}
                  state={activeState}
                  formattedTSV={formattedTSV}
                  onCommitHistoricalRun={handleCommitHistoricalRun}
                />
              </div>

            </motion.div>
          )}

          {activeTab === "oracle" && (
            <motion.div
              key="oracle-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <OracleVerification 
                metrics={metrics} 
                normalizedRows={normalizedRows}
                activeState={activeState}
              />
            </motion.div>
          )}

          {activeTab === "rules" && (
            <motion.div
              key="rules-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-slate-200 rounded p-6 shadow-xs space-y-6"
            >
              <div className="border-b border-slate-150 pb-4">
                <h2 className="text-lg font-bold text-gray-950 font-sans tracking-tight">Configure Pre-flight Validation Physics Ranges</h2>
                <p className="text-xs text-gray-500 font-sans">
                  Adjust thermodynamic ceilings and database parameters. Changes reflect instantly across all validation tabs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                {/* Science thresholds */}
                <div className="space-y-4">
                  <h3 className="font-extrabold text-sm text-gray-800 tracking-tight uppercase text-xs text-slate-500">Thermodynamic Range Caps</h3>
                  
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Maximum Ocean Temperature Warning:</span>
                        <span className="font-mono font-bold text-gray-900">{scienceTempMax}°C</span>
                      </div>
                      <input 
                        type="range"
                        min="25"
                        max="42"
                        step="0.5"
                        value={scienceTempMax}
                        onChange={(e) => setScienceTempMax(parseFloat(e.target.value))}
                        className="w-full accent-slate-900 cursor-pointer h-1 bg-gray-200 rounded outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Maximum Marines Salinity Warning:</span>
                        <span className="font-mono font-bold text-gray-900">{scienceSalinityMax} psu</span>
                      </div>
                      <input 
                        type="range"
                        min="35"
                        max="58"
                        step="0.5"
                        value={scienceSalinityMax}
                        onChange={(e) => setScienceSalinityMax(parseFloat(e.target.value))}
                        className="w-full accent-slate-900 cursor-pointer h-1 bg-gray-200 rounded outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Overrides control */}
                <div className="space-y-4">
                  <h3 className="font-extrabold text-sm text-gray-800 tracking-tight uppercase text-xs text-slate-500">Operational Override Flags</h3>
                  
                  <div className="p-4 bg-slate-50/50 rounded border border-slate-205/80 space-y-4">
                    <label className="flex items-start gap-3 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceWarningsOverride}
                        onChange={(e) => setForceWarningsOverride(e.target.checked)}
                        className="mt-0.5 rounded border-slate-350 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Force Ingest on Warning levels</div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                          By default, warning levels flag overall readiness score as "REVIEW" to prevent human errors. Checking this overrides ready status directly to "READY".
                        </p>
                      </div>
                    </label>

                    <div className="text-[10px] text-amber-700 bg-amber-50 rounded p-2.5 border border-amber-200/50">
                      *Note: Overriding warnings still records metrics inside Oracle database QA_LOGS tables.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "diff" && (
            <motion.div
              key="diff-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <RunDiff auditRuns={auditRuns} />
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-slate-200 rounded p-6 shadow-xs space-y-6"
            >
              <div className="border-b border-slate-150 pb-4">
                <h2 className="text-lg font-bold text-gray-950 font-sans tracking-tight">Auditable Run Log Archives</h2>
                <p className="text-xs text-gray-500 font-sans">
                  Past successful executions record a timestamped directory containing serialized compliance outputs.
                </p>
              </div>

              {/* History list */}
              <div className="space-y-4 font-sans">
                {auditRuns.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    No committed pre-flight validation logs found in database. Commit a run from the Preflight tab to establish historical audit trail entries.
                  </div>
                ) : (
                  auditRuns.map((run) => (
                    <div 
                      key={run.id}
                      className="relative group border border-slate-200/80 hover:border-slate-300 rounded p-5 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                            runs/{new Date(run.timestamp).toISOString().slice(0, 10)}_{run.state}/
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            run.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-205"
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-gray-800 mt-1">
                          Archived File: {run.filename} ({run.recordsCount} total records)
                        </div>
                        <p className="text-[10px] text-gray-400">
                          Commit Date UTC: {run.timestamp} | Scorecard validation: {run.validationScore}%
                        </p>
                      </div>

                      {/* failure distribution hover stats */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute right-4 md:right-48 bottom-16 md:bottom-auto bg-slate-900 text-white text-[10px] rounded-lg p-3 shadow-xl max-w-[210px] z-10 pointer-events-none border border-slate-800">
                        <div className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1 border-b border-slate-800 pb-1">
                          <span>📋 Failure Distribution</span>
                        </div>
                        <div className="space-y-1.5 min-w-36 font-mono">
                          <div>
                            <div className="flex justify-between text-[9px] text-slate-350">
                              <span>Coordinate Errors:</span>
                              <span className="text-emerald-400 font-bold">{run.coordinateErrorsPct ?? 0}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                              <div className="bg-emerald-500 h-full" style={{ width: `${run.coordinateErrorsPct ?? 0}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] text-slate-350">
                              <span>Range Violations:</span>
                              <span className="text-amber-400 font-bold">{run.rangeViolationsPct ?? 0}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                              <div className="bg-amber-500 h-full" style={{ width: `${run.rangeViolationsPct ?? 0}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] text-slate-350">
                              <span>Other Pipeline Warnings:</span>
                              <span className="text-rose-400 font-bold">{run.otherErrorsPct ?? 0}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                              <div className="bg-rose-500 h-full" style={{ width: `${run.otherErrorsPct ?? 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(run.ticketMarkdown);
                          alert("Archived metadata JIRA ticket copied directly from trail directory!");
                        }}
                        className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-bold rounded transition shrink-0 cursor-pointer"
                      >
                        Extract Ticket Trail
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
