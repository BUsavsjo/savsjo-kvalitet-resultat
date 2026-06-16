#!/usr/bin/env python3
"""
Uppdaterar src/data/kpi_franvaro_alla_lasar.json från aggregerade
frånvarostatistikfiler i data/franvarostatistik.

Skriptet behåller befintliga historiska läsår och ersätter endast läsåret
som finns i rektorssammanställningen, normalt 2025-2026.
"""

import json
import re
from datetime import date
from pathlib import Path

import openpyxl
import xlrd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "data" / "franvarostatistik"
COMBINED_WORKBOOK = SOURCE_DIR / "frånvarostatistik grundskola.xlsx"
SCHOOL_WORKBOOK = SOURCE_DIR / "sammanställning sävsjö 2025 2026 - läsår Rektor.xls"
OUTPUT = PROJECT_ROOT / "src" / "data" / "kpi_franvaro_alla_lasar.json"
TARGET_SCHOOL_YEAR = "2025-2026"

SCHOOL_IDS = {
    "Hofgård": "hofgard",
    "Hägne": "hagne",
    "Rörvik": "rorvik",
    "Stockaryd": "stockaryd",
    "Vallsjö": "vallsjo",
    "Vrigstad": "vrigstad",
}

TOTAL_BUCKETS = [
    ("0_5", "Total frånvaro 0-5 %", 0.0, 0.05, "low", 0.025),
    ("5_15", "Total frånvaro 5,1-15 %", 0.05, 0.15, "attention", 0.10),
    ("15_30", "Total frånvaro 15,1-30 %", 0.15, 0.30, "risk", 0.225),
    ("30_50", "Total frånvaro 30,1-50 %", 0.30, 0.50, "high", 0.40),
    ("50_plus", "Total frånvaro över 50 %", 0.50, None, "critical", 0.60),
]

UNAUTHORISED_BUCKETS = [
    ("1_5", "Ogiltig frånvaro 1-5 %", 0.01, 0.05, "attention", 0.03),
    ("5_15", "Ogiltig frånvaro 5,1-15 %", 0.05, 0.15, "risk", 0.10),
    ("15_plus", "Ogiltig frånvaro över 15 %", 0.15, None, "critical", 0.20),
]


def to_int(value):
    if value in ("", None):
        return 0
    return int(round(float(value)))


def ratio(count, total):
    if not total:
        return None
    return round(count / total, 4)


def weighted_average(counts, buckets, total, zero_count=0):
    if not total:
        return None
    weighted = sum(counts.get(key, 0) * midpoint for key, _, _, _, _, midpoint in buckets)
    return round(weighted / total, 4)


def risk_level(total_15_plus_share, total_30_plus_share, unauthorised_5_plus_share):
    total_15 = total_15_plus_share or 0
    total_30 = total_30_plus_share or 0
    unauth_5 = unauthorised_5_plus_share or 0
    if total_30 >= 0.05 or total_15 >= 0.25:
        return "critical"
    if total_15 >= 0.15 or unauth_5 >= 0.10:
        return "red"
    if total_15 >= 0.08 or unauth_5 >= 0.03:
        return "yellow"
    return "green"


def privacy(student_count):
    return {
        "small_group": student_count < 10,
        "note": "Inga namn eller personnummer ingår. Små grupper bör inte visas öppet i kommunvy.",
    }


def normalise_grade(value):
    text = str(value).strip()
    text = re.sub(r"^Åk\s*", "", text, flags=re.IGNORECASE)
    text = text.replace("F-klass", "F").replace("Fklass", "F")
    if text.upper() == "F":
        return "F"
    number = int(float(text))
    if 1 <= number <= 9:
        return str(number)
    raise ValueError(f"Ogiltig årskurs: {value!r}")


def build_summary(scope, school_id, school_name, grade, student_count, total_counts, unauth_counts):
    total_15_plus = total_counts["15_30"] + total_counts["30_50"] + total_counts["50_plus"]
    total_30_plus = total_counts["30_50"] + total_counts["50_plus"]
    total_50_plus = total_counts["50_plus"]
    unauth_5_plus = unauth_counts["5_15"] + unauth_counts["15_plus"]
    unauth_15_plus = unauth_counts["15_plus"]

    total_15_plus_share = ratio(total_15_plus, student_count)
    total_30_plus_share = ratio(total_30_plus, student_count)
    unauth_5_plus_share = ratio(unauth_5_plus, student_count)

    return {
        "school_year": TARGET_SCHOOL_YEAR,
        "scope": scope,
        "school_id": school_id,
        "school_name": school_name,
        "grade": grade,
        "student_count": student_count,
        "avg_total_absence_share": weighted_average(total_counts, TOTAL_BUCKETS, student_count),
        "avg_unauthorised_absence_share": weighted_average(unauth_counts, UNAUTHORISED_BUCKETS, student_count),
        "total_absence_5_15_count": total_counts["5_15"],
        "total_absence_5_15_share": ratio(total_counts["5_15"], student_count),
        "total_absence_over_10_count": None,
        "total_absence_over_10_share": None,
        "total_absence_15_plus_count": total_15_plus,
        "total_absence_15_plus_share": total_15_plus_share,
        "total_absence_30_plus_count": total_30_plus,
        "total_absence_30_plus_share": total_30_plus_share,
        "total_absence_50_plus_count": total_50_plus,
        "total_absence_50_plus_share": ratio(total_50_plus, student_count),
        "unauthorised_absence_1_5_count": unauth_counts["1_5"],
        "unauthorised_absence_1_5_share": ratio(unauth_counts["1_5"], student_count),
        "unauthorised_absence_5_plus_count": unauth_5_plus,
        "unauthorised_absence_5_plus_share": unauth_5_plus_share,
        "unauthorised_absence_15_plus_count": unauth_15_plus,
        "unauthorised_absence_15_plus_share": ratio(unauth_15_plus, student_count),
        "overall_risk_level": risk_level(total_15_plus_share, total_30_plus_share, unauth_5_plus_share),
        "privacy": privacy(student_count),
    }


def build_observations(school_name, grade, student_count, total_counts, unauth_counts):
    rows = []
    school_id = SCHOOL_IDS[school_name]
    for key, label, min_share, max_share, risk, _ in TOTAL_BUCKETS:
        count = total_counts[key]
        rows.append({
            "school_year": TARGET_SCHOOL_YEAR,
            "school_id": school_id,
            "school_name": school_name,
            "grade": grade,
            "absence_type": "total",
            "bucket": key,
            "bucket_label": label,
            "bucket_min_share": min_share,
            "bucket_max_share": max_share,
            "students_in_bucket": count,
            "display_count": count,
            "share_in_bucket": ratio(count, student_count),
            "risk_level": risk,
            "suppressed": False,
            "suppression_reason": None,
            "group_student_count": student_count,
        })
    for key, label, min_share, max_share, risk, _ in UNAUTHORISED_BUCKETS:
        count = unauth_counts[key]
        rows.append({
            "school_year": TARGET_SCHOOL_YEAR,
            "school_id": school_id,
            "school_name": school_name,
            "grade": grade,
            "absence_type": "unauthorised",
            "bucket": key,
            "bucket_label": label,
            "bucket_min_share": min_share,
            "bucket_max_share": max_share,
            "students_in_bucket": count,
            "display_count": count,
            "share_in_bucket": ratio(count, student_count),
            "risk_level": risk,
            "suppressed": False,
            "suppression_reason": None,
            "group_student_count": student_count,
        })
    return rows


def sum_counts(rows, key):
    result = {}
    for bucket in key:
        result[bucket] = sum(row[bucket] for row in rows)
    return result


def read_school_rows():
    book = xlrd.open_workbook(str(SCHOOL_WORKBOOK))
    rows = []
    for school_name in SCHOOL_IDS:
        sheet = book.sheet_by_name(school_name)
        header_row = None
        for r in range(sheet.nrows):
            if str(sheet.cell_value(r, 6)).strip().lower() == "årskurs":
                header_row = r
                break
        if header_row is None:
            raise ValueError(f"Hittade ingen rubrikrad i bladet {school_name}")

        started = False
        for r in range(header_row + 1, sheet.nrows):
            grade_cell = str(sheet.cell_value(r, 6)).strip()
            if not grade_cell:
                if started:
                    break
                continue
            started = True
            if not grade_cell.lower().startswith("åk"):
                break
            grade = normalise_grade(grade_cell)
            student_count = to_int(sheet.cell_value(r, 16))
            rows.append({
                "school_name": school_name,
                "school_id": SCHOOL_IDS[school_name],
                "grade": grade,
                "student_count": student_count,
                "0_5": to_int(sheet.cell_value(r, 7)),
                "5_15": to_int(sheet.cell_value(r, 8)),
                "15_30": to_int(sheet.cell_value(r, 9)),
                "30_50": to_int(sheet.cell_value(r, 10)),
                "50_plus": to_int(sheet.cell_value(r, 11)),
                "1_5": to_int(sheet.cell_value(r, 13)),
                "u5_15": to_int(sheet.cell_value(r, 14)),
                "u15_plus": to_int(sheet.cell_value(r, 15)),
            })
    return rows


def read_municipality_grade_rows():
    workbook = openpyxl.load_workbook(COMBINED_WORKBOOK, data_only=True, read_only=True)
    sheet = workbook[TARGET_SCHOOL_YEAR]
    rows = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if row[0] in ("", None) or row[2] in ("", None):
            continue
        grade = normalise_grade(row[2])
        rows.append({
            "grade": grade,
            "student_count": to_int(row[0]),
            "0_5": to_int(row[3]),
            "5_15": to_int(row[4]),
            "15_30": to_int(row[5]),
            "30_50": to_int(row[6]),
            "50_plus": to_int(row[7]),
            "1_5": to_int(row[9]),
            "u5_15": to_int(row[10]),
            "u15_plus": to_int(row[11]),
        })
    return rows


def split_counts(row):
    total = {key: row[key] for key, *_ in TOTAL_BUCKETS}
    unauth = {
        "1_5": row["1_5"],
        "5_15": row["u5_15"],
        "15_plus": row["u15_plus"],
    }
    return total, unauth


def build_new_rows():
    summaries = []
    observations = []

    municipality_grade_rows = read_municipality_grade_rows()
    for row in municipality_grade_rows:
        total, unauth = split_counts(row)
        summaries.append(build_summary("municipality_grade", None, None, row["grade"], row["student_count"], total, unauth))

    municipality_total_counts = sum_counts(municipality_grade_rows, [key for key, *_ in TOTAL_BUCKETS])
    municipality_unauth_counts = {
        "1_5": sum(row["1_5"] for row in municipality_grade_rows),
        "5_15": sum(row["u5_15"] for row in municipality_grade_rows),
        "15_plus": sum(row["u15_plus"] for row in municipality_grade_rows),
    }
    municipality_students = sum(row["student_count"] for row in municipality_grade_rows)
    summaries.insert(0, build_summary("municipality", None, None, None, municipality_students, municipality_total_counts, municipality_unauth_counts))

    school_rows = read_school_rows()
    for school_name in SCHOOL_IDS:
        school_grade_rows = [row for row in school_rows if row["school_name"] == school_name]
        school_total_counts = sum_counts(school_grade_rows, [key for key, *_ in TOTAL_BUCKETS])
        school_unauth_counts = {
            "1_5": sum(row["1_5"] for row in school_grade_rows),
            "5_15": sum(row["u5_15"] for row in school_grade_rows),
            "15_plus": sum(row["u15_plus"] for row in school_grade_rows),
        }
        school_students = sum(row["student_count"] for row in school_grade_rows)
        summaries.append(build_summary("school", SCHOOL_IDS[school_name], school_name, None, school_students, school_total_counts, school_unauth_counts))

        for row in school_grade_rows:
            total, unauth = split_counts(row)
            summaries.append(build_summary("school_grade", SCHOOL_IDS[school_name], school_name, row["grade"], row["student_count"], total, unauth))
            observations.extend(build_observations(school_name, row["grade"], row["student_count"], total, unauth))

    return summaries, observations


def main():
    with open(OUTPUT, encoding="utf-8") as file:
        payload = json.load(file)

    new_summaries, new_observations = build_new_rows()
    payload["summaries"] = [
        row for row in payload.get("summaries", [])
        if row.get("school_year") != TARGET_SCHOOL_YEAR
    ] + new_summaries
    payload["observations"] = [
        row for row in payload.get("observations", [])
        if row.get("school_year") != TARGET_SCHOOL_YEAR
    ] + new_observations

    metadata = payload.setdefault("metadata", {})
    metadata["generated_at"] = date.today().isoformat()
    metadata["source_files"] = [
        "sammanställning sävsjö 2022 2023.xlsx",
        "sammanställning sävsjö 2023 2024 - läsår.xlsx",
        "sammanställning sävsjö 2024 2025 - läsår.xlsx",
        COMBINED_WORKBOOK.name,
        SCHOOL_WORKBOOK.name,
    ]
    metadata["note"] = (
        "Kombinerad fil för dashboard. 2025-2026 bygger på aggregerat "
        "intervallunderlag; total_absence_over_10 saknas i källfilen och sätts till null."
    )

    with open(OUTPUT, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Skapade {len(new_summaries)} summary-rader och {len(new_observations)} observationsrader för {TARGET_SCHOOL_YEAR}.")
    print(f"Skrev: {OUTPUT}")


if __name__ == "__main__":
    main()
