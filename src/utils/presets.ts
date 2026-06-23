import { RawRow } from "../types/habs";

export interface PresetDataset {
  name: string;
  filename: string;
  description: string;
  state: "AL" | "TX" | "MS" | "FL";
  quality: "Perfect" | "Blocked" | "Warnings" | "Incomplete";
  rows: RawRow[];
}

export const PRESETS: PresetDataset[] = [
  {
    name: "Alabama Coastal - Perfect Run",
    filename: "alabama_coastal_gulf_2026.txt",
    description: "Ideal standard sample dataset from Alabama Panhandle coastal runs. Full sensor fields, clean DMS coordinates, and typical low wind conditions.",
    state: "AL",
    quality: "Perfect",
    rows: [
      {
        "Station": "AL-STN-010",
        "Date": "2026-06-15",
        "Time": "08:14:00",
        "Lat": "30 15 12.5 N",
        "Lon": "87 55 42.1 W",
        "WaterTemp": "24.5",
        "Sal": "32.4",
        "Cells": "4500",
        "Depth": "1.5",
        "Remarks": "Clear skies, low tide.",
        "WindSpeed": "calm"
      },
      {
        "Station": "AL-STN-012",
        "Date": "2026-06-15",
        "Time": "09:30:00",
        "Lat": "30.1542",
        "Lon": "-87.8105",
        "WaterTemp": "25.1",
        "Sal": "31.8",
        "Cells": "12000",
        "Depth": "1.0",
        "Remarks": "Trace debris in sample plankton tow.",
        "WindSpeed": "smooth"
      },
      {
        "Station": "AL-STN-020",
        "Date": "2026-06-15",
        "Time": "11:05:00",
        "Lat": "30 11 45.1 N",
        "Lon": "88 04 12.8 W",
        "WaterTemp": "25.8",
        "Sal": "33.1",
        "Cells": "240",
        "Depth": "3.0",
        "Remarks": "Deeper ocean station.",
        "WindSpeed": "smooth"
      },
      {
        "Station": "AL-STN-025",
        "Date": "2026-06-15",
        "Time": "13:20:00",
        "Lat": "30.2014",
        "Lon": "-87.6592",
        "WaterTemp": "26.3",
        "Sal": "32.0",
        "Cells": "65000",
        "Depth": "0.5",
        "Remarks": "Estuary channel point.",
        "WindSpeed": "smooth"
      },
      {
        "Station": "AL-STN-028",
        "Date": "2026-06-15",
        "Time": "15:45:00",
        "Lat": "30 14 02.1 N",
        "Lon": "87 40 18.4 W",
        "WaterTemp": "26.8",
        "Sal": "30.2",
        "Cells": "850",
        "Depth": "1.2",
        "Remarks": "Final day station.",
        "WindSpeed": "calm"
      }
    ]
  },
  {
    name: "Alabama Prep - Hard Blocker",
    filename: "alabama_prep_raw_blockers.csv",
    description: "AL data with structural blockers: unparseable DMS coordinates, data rows missing timestamps, and scientific values mathematically outside GOM limits.",
    state: "AL",
    quality: "Blocked",
    rows: [
      {
        "Station": "AL-BLOCK-04",
        "Date": "2026-06-18",
        "Time": "07:30:00",
        "Lat": "30 15 12.5 N",
        "Lon": "87 55 42.1 W",
        "WaterTemp": "24.5",
        "Sal": "32.4",
        "Cells": "1500",
        "Depth": "1.0",
        "Remarks": "Normal control row."
      },
      {
        "Station": "AL-BLOCK-05",
        "Date": "2026-06-18",
        "Time": "08:15:00",
        "Lat": "INVALID_COORDS", // Blocker: unparseable lat
        "Lon": "87.5501",
        "WaterTemp": "24.9",
        "Sal": "32.0",
        "Cells": "2800",
        "Depth": "1.2",
        "Remarks": "GPS transceiver glitch."
      },
      {
        "Station": "AL-BLOCK-06",
        "Date": "2026-06-18",
        "Time": "", // Warning: missing time
        "Lat": "30.1245",
        "Lon": "-87.9002",
        "WaterTemp": "25.2",
        "Sal": "31.2",
        "Cells": "N/A", // Handled QA
        "Depth": "1.0",
        "Remarks": "Skipped clock sync."
      },
      {
        "Station": "AL-BLOCK-07",
        "Date": "2026-06-18",
        "Time": "11:30:00",
        "Lat": "44.2001", // Blocker: Coordinate way out of Gulf of Mexico ranges
        "Lon": "-87.3501",
        "WaterTemp": "25.6",
        "Sal": "33.5",
        "Cells": "999999999", // Blocker: Cell count exceeds logical bounds
        "Depth": "500", // Warning: depth > 200m
        "Remarks": "Coordinates pointing to Michigan instead of Mobile Bay."
      }
    ]
  },
  {
    name: "Florida Panhandle - Warnings & Fahrenheit",
    filename: "florida_multi_sheet_raw.txt",
    description: "Highly complex Florida workbook with Fahrenheit temperatures requiring auto-scale formulas, duplicate records, high-ASCII characters, and blank depths.",
    state: "FL",
    quality: "Warnings",
    rows: [
      {
        "StationName": "FL-PAN-105",
        "SampleDate": "2026-06-20",
        "SampleTime": "10:00:00",
        "Latitude": "29°45'15.2\"N",
        "Longitude": "85°12'42.1\"W",
        "Water Temp (F)": "78.8", // Will be converted: 78.8F -> 26.0C
        "Salinity (psu)": "34.2",
        "Karenia brevis": "550000",
        "Depth (m)": "", // Empty: triggers Surface warning
        "Remarks": "High abundance bloom visible in water column. © NOAA" // non-ASCII character check
      },
      {
        "StationName": "FL-PAN-105", // Duplicate Check trigger: duplicate timestamp/location
        "SampleDate": "2026-06-20",
        "SampleTime": "10:00:00",
        "Latitude": "29°45'15.2\"N",
        "Longitude": "85°12'42.1\"W",
        "Water Temp (F)": "78.8",
        "Salinity (psu)": "34.2",
        "Karenia brevis": "550000",
        "Depth (m)": "1.0",
        "Remarks": "Duplicate re-analysis."
      },
      {
        "StationName": "FL-PAN-110",
        "SampleDate": "2026-06-20",
        "SampleTime": "11:20:00",
        "Latitude": "30.0125",
        "Longitude": "-85.3412",
        "Water Temp (F)": "82.4", // Will convert: 82.4F -> 28.0C
        "Salinity (psu)": "32.0",
        "Karenia brevis": "1200",
        "Depth (m)": "0.5",
        "Remarks": "Slight turbidity."
      },
      {
        "StationName": "FL-PAN-112",
        "SampleDate": "2026-06-20",
        "SampleTime": "13:05:00",
        "Latitude": "29.8872",
        "Longitude": "-85.2505",
        "Water Temp (F)": "26.5", // Celsius entered directly - checked bounds
        "Salinity (psu)": "55.0", // Scientific Warning: Salinity out of logical marine bounds (> 45)
        "Karenia brevis": "1200000",
        "Depth (m)": "2.2",
        "Remarks": "Hypersaline tidal pool."
      }
    ]
  },
  {
    name: "Texas Estuary - Midcontinent Glitch",
    filename: "texas_estuary_gulf_inbound.ts",
    description: "Texas sample dataset matching NOAA file structures. Includes a mid-continent coordinate glitch and severe missing salinity sensors.",
    state: "TX",
    quality: "Incomplete",
    rows: [
      {
        "STN_ID": "TX-GALV-05",
        "SDate": "2026-06-12",
        "STime": "06:15:00",
        "Lat_DD": "29.2312",
        "Lon_DD": "94.8102", // Longitude positive (94.81). System will resolve and auto-negate (West) -> -94.8102
        "Temp_C": "23.4",
        "Salinity": "ND", // Handled QA
        "Abundance": "1200",
        "Depth_M": "1.0"
      },
      {
        "STN_ID": "TX-GALV-06",
        "SDate": "2026-06-12",
        "STime": "07:45:00",
        "Lat_DD": "31.5420", // Landlocked warning: too far inland for Texas GOM
        "Lon_DD": "-97.1042", // Landlocked Waco area
        "Temp_C": "24.1",
        "Salinity": "0.1", // fresh water Salinity check Warning
        "Abundance": "0",
        "Depth_M": "0.5"
      },
      {
        "STN_ID": "TX-GALV-07",
        "SDate": "2026-06-12",
        "STime": "09:30:00",
        "Lat_DD": "29.3101",
        "Lon_DD": "-94.7521",
        "Temp_C": "24.8",
        "Salinity": "", // Empty salinity values
        "Abundance": "48000",
        "Depth_M": ""
      }
    ]
  }
];
