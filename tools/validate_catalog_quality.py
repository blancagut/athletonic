from __future__ import annotations

import argparse
import csv
import json
import os
import sqlite3
import sys
from typing import Any

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from config import DB_PATH, DATA_DIR
from utils.quality_gate import QualityRules, evaluate_catalog_quality


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate catalog pricing and descriptions before production export.",
    )
    parser.add_argument("--db", default=DB_PATH, help="Path to SQLite DB (default: config.DB_PATH)")
    parser.add_argument("--brand", default=None, help="Optional brand scope")
    parser.add_argument("--output", default=None, help="Output JSON report path")
    parser.add_argument("--anomalies-csv", default=None, help="Optional CSV output for sampled anomalies")
    parser.add_argument("--allowed-currencies", default="USD", help="Comma-separated allowed currency codes")
    parser.add_argument("--min-price", type=float, default=0.99)
    parser.add_argument("--max-price", type=float, default=999.99)
    parser.add_argument("--min-description-length", type=int, default=80)
    parser.add_argument("--max-empty-description-pct", type=float, default=0.0)
    parser.add_argument("--max-short-description-pct", type=float, default=5.0)
    parser.add_argument("--max-suspicious-html-pct", type=float, default=0.0)
    parser.add_argument("--strict-warnings", action="store_true", help="Fail gate on warnings too")
    parser.add_argument("--max-samples-per-issue", type=int, default=200)
    return parser.parse_args()


def _build_paths(args: argparse.Namespace) -> tuple[str, str]:
    os.makedirs(DATA_DIR, exist_ok=True)
    slug = args.brand or "all_brands"
    json_path = args.output or os.path.join(DATA_DIR, f"{slug}_quality_audit.json")
    csv_path = args.anomalies_csv or os.path.join(DATA_DIR, f"{slug}_quality_anomalies.csv")
    return json_path, csv_path


def _write_json(path: str, payload: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _write_csv(path: str, anomalies: list[dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "issue",
                "brand",
                "product_id",
                "name",
                "url",
                "price",
                "compare_at_price",
                "currency",
            ],
        )
        writer.writeheader()
        writer.writerows(anomalies)


def _print_summary(report: dict[str, Any], json_path: str, csv_path: str) -> None:
    gate = report["gate"]
    scope = report["scope"]

    print("Catalog Quality Audit")
    print(f"- Scope brand: {scope.get('brand') or 'all'}")
    print(f"- Active rows: {scope.get('active_rows', 0)}")
    print(f"- Gate passed: {gate.get('passed')}")
    print(f"- Critical issues: {gate.get('critical_issue_count', 0)}")
    print(f"- Warning issues: {gate.get('warning_issue_count', 0)}")
    if gate.get("blocking_reasons"):
        print("- Blocking reasons:")
        for reason in gate["blocking_reasons"]:
            print(f"  - {reason}")

    print(f"- JSON report: {json_path}")
    print(f"- Anomalies CSV: {csv_path}")


def main() -> int:
    args = _parse_args()

    allowed = tuple(
        c.strip().upper() for c in args.allowed_currencies.split(",") if c.strip()
    ) or ("USD",)

    rules = QualityRules(
        allowed_currencies=allowed,
        min_price=args.min_price,
        max_price=args.max_price,
        min_description_length=args.min_description_length,
        max_empty_description_pct=args.max_empty_description_pct,
        max_short_description_pct=args.max_short_description_pct,
        max_suspicious_html_pct=args.max_suspicious_html_pct,
        strict_warnings=args.strict_warnings,
        max_samples_per_issue=args.max_samples_per_issue,
    )

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    try:
        report = evaluate_catalog_quality(conn, brand=args.brand, rules=rules)
    finally:
        conn.close()

    json_path, csv_path = _build_paths(args)
    _write_json(json_path, report)
    _write_csv(csv_path, report.get("anomalies", []))
    _print_summary(report, json_path, csv_path)

    return 0 if report.get("gate", {}).get("passed") else 2


if __name__ == "__main__":
    raise SystemExit(main())
