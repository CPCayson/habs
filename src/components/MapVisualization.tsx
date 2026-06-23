import React, { useState } from "react";
import { NormalizedRow } from "../types/habs";
import { Compass, MapPin, ZoomIn, Eye, AlertTriangle } from "lucide-react";

interface MapVisualizationProps {
  normalizedRows: NormalizedRow[];
}

export default function MapVisualization({ normalizedRows }: MapVisualizationProps) {
  const [hoveredPoint, setHoveredPoint] = useState<NormalizedRow | null>(null);

  // SVG parameters
  const width = 600;
  const height = 380;

  // Bounding box for mapping coordinates mathematically
  // Longitude: -98.0 (West border) to -80.0 (East border)
  // Latitude: 24.0 (South border) to 31.0 (North border)
  const lonMin = -98.0;
  const lonMax = -80.0;
  const latMin = 24.0;
  const latMax = 31.0;

  const projectLon = (lon: number) => {
    const frac = (lon - lonMin) / (lonMax - lonMin);
    return frac * width;
  };

  const projectLat = (lat: number) => {
    const frac = (lat - latMin) / (latMax - latMin);
    return (1 - frac) * height; // Invert Y axis
  };

  // Coastal path points (longitude, latitude) of the Gulf of Mexico
  const COALSTLINE_POINTS = [
    { lon: -97.5, lat: 25.9 }, // Brownsville / MX Border
    { lon: -97.2, lat: 27.8 }, // Corpus Christi
    { lon: -96.0, lat: 28.7 }, // Matagorda
    { lon: -94.8, lat: 29.3 }, // Galveston
    { lon: -93.8, lat: 29.7 }, // Sabine Pass
    { lon: -92.2, lat: 29.6 }, // Vermilion Bay
    { lon: -90.8, lat: 29.1 }, // Terrebonne
    { lon: -89.4, lat: 29.1 }, // Mississippi River Delta (Plaquemines)
    { lon: -89.6, lat: 30.2 }, // Pontchartrain
    { lon: -88.9, lat: 30.4 }, // Biloxi / MS Sound
    { lon: -88.0, lat: 30.3 }, // Mobile Bay entrance
    { lon: -87.4, lat: 30.3 }, // AL/FL line
    { lon: -85.6, lat: 30.1 }, // Panama City
    { lon: -84.3, lat: 30.0 }, // Apalachee Bay
    { lon: -83.5, lat: 29.4 }, // Cedar Key
    { lon: -82.7, lat: 27.8 }, // Tampa Bay
    { lon: -82.1, lat: 26.6 }, // Charlotte Harbor
    { lon: -81.4, lat: 25.1 }, // Cape Sable
    { lon: -80.5, lat: 25.0 }, // Keys entrance
    { lon: -81.8, lat: 24.5 }, // Key West
  ];

  // Convert points into an SVG path drawing
  const generateCoastlineD = () => {
    let path = `M ${projectLon(-98.0)} ${projectLat(31.0)} `; // Upper Left
    
    // Draw Land-Border boundaries then drop to coast
    path += `L ${projectLon(-97.5)} ${projectLat(31.0)} `;
    
    // Connect coastline points
    COALSTLINE_POINTS.forEach(pt => {
      path += `L ${projectLon(pt.lon)} ${projectLat(pt.lat)} `;
    });

    // Close landmass around Florida peninsula side
    path += `L ${projectLon(-80.0)} ${projectLat(24.5)} `;
    path += `L ${projectLon(-80.0)} ${projectLat(31.0)} `;
    path += "Z";
    return path;
  };

  // State lines paths as guidelines
  const stateLines = [
    // TX-LA boundary
    { start: { lon: -93.8, lat: 30.2 }, end: { lon: -93.8, lat: 29.7 } },
    // AL-FL boundary
    { start: { lon: -87.4, lat: 31.0 }, end: { lon: -87.4, lat: 30.3 } },
    // MS-AL boundary
    { start: { lon: -88.4, lat: 31.0 }, end: { lon: -88.4, lat: 30.2 } },
  ];

  // Identify valid display points
  const pointsToRender = normalizedRows.filter(
    row => 
      row.LATITUDE !== null && 
      row.LONGITUDE !== null && 
      row.LATITUDE >= latMin && 
      row.LATITUDE <= latMax && 
      row.LONGITUDE >= lonMin && 
      row.LONGITUDE <= lonMax
  );

  const invalidPointsCount = normalizedRows.length - pointsToRender.length;

  return (
    <div className="bg-white border border-slate-205 rounded p-6 shadow-xs flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 font-sans tracking-tight uppercase flex items-center gap-2">
            <Compass className="h-4.5 w-4.5 text-slate-800 animate-spin-pulse" />
            Gulf of Mexico Observation Mapping
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Decentralized projection verifying sample locations against bathymetric zones.
          </p>
        </div>
        
        {invalidPointsCount > 0 && (
          <div className="bg-amber-50 text-amber-705 border border-amber-200 rounded px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {invalidPointsCount} PLOT{invalidPointsCount > 1 ? 'S' : ''} OMITTED (OUT OF BOUNDS)
          </div>
        )}
      </div>

      <div className="relative flex-1 bg-slate-900 rounded overflow-hidden shadow-inner border border-slate-800 min-h-[300px]">
        {/* Ocean Background labels */}
        <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none select-none">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200/20 font-mono">
            Gulf of Mexico Basemap
          </span>
        </div>

        {/* Dynamic Map Coordinate Compass Overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-800 backdrop-blur text-white px-2.5 py-1.5 rounded text-[10px] font-mono pointer-events-none z-10 space-y-0.5 shadow-md">
          <div className="text-slate-400 uppercase text-[8px] font-sans font-bold tracking-wider">Compass Grid</div>
          <div>Bounds Lat: 24°N - 31°N</div>
          <div>Bounds Lon: 98°W - 80°W</div>
        </div>

        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-full"
        >
          {/* ocean water base */}
          <rect width={width} height={height} className="fill-slate-950" />
          
          {/* landmass shadow background */}
          <path 
            d={generateCoastlineD()} 
            className="fill-slate-900 stroke-slate-800 stroke-0.5 shadow-lg shadow-black" 
          />

          {/* Graticule grid (lat longitude coordinate lines) */}
          <g className="stroke-slate-800/60 stroke-0.5 border">
            {Array.from({ length: 8 }).map((_, idx) => {
              const lon = lonMin + idx * 2.5;
              const x = projectLon(lon);
              return (
                <g key={`gl-${idx}`}>
                  <line x1={x} y1={0} x2={x} y2={height} />
                  <text x={x + 3} y={15} className="fill-slate-500 font-mono text-[8px] border-none select-none" dominantBaseline="hanging">
                    {Math.abs(lon)}°W
                  </text>
                </g>
              );
            })}
            {Array.from({ length: 4 }).map((_, idx) => {
              const lat = latMin + idx * 2;
              const y = projectLat(lat);
              return (
                <g key={`gt-${idx}`}>
                  <line x1={0} y1={y} x2={width} y2={y} />
                  <text x={width - 32} y={y - 4} className="fill-slate-500 font-mono text-[8px] select-none text-right">
                    {lat}°N
                  </text>
                </g>
              );
            })}
          </g>

          {/* State Lines representation */}
          <g className="stroke-slate-700 stroke-0.5 stroke-dasharray-[2,2]">
            {stateLines.map((line, idx) => (
              <line 
                key={idx}
                x1={projectLon(line.start.lon)} 
                y1={projectLat(line.start.lat)} 
                x2={projectLon(line.end.lon)} 
                y2={projectLat(line.end.lat)}
                strokeDasharray="4 4"
              />
            ))}
          </g>

          {/* Plotting points markers */}
          <g>
            {pointsToRender.map((row, idx) => {
              if (row.LATITUDE === null || row.LONGITUDE === null) return null;
              
              const x = projectLon(row.LONGITUDE);
              const y = projectLat(row.LATITUDE);
              
              const isHovered = hoveredPoint?.id === row.id;

              // Color coordinate based on row warnings/blockers
              const markerColor = {
                PASS: "#10b981", // Emerald
                WARNING: "#d97706", // Amber
                BLOCKER: "#ef4444"  // Red
              }[row.severity];

              const ringColor = {
                PASS: "rgba(16, 185, 129, 0.25)",
                WARNING: "rgba(217, 119, 6, 0.25)",
                BLOCKER: "rgba(239, 68, 68, 0.3)"
              }[row.severity];

              return (
                <g 
                  key={row.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(row)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Glowing halo ring */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r={isHovered ? 13 : 7} 
                    fill={ringColor} 
                    className="transition-all duration-150"
                  />
                  {/* Core dot */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r={isHovered ? 5.5 : 3.5} 
                    fill={markerColor} 
                    stroke="#ffffff"
                    strokeWidth={1}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover detail card overlay */}
        {hoveredPoint && hoveredPoint.LATITUDE !== null && hoveredPoint.LONGITUDE !== null && (
          <div className="absolute bottom-3 right-3 left-3 md:left-auto md:w-72 bg-slate-900/95 border border-slate-800 backdrop-blur-md rounded p-3.5 text-white z-40 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans">
            <div className="flex justify-between items-start border-b border-slate-800 pb-1.5 mb-2">
              <div>
                <span className="text-[9px] font-mono font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded text-left">
                  {hoveredPoint.STATION_ID || "No Station ID"}
                </span>
                <div className="text-[11px] font-semibold text-slate-300 mt-1 uppercase">
                  UTC Time: {hoveredPoint.DATE} {hoveredPoint.TIME}
                </div>
              </div>
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                hoveredPoint.severity === "PASS" ? "bg-emerald-400" : hoveredPoint.severity === "WARNING" ? "bg-amber-400" : "bg-rose-500"
              }`} />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
              <div>
                <span className="text-slate-400 font-sans text-[8px] uppercase font-bold tracking-wider block">Latitude</span>
                <span className="text-slate-202">{hoveredPoint.LATITUDE.toFixed(5)}° N</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans text-[8px] uppercase font-bold tracking-wider block">Longitude</span>
                <span className="text-slate-202">{hoveredPoint.LONGITUDE.toFixed(5)}° W</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans text-[8px] uppercase font-bold tracking-wider block">Cell Abundance</span>
                <span className="text-slate-202 font-bold text-cyan-300">
                  {hoveredPoint.CELL_COUNT !== null ? hoveredPoint.CELL_COUNT.toLocaleString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-sans text-[8px] uppercase font-bold tracking-wider block">Temp | Salinity</span>
                <span className="text-slate-202">
                  {hoveredPoint.WTEMP !== null ? `${hoveredPoint.WTEMP.toFixed(1)}°C` : "N/A"} | {hoveredPoint.SALINITY !== null ? `${hoveredPoint.SALINITY} psu` : "N/A"}
                </span>
              </div>
            </div>
            
            {hoveredPoint.details.some(d => d.severity !== "PASS") && (
              <div className="border-t border-slate-800 mt-2 pt-1.5 text-[9px] text-amber-300 font-medium">
                ⚠️ Issues: {hoveredPoint.details.filter(d => d.severity !== "PASS").map(d => d.message).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
