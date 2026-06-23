"""
LocalValidator: NOAA HABSOS Ingestion Preflight Validation Engine
Designed for HABS Grabber Pipeline Alignment.
"""
import os
import sys
import csv
from datetime import datetime

# Stubbed or actual imports mapping the remote pipeline schema modules
# to ensure runtime portability and robust standalone validation.
try:
    from HABSGrabber import constants, QA, validation, ranges
except ImportError:
    # Standalone fallbacks mirroring the HABSGrabber logic
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
            """Degree-Minute-Seconds string to Decimal Degrees conversion."""
            if not dms_str:
                return None
            val = str(dms_str).strip()
            try:
                return float(val)
            except ValueError:
                pass
            # DMS split logic
            import re
            match = re.match(r'^(-?\d+)[°\s:-]+(\d+)[′\'\s:-]+(\d+(?:\.\d+)?)[″"\s]*([NSEWnsew]?)$', val)
            if match:
                deg, mns, sec, direction = match.groups()
                decimal = abs(int(deg)) + int(mns)/60.0 + float(sec)/3600.0
                if int(deg) < 0 or direction.upper() in ["S", "W"]:
                    decimal = -decimal
                return decimal
            return None

        @staticmethod
        def clean_fahrenheit_to_celsius(temp_val, header_or_unit_f=False):
            """Data scrubbing and automatic unit conversion."""
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
            """Standard hard-stop verification constraints."""
            is_valid = True
            errors = []
            
            # Lat Lon hard-stops
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
    """Encapsulates execution logs, validation scores, and target file mapping."""
    def __init__(self, filename=""):
        self.filename = filename
        self.timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.records_processed = 0
        self.records_passed = 0
        self.records_failed = 0
        self.blocker_count = 0
        self.data_quality_count = 0 # range failures
        self.details = [] # list of lists of issues
        self.readiness = "READY" # READY, REVIEW, BLOCKED

    def compute_summary(self):
        if self.blocker_count > 0:
            self.readiness = "BLOCKED"
        elif self.data_quality_count > 0:
            self.readiness = "REVIEW"
        else:
            self.readiness = "READY"

    def to_dict(self):
        return {
            "filename": self.filename,
            "timestamp": self.timestamp,
            "records_processed": self.records_processed,
            "records_passed": self.records_passed,
            "records_failed": self.records_failed,
            "blocker_count": self.blocker_count,
            "data_quality_count": self.data_quality_count,
            "readiness": self.readiness,
            "validation_score": round((self.records_passed / max(1, self.records_processed)) * 100, 1),
            "details": self.details
        }


class LocalValidator:
    """Primary workbench component replicating HABSGrabber server directives."""
    def __init__(self):
        self.ranges = ranges.VALID_RANGES
        self.term_map = constants.TERM_MAP

    def normalize_headers(self, raw_headers):
        """Maps varying raw intake file headers back to official termMap keys."""
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
        """Accepts raw inputs, normalizes headers, scrubs data, and applies hard-stops."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Source file {filepath} could not be resolved.")

        filename = os.path.basename(filepath)
        report = ValidationReport(filename)

        # Detect delimiter if not provided
        if not delimiter:
            _, ext = os.path.splitext(filepath)
            if ext.lower() in ['.tsv', '.txt']:
                delimiter = '\t'
            else:
                delimiter = ','

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            raw_headers = reader.fieldnames if reader.fieldnames else []
            header_map = self.normalize_headers(raw_headers)
            
            # Map column synonyms back to indices
            report.details = []
            
            for index, row in enumerate(reader, start=1):
                report.records_processed += 1
                row_errors = []
                is_row_blocked = False
                is_row_warning = False

                # Extract and normalize fields
                raw_station = row.get(header_map.get("STATION_ID", ""), "").strip()
                raw_date = row.get(header_map.get("DATE", ""), "").strip()
                raw_time = row.get(header_map.get("TIME", ""), "").strip()
                raw_lat = row.get(header_map.get("LATITUDE", ""), "").strip()
                raw_lon = row.get(header_map.get("LONGITUDE", ""), "").strip()
                raw_temp = row.get(header_map.get("WTEMP", ""), "").strip()
                raw_sal = row.get(header_map.get("SALINITY", ""), "").strip()
                raw_cells = row.get(header_map.get("CELL_COUNT", ""), "").strip()
                raw_depth = row.get(header_map.get("DEPTH", ""), "").strip()
                raw_remarks = row.get(header_map.get("REMARKS", ""), "").strip()

                # Rule 1: Structural Check (Date & coordinates are hard requirements)
                if not raw_date or not raw_lat or not raw_lon:
                    row_errors.append({"level": "BLOCKER", "message": "Missing required core dimensions: DATE, LATITUDE, or LONGITUDE"})
                    is_row_blocked = True

                # Coordinate parsing using DMS2DD
                lat_dd = QA.dms_to_dd(raw_lat)
                lon_dd = QA.dms_to_dd(raw_lon)

                # West longitudes auto-negated
                if lon_dd is not None and lon_dd > 0:
                    lon_dd = -lon_dd

                # QA rule check: Fahrenheit conversion
                is_f = "f" in raw_temp.lower() or "temp_f" in str(header_map.get("WTEMP", "")).lower()
                clean_temp = QA.clean_fahrenheit_to_celsius(raw_temp, is_f)

                # Salinity conversions
                clean_sal = None
                if raw_sal:
                    try:
                        clean_sal = float(raw_sal)
                    except ValueError:
                        row_errors.append({"level": "WARNING", "message": f"Couldn't convert salinity to float: {raw_sal}"})
                        is_row_warning = True

                # Validation checks against standard ranges (ranges.py)
                validated_record = {
                    "LATITUDE": lat_dd,
                    "LONGITUDE": lon_dd
                }
                
                # Check geographic bounds via hard-stop validation
                is_geo_ok, geo_errs = validation.validate_observation(validated_record, self.ranges)
                if not is_geo_ok:
                    for ge in geo_errs:
                        row_errors.append({"level": "BLOCKER", "message": ge})
                    is_row_blocked = True

                # Scientific validation on secondary ranges
                if clean_temp is not None:
                    temp_bounds = self.ranges["WTEMP"]
                    if not (temp_bounds["min"] <= clean_temp <= temp_bounds["max"]):
                        row_errors.append({"level": "WARNING", "message": f"Water Temp ({clean_temp:.1f} C) exceeds range limits."})
                        is_row_warning = True
                
                if clean_sal is not None:
                    sal_bounds = self.ranges["SALINITY"]
                    if not (sal_bounds["min"] <= clean_sal <= sal_bounds["max"]):
                        row_errors.append({"level": "WARNING", "message": f"Salinity {clean_sal} psu exceeds range limits."})
                        is_row_warning = True

                # Log results
                if is_row_blocked:
                    report.blocker_count += 1
                elif is_row_warning:
                    report.data_quality_count += 1
                else:
                    report.records_passed += 1

                if row_errors:
                    report.details.append({
                        "row": index,
                        "station": raw_station or "STN_UNKNOWN",
                        "issues": row_errors
                    })

        report.records_failed = report.blocker_count + report.data_quality_count
        report.compute_summary()
        return report

    def export_tsv(self, report, validated_records, output_directory, output_filename):
        """Writes clean preflight data as standard compliance tab-delimited files."""
        os.makedirs(output_directory, exist_ok=True)
        output_path = os.path.join(output_directory, output_filename)
        
        headers = [
            "STATION_ID", "SAMPLE_DATE", "SAMPLE_TIME", "LATITUDE_DD", "LONGITUDE_DD",
            "CELL_COUNT_CELLS_L", "WATER_TEMP_C", "SALINITY_PSU", "DEPTH_M", "REMARKS"
        ]
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f, delimiter='\t')
            writer.writerow(headers)
            for r in validated_records:
                if r.get("severity") == "BLOCKER":
                    continue
                writer.writerow([
                    r.get("STATION_ID", ""),
                    r.get("DATE", ""),
                    r.get("TIME", "12:00:00"),
                    f"{r.get('LATITUDE'):.6f}" if r.get('LATITUDE') is not None else "NaN",
                    f"{r.get('LONGITUDE'):.6f}" if r.get('LONGITUDE') is not None else "NaN",
                    str(r.get("CELL_COUNT", "0")),
                    f"{r.get('WTEMP'):.2f}" if r.get('WTEMP') is not None else "NaN",
                    f"{r.get('SALINITY'):.2f}" if r.get('SALINITY') is not None else "NaN",
                    f"{r.get('DEPTH'):.2f}" if r.get('DEPTH') is not None else "0.00",
                    str(r.get("REMARKS", "")).replace('\t', ' ')
                ])
                
        return output_path
