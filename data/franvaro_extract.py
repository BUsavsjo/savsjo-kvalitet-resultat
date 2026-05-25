#!/usr/bin/env python3
"""
Läser alla läsårsrapporter för elevfrånvaro i data-mappen och skapar JSON
som appen kan använda för KPI:t "Frånvaro elever".

Förväntat filnamn:
    lasar 2024-2025.xls

Beräkning:
    total frånvaro % = (giltig frånvaro timmar + ogiltig frånvaro timmar) / undervisningstid timmar * 100

Körning från projektroten:
    py data\franvaro_extract.py

Skapar som standard:
    src/data/franvaro_elever.json
"""

import json
import re
import sys
from pathlib import Path

try:
    import xlrd
except ImportError:
    raise SystemExit("Saknar paketet xlrd. Installera med: pip install xlrd")


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "data" / "franvaro_elever.json"
EXCLUDED_SCHOOLS = {"aleholm sävsjö", "aleholm savsjo"}
MUNICIPALITY_NAME = "Sävsjö kommun"


def parse_swedish_number(value):
    """Konverterar t.ex. '179293,6 h', '5 %', '20021' till float."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("\xa0", " ")
    if not text:
        return 0.0
    text = re.sub(r"[^0-9,.-]", "", text)
    text = text.replace(" ", "").replace(",", ".")
    if text in {"", "-", "."}:
        return 0.0
    return float(text)


def pct(numerator, denominator):
    return 0.0 if denominator == 0 else numerator / denominator * 100


def school_year_from_filename(path):
    match = re.search(r"(20\d{2})\D+(20\d{2})", path.stem)
    if not match:
        raise ValueError(f"Kunde inte läsa ut läsår från filnamnet: {path.name}")
    return {
        "label": f"{match.group(1)}-{match.group(2)}",
        "start": int(match.group(1)),
        "end": int(match.group(2)),
    }


def round1(value):
    return round(float(value), 1)


def normalize_school_name(name):
    return " ".join(str(name).strip().split())


def should_exclude_school(name):
    return normalize_school_name(name).lower() in EXCLUDED_SCHOOLS


def build_row(level, name, school_year, undervisningstid, lektioner, ej_reg_tid_pct, narvaro_h, giltig_h, ogiltig_h):
    total_h = giltig_h + ogiltig_h
    return {
        "level": level,
        "name": name,
        "year": school_year["end"],
        "schoolYear": school_year["label"],
        "undervisningstid_h": round1(undervisningstid),
        "lektioner": int(lektioner),
        "ej_registrerad_tid_pct": round1(ej_reg_tid_pct) if ej_reg_tid_pct != "" else None,
        "narvaro_h": round1(narvaro_h),
        "giltig_franvaro_h": round1(giltig_h),
        "ogiltig_franvaro_h": round1(ogiltig_h),
        "total_franvaro_h": round1(total_h),
        "narvaro_pct": round1(pct(narvaro_h, undervisningstid)),
        "giltig_franvaro_pct": round1(pct(giltig_h, undervisningstid)),
        "ogiltig_franvaro_pct": round1(pct(ogiltig_h, undervisningstid)),
        "total_franvaro_pct": round1(pct(total_h, undervisningstid)),
        "source": "Lokal frånvarorapport",
    }


def read_attendance_report(path):
    school_year = school_year_from_filename(path)
    book = xlrd.open_workbook(str(path))
    sheet = book.sheet_by_index(0)

    header_row = None
    for r in range(sheet.nrows):
        first = str(sheet.cell_value(r, 0)).strip().lower()
        if first == "skola":
            header_row = r
            break
    if header_row is None:
        raise ValueError("Hittade ingen rubrikrad där första kolumnen är 'Skola'.")

    schools = []
    for r in range(header_row + 1, sheet.nrows):
        school = normalize_school_name(sheet.cell_value(r, 0))
        if not school or should_exclude_school(school):
            continue

        undervisningstid = parse_swedish_number(sheet.cell_value(r, 1))
        lektioner = int(parse_swedish_number(sheet.cell_value(r, 2)))
        ej_reg_tid_pct = parse_swedish_number(sheet.cell_value(r, 3))
        narvaro_h = parse_swedish_number(sheet.cell_value(r, 6))
        giltig_h = parse_swedish_number(sheet.cell_value(r, 7))
        ogiltig_h = parse_swedish_number(sheet.cell_value(r, 8))

        schools.append(build_row(
            "school",
            school,
            school_year,
            undervisningstid,
            lektioner,
            ej_reg_tid_pct,
            narvaro_h,
            giltig_h,
            ogiltig_h,
        ))

    included = [row for row in schools if row["undervisningstid_h"] > 0]
    total_undv = sum(row["undervisningstid_h"] for row in included)
    total_lekt = sum(row["lektioner"] for row in included)
    total_narvaro = sum(row["narvaro_h"] for row in included)
    total_giltig = sum(row["giltig_franvaro_h"] for row in included)
    total_ogiltig = sum(row["ogiltig_franvaro_h"] for row in included)

    municipality = build_row(
        "municipality",
        MUNICIPALITY_NAME,
        school_year,
        total_undv,
        total_lekt,
        "",
        total_narvaro,
        total_giltig,
        total_ogiltig,
    )
    return municipality, schools


def discover_input_files():
    return sorted(DATA_DIR.glob("lasar *.xls"), key=lambda path: school_year_from_filename(path)["end"])


def build_payload(input_files):
    municipality = []
    schools_by_name = {}

    for path in input_files:
        municipality_row, school_rows = read_attendance_report(path)
        municipality.append(municipality_row)
        for row in school_rows:
            enriched = {
                **row,
                "municipalityValue": municipality_row["total_franvaro_pct"],
                "municipalityName": municipality_row["name"],
            }
            schools_by_name.setdefault(row["name"], []).append(enriched)

    schools = [
        {"name": name, "values": sorted(values, key=lambda row: row["year"])}
        for name, values in sorted(schools_by_name.items(), key=lambda item: item[0].lower())
    ]

    return {
        "metric": "studentAbsence",
        "unit": "%",
        "generatedFrom": [path.name for path in input_files],
        "municipality": sorted(municipality, key=lambda row: row["year"]),
        "schools": schools,
    }


def write_json(payload, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def main():
    output_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    input_files = discover_input_files()
    if not input_files:
        raise SystemExit(f"Hittade inga filer som matchar {DATA_DIR / 'lasar *.xls'}")

    payload = build_payload(input_files)
    write_json(payload, output_path)

    print(f"Läste {len(input_files)} filer:")
    for filename in payload["generatedFrom"]:
        print(f"  - {filename}")
    print(f"Skapade: {output_path}")
    print(f"Kommunrader: {len(payload['municipality'])}")
    print(f"Skolenheter: {len(payload['schools'])}")


if __name__ == "__main__":
    main()
