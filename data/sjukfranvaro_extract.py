#!/usr/bin/env python3
r"""
Läser årsrapporter för personalens sjukfrånvaro och skapar JSON för KPI:t
"Frånvaro personal".

Förväntat filnamn:
    2025 sjukfrånvaro BU-.xlsx

Körning från projektroten:
    py data\sjukfranvaro_extract.py

Skapar som standard:
    src/data/sjukfranvaro_personal.json
"""

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent / "sjukfranvaro"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "data" / "sjukfranvaro_personal.json"
MUNICIPALITY_NAME = "Sävsjö kommun"
SOURCE = "Lokal HR-rapport"
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXPECTED_SCHOOLS = [
    "Hofgårdsskolan",
    "Hägneskolan",
    "Rörviks skola",
    "Stockaryds skola",
    "Vallsjöskolan",
    "Vrigstad skola",
]
SCHOOL_NAME_MAP = {
    "Stockaryd skola": "Stockaryds skola",
}


def parse_number(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("\xa0", " ")
    if not text:
        return 0.0
    text = re.sub(r"[^0-9,.-]", "", text).replace(",", ".")
    if text in {"", "-", "."}:
        return 0.0
    return float(text)


def round1(value):
    return round(float(value), 1)


def pct(numerator, denominator):
    return 0.0 if denominator == 0 else numerator / denominator * 100


def year_from_filename(path):
    match = re.search(r"(20\d{2})", path.stem)
    if not match:
        raise ValueError(f"Kunde inte läsa ut år från filnamnet: {path.name}")
    return int(match.group(1))


def col_index(cell_ref):
    letters = re.match(r"([A-Z]+)", cell_ref).group(1)
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - ord("A") + 1
    return value


def read_xlsx_rows(path):
    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(text.text or "" for text in item.findall(".//a:t", NS))
                for item in root.findall("a:si", NS)
            ]

        sheet_name = next(
            name for name in archive.namelist()
            if name.startswith("xl/worksheets/") and name.endswith(".xml") and "_rels" not in name
        )
        root = ET.fromstring(archive.read(sheet_name))

    rows = []
    for row in root.findall(".//a:sheetData/a:row", NS):
        values = {}
        for cell in row.findall("a:c", NS):
            cell_ref = cell.get("r", "")
            value_node = cell.find("a:v", NS)
            value = "" if value_node is None else value_node.text
            if cell.get("t") == "s" and value != "":
                value = shared_strings[int(value)]
            values[col_index(cell_ref)] = value
        rows.append({"r": int(row.get("r")), "values": values})
    return rows


def row_text(row):
    return " ".join(str(value) for value in row["values"].values() if str(value).strip())


def first_cell(row):
    return str(row["values"].get(2, "")).strip()


def is_detail_row(row):
    name = first_cell(row)
    if not name or name.startswith("Summa ") or name.startswith("Totalsumma"):
        return False
    return parse_number(row["values"].get(11)) > 0


def aggregate_rows(rows):
    sick_hours = sum(parse_number(row["values"].get(6)) for row in rows)
    work_hours = sum(parse_number(row["values"].get(11)) for row in rows)
    long_sick_hours = sum(parse_number(row["values"].get(19)) for row in rows)
    return {
        "value": round1(pct(sick_hours, work_hours)),
        "sjukfranvaro_h": round1(sick_hours),
        "ordinarie_arbetstid_h": round1(work_hours),
        "langtidssjukfranvaro_h": round1(long_sick_hours),
        "langtidssjukfranvaro_pct": round1(pct(long_sick_hours, sick_hours)),
    }


def build_point(year, rows, name=None, municipality_value=None):
    point = {
        "year": year,
        **aggregate_rows(rows),
        "source": SOURCE,
    }
    if name:
        point["name"] = name
    if municipality_value is not None:
        point["municipalityValue"] = municipality_value
        point["municipalityName"] = MUNICIPALITY_NAME
    return point


def read_report(path):
    year = year_from_filename(path)
    rows = read_xlsx_rows(path)
    detail_rows = [row for row in rows if is_detail_row(row)]
    municipality = build_point(year, detail_rows)

    school_values = {}
    current_group = []
    for row in rows:
        label = first_cell(row)
        if label.startswith("Summa Enhet:"):
            raw_name = label.replace("Summa Enhet:", "").strip()
            if raw_name:
                school_name = SCHOOL_NAME_MAP.get(raw_name, raw_name)
                school_values[school_name] = build_point(
                    year,
                    current_group,
                    name=school_name,
                    municipality_value=municipality["value"],
                )
            current_group = []
            continue
        if is_detail_row(row):
            current_group.append(row)

    return municipality, school_values


def discover_input_files():
    return sorted(DATA_DIR.glob("*.xlsx"), key=year_from_filename)


def build_payload(input_files):
    municipality = []
    schools_by_name = {name: [] for name in EXPECTED_SCHOOLS}
    warnings = []

    for path in input_files:
        municipality_row, school_rows = read_report(path)
        municipality.append(municipality_row)
        for name, row in school_rows.items():
            schools_by_name.setdefault(name, []).append(row)

        missing = [name for name in EXPECTED_SCHOOLS if name not in school_rows]
        if missing:
            warnings.append(f"{path.name}: saknar {', '.join(missing)}")

    schools = [
        {"name": name, "values": sorted(values, key=lambda row: row["year"])}
        for name, values in sorted(schools_by_name.items(), key=lambda item: item[0].lower())
    ]

    return {
        "metric": "staffAbsence",
        "unit": "%",
        "generatedFrom": [path.name for path in input_files],
        "municipality": sorted(municipality, key=lambda row: row["year"]),
        "schools": schools,
        "warnings": warnings,
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
        raise SystemExit(f"Hittade inga filer som matchar {DATA_DIR / '*.xlsx'}")

    payload = build_payload(input_files)
    write_json(payload, output_path)

    print(f"Läste {len(input_files)} filer:")
    for filename in payload["generatedFrom"]:
        print(f"  - {filename}")
    print(f"Skapade: {output_path}")
    print(f"Kommunrader: {len(payload['municipality'])}")
    print(f"Skolenheter: {len(payload['schools'])}")
    for warning in payload["warnings"]:
        print(f"Varning: {warning}")


if __name__ == "__main__":
    main()
