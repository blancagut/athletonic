from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from typing import Any

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
SUSPICIOUS_HTML_RE = re.compile(r"<\s*(script|iframe)\b|on\w+\s*=", re.IGNORECASE)


@dataclass(frozen=True)
class QualityRules:
    allowed_currencies: tuple[str, ...] = ("USD",)
    min_price: float = 0.99
    max_price: float = 999.99
    min_description_length: int = 80
    max_empty_description_pct: float = 0.0
    max_short_description_pct: float = 5.0
    max_suspicious_html_pct: float = 0.0
    strict_warnings: bool = False
    max_samples_per_issue: int = 100


CRITICAL_ISSUES = {
    "missing_price",
    "zero_price",
    "negative_price",
    "invalid_currency",
    "compare_at_inversion",
    "empty_description",
}

WARNING_ISSUES = {
    "low_price_outlier",
    "high_price_outlier",
    "short_description",
    "suspicious_html",
    "duplicate_description",
}


def _clean_description(value: str | None) -> str:
    if not value:
        return ""
    plain = HTML_TAG_RE.sub(" ", unescape(value))
    return WHITESPACE_RE.sub(" ", plain).strip()


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round((part * 100.0) / whole, 4)


def _row_sample(row: dict[str, Any], issue: str) -> dict[str, Any]:
    return {
        "issue": issue,
        "brand": row.get("brand"),
        "product_id": row.get("product_id"),
        "name": row.get("name"),
        "url": row.get("url"),
        "price": row.get("price"),
        "compare_at_price": row.get("compare_at_price"),
        "currency": row.get("currency"),
    }


def _append_sample(samples: dict[str, list[dict[str, Any]]], issue: str, row: dict[str, Any], max_samples: int) -> None:
    bucket = samples[issue]
    if len(bucket) < max_samples:
        bucket.append(_row_sample(row, issue))


def _build_scope_query(has_columns: set[str], brand: str | None) -> tuple[str, list[Any]]:
    where: list[str] = []
    params: list[Any] = []

    if brand:
        where.append("brand = ?")
        params.append(brand)

    if "available" in has_columns:
        where.append("COALESCE(available, 1) = 1")
    if "excluded" in has_columns:
        where.append("COALESCE(excluded, 0) = 0")
    if "discontinued" in has_columns:
        where.append("COALESCE(discontinued, 0) = 0")

    where_sql = " AND ".join(where) if where else "1=1"
    sql = f"""
        SELECT
            brand,
            product_id,
            name,
            url,
            price,
            compare_at_price,
            currency,
            description_html
        FROM products
        WHERE {where_sql}
    """
    return sql, params


def evaluate_catalog_quality(
    conn: Any,
    *,
    brand: str | None = None,
    rules: QualityRules | None = None,
) -> dict[str, Any]:
    rules = rules or QualityRules()

    cols = {r[1] for r in conn.execute("PRAGMA table_info(products)").fetchall()}
    sql, params = _build_scope_query(cols, brand)
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]

    total = len(rows)
    allowed_currencies = {c.upper() for c in rules.allowed_currencies}

    issue_counts: dict[str, int] = defaultdict(int)
    issue_by_brand: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    issue_samples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    duplicate_index: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        brand_name = str(row.get("brand") or "")
        price = row.get("price")
        compare_at_price = row.get("compare_at_price")
        currency = str(row.get("currency") or "").strip().upper()
        raw_desc = row.get("description_html")
        desc_clean = _clean_description(raw_desc)

        if price is None:
            issue_counts["missing_price"] += 1
            issue_by_brand["missing_price"][brand_name] += 1
            _append_sample(issue_samples, "missing_price", row, rules.max_samples_per_issue)
        else:
            if price == 0:
                issue_counts["zero_price"] += 1
                issue_by_brand["zero_price"][brand_name] += 1
                _append_sample(issue_samples, "zero_price", row, rules.max_samples_per_issue)
            if price < 0:
                issue_counts["negative_price"] += 1
                issue_by_brand["negative_price"][brand_name] += 1
                _append_sample(issue_samples, "negative_price", row, rules.max_samples_per_issue)
            if 0 < price < rules.min_price:
                issue_counts["low_price_outlier"] += 1
                issue_by_brand["low_price_outlier"][brand_name] += 1
                _append_sample(issue_samples, "low_price_outlier", row, rules.max_samples_per_issue)
            if price > rules.max_price:
                issue_counts["high_price_outlier"] += 1
                issue_by_brand["high_price_outlier"][brand_name] += 1
                _append_sample(issue_samples, "high_price_outlier", row, rules.max_samples_per_issue)

        if currency not in allowed_currencies:
            issue_counts["invalid_currency"] += 1
            issue_by_brand["invalid_currency"][brand_name] += 1
            _append_sample(issue_samples, "invalid_currency", row, rules.max_samples_per_issue)

        if price is not None and compare_at_price is not None and compare_at_price < price:
            issue_counts["compare_at_inversion"] += 1
            issue_by_brand["compare_at_inversion"][brand_name] += 1
            _append_sample(issue_samples, "compare_at_inversion", row, rules.max_samples_per_issue)

        if not desc_clean:
            issue_counts["empty_description"] += 1
            issue_by_brand["empty_description"][brand_name] += 1
            _append_sample(issue_samples, "empty_description", row, rules.max_samples_per_issue)
        else:
            if len(desc_clean) < rules.min_description_length:
                issue_counts["short_description"] += 1
                issue_by_brand["short_description"][brand_name] += 1
                _append_sample(issue_samples, "short_description", row, rules.max_samples_per_issue)

            if SUSPICIOUS_HTML_RE.search(str(raw_desc or "")):
                issue_counts["suspicious_html"] += 1
                issue_by_brand["suspicious_html"][brand_name] += 1
                _append_sample(issue_samples, "suspicious_html", row, rules.max_samples_per_issue)

            duplicate_index[desc_clean.lower()].append(row)

    duplicate_rows = []
    for _, grouped_rows in duplicate_index.items():
        if len(grouped_rows) > 1:
            duplicate_rows.extend(grouped_rows)

    for row in duplicate_rows:
        issue_counts["duplicate_description"] += 1
        issue_by_brand["duplicate_description"][str(row.get("brand") or "")] += 1
        _append_sample(issue_samples, "duplicate_description", row, rules.max_samples_per_issue)

    issue_pcts = {issue: _pct(count, total) for issue, count in issue_counts.items()}

    threshold_failures: list[str] = []
    if issue_pcts.get("empty_description", 0.0) > rules.max_empty_description_pct:
        threshold_failures.append(
            f"empty_description {issue_pcts.get('empty_description', 0.0):.2f}% > {rules.max_empty_description_pct:.2f}%"
        )
    if issue_pcts.get("short_description", 0.0) > rules.max_short_description_pct:
        threshold_failures.append(
            f"short_description {issue_pcts.get('short_description', 0.0):.2f}% > {rules.max_short_description_pct:.2f}%"
        )
    if issue_pcts.get("suspicious_html", 0.0) > rules.max_suspicious_html_pct:
        threshold_failures.append(
            f"suspicious_html {issue_pcts.get('suspicious_html', 0.0):.2f}% > {rules.max_suspicious_html_pct:.2f}%"
        )

    critical_count = sum(issue_counts.get(i, 0) for i in CRITICAL_ISSUES)
    warning_count = sum(issue_counts.get(i, 0) for i in WARNING_ISSUES)

    gate_passed = critical_count == 0 and not threshold_failures
    if rules.strict_warnings and warning_count > 0:
        gate_passed = False

    blocking_reasons: list[str] = []
    if critical_count > 0:
        for issue in sorted(CRITICAL_ISSUES):
            count = issue_counts.get(issue, 0)
            if count > 0:
                blocking_reasons.append(f"{issue}: {count}")
    blocking_reasons.extend(threshold_failures)
    if rules.strict_warnings and warning_count > 0:
        blocking_reasons.append(f"strict_warnings enabled: {warning_count} warning issues")

    top_brands: dict[str, list[dict[str, Any]]] = {}
    for issue, brand_map in issue_by_brand.items():
        ordered = sorted(brand_map.items(), key=lambda x: x[1], reverse=True)[:10]
        top_brands[issue] = [{"brand": b, "count": c} for b, c in ordered]

    anomalies: list[dict[str, Any]] = []
    for issue, samples in issue_samples.items():
        for sample in samples:
            anomalies.append(sample | {"issue": issue})

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "brand": brand,
            "active_rows": total,
        },
        "rules": {
            "allowed_currencies": list(allowed_currencies),
            "min_price": rules.min_price,
            "max_price": rules.max_price,
            "min_description_length": rules.min_description_length,
            "max_empty_description_pct": rules.max_empty_description_pct,
            "max_short_description_pct": rules.max_short_description_pct,
            "max_suspicious_html_pct": rules.max_suspicious_html_pct,
            "strict_warnings": rules.strict_warnings,
        },
        "gate": {
            "passed": gate_passed,
            "blocking_reasons": blocking_reasons,
            "critical_issue_count": critical_count,
            "warning_issue_count": warning_count,
        },
        "issues": {
            issue: {
                "count": issue_counts.get(issue, 0),
                "pct": issue_pcts.get(issue, 0.0),
                "top_brands": top_brands.get(issue, []),
                "samples": issue_samples.get(issue, []),
            }
            for issue in sorted(CRITICAL_ISSUES | WARNING_ISSUES)
        },
        "anomalies": anomalies,
    }
    return report


def format_gate_failure(report: dict[str, Any]) -> str:
    reasons = report.get("gate", {}).get("blocking_reasons", [])
    if not reasons:
        return "Quality gate failed without explicit reasons."
    return "; ".join(reasons)
