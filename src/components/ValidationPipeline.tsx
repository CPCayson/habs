import React, { useState } from "react";
import { NormalizedRow, PipelineStep, Severity } from "../types/habs";
import { CheckCircle2, AlertTriangle, XCircle, Info, ChevronRight, ChevronDown, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ValidationPipelineProps {
  normalizedRows: NormalizedRow[];
}

export default function ValidationPipeline({ normalizedRows }: ValidationPipelineProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Define static descriptions for the 12 levels matching Python modules
  const PIPELINE_GLOSSARY: { [key: number]: { title: string; pySource: string; rule: string; tech: string } } = {
    1: {
      title: "File Intake Check",
      pySource: "utilities.py → reader",
      rule: "Ensures the binary input stream is parsed as structured data. Flags empty rows, bad line returns, or corrupted encoding blocks.",
      tech: "Verifies row payload is non-null and correctly delimited."
    },
    2: {
      title: "Mandatory Schema Check",
      pySource: "constants.py → termMap",
      rule: "Scans column headers for authoritative index synonyms. Ensures that Collection Date, Latitude, and Longitude are mapped.",
      tech: "Normalizes custom column names to strict standard fields."
    },
    3: {
      title: "State/Jurisdiction Detection",
      pySource: "textProc.py → resolveState",
      rule: "Identifies whether the dataset originates from AL, TX, MS, or FL based on filename patterns, specific headers, or coordinate grids.",
      tech: "Permits custom processing protocols to fire in downstream checks."
    },
    4: {
      title: "Numerical Type Casting",
      pySource: "QA.py → typeCast",
      rule: "Safely converts string inputs into floats or integers. Bypasses common marine placeholders like 'N/A', 'nd', or 'neg' without crashing.",
      tech: "Forces empty optional data to safe indicators (e.g. Depth -> 0.0)."
    },
    5: {
      title: "Coordinate DMS2DD Parsing",
      pySource: "utilities.py → DMS2DD()",
      rule: "Regex-based converter for Degrees-Minutes-Seconds (DMS) values into Decimal Degrees (DD). Converts raw string formats on-the-fly.",
      tech: "Auto-negates longitude values to ensure proper West references of the GOM."
    },
    6: {
      title: "Geographic Boundary Shielding",
      pySource: "validation.py → checkBorders",
      rule: "Validates that parsed coordinates fall within the precise Gulf of Mexico observation bounding box: Lat [24, 31], Lon [-98, -80].",
      tech: "Flags inland/land-locked coordinates (such as Central TX or mainland FL)."
    },
    7: {
      title: "Scientific Range Controls",
      pySource: "ranges.py → validRanges",
      rule: "Enforces thermodynamic boundaries. Ensures ocean temperature is [0, 40]°C, salinity is [0, 45] psu, and depth is [0, 200]m.",
      tech: "Raises warnings for unusual values, and blockers for physically impossible claims."
    },
    8: {
      title: "QA Conversion Heuristics",
      pySource: "QA.py → doQA()",
      rule: "Handles Fahrenheit degrees to Celsius normalization. Translates meteorology strings (e.g. 'calm', 'smooth', 'flat') into numerical 0.",
      tech: "Ensures structural consistency for comparative database analysis."
    },
    9: {
      title: "Duplicate Record Shield",
      pySource: "validation.py → checkDupes",
      rule: "Scans active file for identical temporal-spatial markers (same coordinates, station, and date/time timestamp pairings).",
      tech: "Prevents double-insertion database errors during SQL pipeline runs."
    },
    10: {
      title: "Completeness Assessment",
      pySource: "validation.py → completeness",
      rule: "Evaluates the filling index of non-mandatory features (comments, wind speed, tide states, local depth). Alerts on empty profiles.",
      tech: "Flares warnings when overall field utilization drops below 55%."
    },
    11: {
      title: "Parser Crash Compatibility",
      pySource: "textProc.py → unixCheck",
      rule: "Scans records for un-sanitized carriage returns or specific non-ASCII character entities (e.g. copyright symbols, strange quotes).",
      tech: "Protects remote Python scripts from throwing unexpected encoding KeyError crashes."
    },
    12: {
      title: "Ingest Run Virtualization",
      pySource: "HABSGrabber → simRun",
      rule: "Executes a local dry-run simulation of the server-side text processing. Generates final JSON structures and checks relational sanity.",
      tech: "Confirms that the row is 100% compliant and capable of remote storage."
    }
  };

  // Compile real-time step statistics based on parsed rows
  const getStepMetrics = (stepNum: number) => {
    let blocker = 0;
    let warning = 0;
    let pass = 0;

    normalizedRows.forEach(row => {
      const detail = row.details.find(d => d.step === stepNum);
      if (detail) {
        if (detail.severity === "BLOCKER") blocker++;
        else if (detail.severity === "WARNING") warning++;
        else pass++;
      }
    });

    return { blocker, warning, pass };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 font-sans tracking-tight">12-Level Validation Pipeline</h2>
          <p className="text-xs text-gray-500 font-sans">Pre-flight local audit mapping remote HABSGrabber scripts.</p>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(stepNum => {
          const glossary = PIPELINE_GLOSSARY[stepNum];
          const stats = getStepMetrics(stepNum);
          const isExpanded = expandedStep === stepNum;

          // Determine visual status badge of this step
          let stepStatus: Severity = "PASS";
          if (stats.blocker > 0) stepStatus = "BLOCKER";
          else if (stats.warning > 0) stepStatus = "WARNING";

          const theme = {
            PASS: {
              container: "bg-emerald-50 border-emerald-100 text-slate-800 hover:bg-emerald-100/40",
              lvlColor: "text-emerald-700",
              subColor: "text-emerald-600",
              mark: "✓",
              markColor: "text-emerald-600"
            },
            WARNING: {
              container: "bg-amber-50 border-amber-100 text-slate-800 hover:bg-amber-100/40",
              lvlColor: "text-amber-700",
              subColor: "text-amber-600",
              mark: "!",
              markColor: "text-amber-600"
            },
            BLOCKER: {
              container: "bg-rose-50 border-rose-100 text-slate-800 hover:bg-rose-100/40",
              lvlColor: "text-rose-700",
              subColor: "text-rose-600",
              mark: "✗",
              markColor: "text-rose-600"
            }
          }[stepStatus];

          return (
            <div 
              key={stepNum}
              className={`border rounded relative transition-all duration-150 overflow-hidden ${theme.container}`}
            >
              {/* Absolute checkmark badge in top-right */}
              <div className={`absolute top-2 right-2 font-black text-sm select-none ${theme.markColor}`}>
                {theme.mark}
              </div>

              {/* Header block click triggering expand details */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : stepNum)}
                className="w-full px-4 py-3 flex flex-col justify-start text-left cursor-pointer focus:outline-none"
              >
                <span className={`text-[9.5px] font-bold uppercase tracking-wider mb-0.5 block ${theme.lvlColor}`}>
                  Step {stepNum.toString().padStart(2, '0')}
                </span>
                
                <div className="text-sm font-bold text-slate-900 leading-tight truncate pr-6">
                  {glossary?.title}
                </div>
                
                <div className={`text-[10px] font-medium truncate mt-0.5 ${theme.subColor}`}>
                  {stepStatus === "PASS" ? "Verified standard compliance" : stepStatus === "WARNING" ? `${stats.warning} warning parameters` : `${stats.blocker} blocker parameters`}
                </div>
              </button>

              {/* Expansion Details */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="border-t border-gray-100 bg-white/60 px-4 py-3 text-xs leading-relaxed"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-gray-700">
                          <Info className="h-3.5 w-3.5 text-gray-400" />
                          <span>Behavior mapping rule:</span>
                        </div>
                        <p className="text-gray-600 font-sans pl-5 pr-2">
                          {glossary?.rule}
                        </p>
                      </div>

                      <div className="bg-gray-50/70 p-2.5 rounded-lg border border-gray-100 font-mono space-y-2">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-sans font-bold">Python module equivalent:</div>
                          <div className="text-gray-700 font-bold mt-0.5 leading-tight">{glossary?.pySource}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-sans font-bold">Local javascript parser logic:</div>
                          <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{glossary?.tech}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
