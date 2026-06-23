import React from "react";
import { IngestionMetrics } from "../types/habs";
import { ShieldCheck, ShieldAlert, AlertOctagon, Cpu, ShieldCheck as ShieldIcon } from "lucide-react";
import { motion } from "motion/react";

interface DashboardKPIsProps {
  metrics: IngestionMetrics;
}

export default function DashboardKPIs({ metrics }: DashboardKPIsProps) {
  const { totalRecords, validRecords, warningRecords, blockerRecords, validationScore, parserCompatibility, readiness } = metrics;

  // Visual boundaries based on readiness
  const readinessThemes = {
    READY: {
      border: "border-l-4 border-emerald-500",
      text: "text-emerald-700",
      statusText: "READY",
      desc: "Payload holds clean state. Safe to ingest.",
      progressWidth: "w-full",
      bgColor: "bg-emerald-500",
    },
    REVIEW: {
      border: "border-l-4 border-amber-500",
      text: "text-amber-600",
      statusText: "REVIEW REQ",
      desc: "Temperature/Salinity exceeded science ceiling.",
      progressWidth: "w-[75%]",
      bgColor: "bg-amber-500",
    },
    BLOCKED: {
      border: "border-l-4 border-rose-500",
      text: "text-rose-600",
      statusText: "BLOCKED",
      desc: "Critical coordinate index out-of-bounds.",
      progressWidth: "w-[40%]",
      bgColor: "bg-rose-500",
    },
  }[readiness] || {
    border: "border-l-4 border-slate-900",
    text: "text-slate-900",
    statusText: "UNKNOWN",
    desc: "Awaiting source dataset initialization.",
    progressWidth: "w-0",
    bgColor: "bg-slate-500",
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Ingest Readiness */}
      <div id="kpi-readiness" className={`bg-white p-4 ${readinessThemes.border} shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between`}>
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Ingest Readiness</div>
          <div className={`${readinessThemes.text} font-black text-xl leading-none tracking-tight`}>
            {readinessThemes.statusText}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[10px] text-slate-500 leading-tight mb-2 line-clamp-2 md:line-clamp-none">
            {readinessThemes.desc}
          </p>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div className={`${readinessThemes.bgColor} h-full ${readinessThemes.progressWidth} rounded-full transition-all duration-300`}></div>
          </div>
        </div>
      </div>

      {/* 2. Validation Score */}
      <div id="kpi-validation-score" className="bg-white p-4 border-l-4 border-slate-900 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Validation Score</div>
          <div className="text-slate-900 font-black text-xl leading-none tracking-tight">
            {validationScore}%
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-slate-500 font-mono">
            {validRecords} of {totalRecords} Records Clean
          </div>
          <div className="text-[9px] text-slate-400 mt-1">12-level gatekeeper evaluation</div>
        </div>
      </div>

      {/* 3. Parser Compatibility */}
      <div id="kpi-compatibility" className="bg-white p-4 border-l-4 border-slate-900 shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between">
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Parser Compatibility</div>
          <div className="text-slate-900 font-black text-xl leading-none tracking-tight">
            {parserCompatibility}%
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-slate-500 font-mono">
            XLProc Engine [v3]
          </div>
          <div className="text-[9px] text-slate-400 mt-1">UTF-8 and encoding layout checked</div>
        </div>
      </div>

      {/* 4. Blocker Count */}
      <div id="kpi-blockers" className={`bg-white p-4 border-l-4 ${blockerRecords > 0 ? 'border-rose-500' : 'border-slate-900'} shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between`}>
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Blocker Count</div>
          <div className={`${blockerRecords > 0 ? 'text-rose-600' : 'text-slate-900'} font-black text-xl leading-none tracking-tight`}>
            {blockerRecords}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-slate-500 font-mono uppercase">
            {blockerRecords > 0 ? `${blockerRecords} critical errors` : "Critical-Clean"}
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Requires zero blocker gates</div>
        </div>
      </div>

      {/* 5. Data Quality Count */}
      <div id="kpi-warnings" className={`bg-white p-4 border-l-4 ${warningRecords > 0 ? 'border-amber-500' : 'border-slate-900'} shadow-sm ring-1 ring-slate-900/5 flex flex-col justify-between`}>
        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Data Quality Count</div>
          <div className={`${warningRecords > 0 ? 'text-amber-600' : 'text-slate-900'} font-black text-xl leading-none tracking-tight`}>
            {warningRecords}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-slate-550 font-mono truncate">
            {warningRecords > 0 ? "Range Warning Check" : "Physical bounds ok"}
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Fails scientific range/unit checks</div>
        </div>
      </div>
    </section>
  );
}
