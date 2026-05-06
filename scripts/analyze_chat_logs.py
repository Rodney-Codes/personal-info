"""
Mine chat logs and feedback to produce a retrieval tuning report.

This is a report-only script: it never mutates indexes or service config. It
aggregates Supabase Postgres chat logs into actionable buckets the team can act on:

- Failed queries (no retrieval results, or `bucket = no_results`).
- Low-confidence queries (top result score below a threshold).
- Negatively rated answers (feedback rating = -1).
- Positive examples (feedback rating = +1) ready to seed an eval set.
- Tuning candidates: suggested retrieval model and top_k adjustments.

Usage:
    python -m scripts.analyze_chat_logs \
        --db-url "$SUPABASE_DB_URL" \
        --since 30 \
        --output data/chat_reports/chat_log_report.json

The report is designed to be reviewed by a human (or a follow-up automation)
before any retrieval tuning is rolled out. Pair with `scripts/eval_retrieval.py`
to gate any change.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import psycopg
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from docs_chatbot_service.core.text_util import tokenize  # noqa: E402

LOGGER = logging.getLogger("analyze_chat_logs")

DEFAULT_DB_URL = ""
DEFAULT_OUTPUT = Path("data/chat_reports/chat_log_report.json")
DEFAULT_LOW_CONF_THRESHOLD = 0.20
DEFAULT_FAILED_BUCKETS = ("no_results", "none")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mine chat logs for retrieval tuning insights.")
    parser.add_argument(
        "--db-url",
        type=str,
        default=DEFAULT_DB_URL,
        help="Supabase Postgres connection string. If omitted, reads SUPABASE_DB_URL.",
    )
    parser.add_argument(
        "--since",
        type=int,
        default=30,
        help="Lookback window in days (use 0 to disable the time filter).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path to write the JSON report (parent dir is created if missing).",
    )
    parser.add_argument(
        "--low-confidence-threshold",
        type=float,
        default=DEFAULT_LOW_CONF_THRESHOLD,
        help="Top score below this is treated as low confidence.",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=20,
        help="Max query samples surfaced per bucket in the report.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable INFO-level logging.",
    )
    return parser.parse_args()


def _open_db(db_url: str) -> psycopg.Connection:
    if not db_url.strip():
        raise FileNotFoundError("Supabase DB URL not provided (set --db-url or SUPABASE_DB_URL).")
    return psycopg.connect(db_url, row_factory=dict_row)


def _since_iso(days: int) -> Optional[str]:
    if days <= 0:
        return None
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.isoformat(timespec="seconds")


def _fetch_events(conn: psycopg.Connection, since_iso: Optional[str]) -> List[dict]:
    if since_iso:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM chat_events WHERE created_at >= %(since_iso)s::timestamptz ORDER BY id ASC",
                {"since_iso": since_iso},
            )
            rows = cur.fetchall()
    else:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM chat_events ORDER BY id ASC")
            rows = cur.fetchall()
    return list(rows)


def _fetch_feedback(conn: psycopg.Connection, since_iso: Optional[str]) -> List[dict]:
    if since_iso:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM chat_feedback WHERE created_at >= %(since_iso)s::timestamptz ORDER BY id ASC",
                {"since_iso": since_iso},
            )
            rows = cur.fetchall()
    else:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM chat_feedback ORDER BY id ASC")
            rows = cur.fetchall()
    return list(rows)


def _safe_json(value: Any) -> Any:
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None


def _row_top_score(row: dict) -> Optional[float]:
    info = _safe_json(row["info"]) or {}
    score_stats = info.get("score_stats") if isinstance(info, dict) else None
    if isinstance(score_stats, dict):
        max_score = score_stats.get("max")
        if isinstance(max_score, (int, float)):
            return float(max_score)
    top_results = info.get("top_results") if isinstance(info, dict) else None
    if isinstance(top_results, list) and top_results:
        first = top_results[0]
        if isinstance(first, dict):
            score = first.get("score")
            if isinstance(score, (int, float)):
                return float(score)
    return None


def _bucket_events(events: Iterable[dict]) -> Dict[str, int]:
    counter: Counter = Counter()
    for row in events:
        counter[row["bucket"]] += 1
    return dict(counter)


def _retrieval_model_distribution(events: Iterable[dict]) -> Dict[str, int]:
    counter: Counter = Counter()
    for row in events:
        counter[row["retrieval_model"]] += 1
    return dict(counter)


def _failed_query_samples(
    events: List[dict],
    max_samples: int,
    failed_buckets: Iterable[str] = DEFAULT_FAILED_BUCKETS,
) -> List[Dict[str, Any]]:
    failed_buckets_set = set(failed_buckets)
    samples: List[Dict[str, Any]] = []
    for row in events:
        if row["bucket"] in failed_buckets_set:
            samples.append(
                {
                    "event_id": row["event_id"],
                    "query": row["query"],
                    "bucket": row["bucket"],
                    "method": row["method"],
                    "retrieval_model": row["retrieval_model"],
                    "created_at": row["created_at"],
                }
            )
        if len(samples) >= max_samples:
            break
    return samples


def _low_confidence_samples(
    events: List[dict],
    threshold: float,
    max_samples: int,
) -> List[Dict[str, Any]]:
    samples: List[Dict[str, Any]] = []
    for row in events:
        score = _row_top_score(row)
        if score is not None and score < threshold and row["bucket"] not in {"no_results"}:
            samples.append(
                {
                    "event_id": row["event_id"],
                    "query": row["query"],
                    "top_score": score,
                    "retrieval_model": row["retrieval_model"],
                    "method": row["method"],
                    "created_at": row["created_at"],
                }
            )
        if len(samples) >= max_samples:
            break
    return samples


def _feedback_summary(feedback: List[dict]) -> Dict[str, Any]:
    counts = Counter(row["bucket"] for row in feedback)
    rating_counts = Counter(row["rating"] for row in feedback)
    return {
        "total": len(feedback),
        "by_bucket": dict(counts),
        "by_rating": {str(k): v for k, v in rating_counts.items()},
    }


def _join_feedback_to_events(
    events: List[dict],
    feedback: List[dict],
    rating: int,
    max_samples: int,
) -> List[Dict[str, Any]]:
    events_by_id = {row["event_id"]: row for row in events}
    out: List[Dict[str, Any]] = []
    for fb in feedback:
        if fb["rating"] != rating:
            continue
        event = events_by_id.get(fb["event_id"])
        if event is None:
            continue
        out.append(
            {
                "event_id": fb["event_id"],
                "query": event["query"],
                "answer": event["answer"],
                "rating": fb["rating"],
                "comment": fb["comment"],
                "retrieval_model": event["retrieval_model"],
                "method": event["method"],
                "created_at": event["created_at"],
            }
        )
        if len(out) >= max_samples:
            break
    return out


def _retrieval_model_quality(
    events: List[dict],
    feedback: List[dict],
) -> Dict[str, Dict[str, Any]]:
    """For each retrieval model, compute simple positive/negative feedback ratios."""

    events_by_id = {row["event_id"]: row for row in events}
    per_model: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"positive": 0, "negative": 0, "neutral": 0, "events": 0}
    )

    for row in events:
        per_model[row["retrieval_model"]]["events"] += 1

    for fb in feedback:
        event = events_by_id.get(fb["event_id"])
        if event is None:
            continue
        model = event["retrieval_model"] or "unknown"
        if fb["rating"] > 0:
            per_model[model]["positive"] += 1
        elif fb["rating"] < 0:
            per_model[model]["negative"] += 1
        else:
            per_model[model]["neutral"] += 1

    out: Dict[str, Dict[str, Any]] = {}
    for model, stats in per_model.items():
        total_rated = stats["positive"] + stats["negative"]
        ratio = (stats["positive"] / total_rated) if total_rated else None
        out[model] = {**stats, "positive_ratio": ratio}
    return out


def _candidate_query_token_frequencies(events: Iterable[dict]) -> Counter:
    counter: Counter = Counter()
    for row in events:
        if row["bucket"] in DEFAULT_FAILED_BUCKETS or _row_top_score(row) in (None,) or (
            _row_top_score(row) is not None and _row_top_score(row) < DEFAULT_LOW_CONF_THRESHOLD
        ):
            for token in tokenize(row["query"]):
                counter[token] += 1
    return counter


def _build_recommendations(
    events: List[dict],
    feedback: List[dict],
    threshold: float,
) -> Dict[str, Any]:
    quality = _retrieval_model_quality(events, feedback)
    best_model: Optional[str] = None
    best_ratio: float = -1.0
    for model, stats in quality.items():
        ratio = stats.get("positive_ratio")
        if isinstance(ratio, (int, float)) and ratio > best_ratio and stats["events"] >= 5:
            best_ratio = float(ratio)
            best_model = model

    failed_count = sum(
        1 for row in events if row["bucket"] in DEFAULT_FAILED_BUCKETS
    )
    low_conf_count = sum(
        1
        for row in events
        if (
            (s := _row_top_score(row)) is not None
            and s < threshold
            and row["bucket"] not in {"no_results"}
        )
    )

    suggestions: List[str] = []
    if best_model and best_ratio >= 0.6:
        suggestions.append(
            f"Promote retrieval_model={best_model} (positive ratio {best_ratio:.2f})."
        )
    if failed_count > 0:
        suggestions.append(
            f"Investigate {failed_count} failed queries (bucket=no_results/none); "
            "consider expanding the corpus or adding synonyms."
        )
    if low_conf_count > 0:
        suggestions.append(
            f"{low_conf_count} answers below confidence={threshold}; consider raising "
            "min_score gating or improving chunking."
        )
    if not suggestions:
        suggestions.append("No actionable retrieval changes; continue monitoring.")

    candidate_tokens = _candidate_query_token_frequencies(events).most_common(15)

    return {
        "best_retrieval_model": best_model,
        "best_retrieval_positive_ratio": best_ratio if best_model else None,
        "failed_query_count": failed_count,
        "low_confidence_count": low_conf_count,
        "suggestions": suggestions,
        "frequent_tokens_in_low_quality_queries": [
            {"token": tok, "count": cnt} for tok, cnt in candidate_tokens
        ],
    }


def build_report_from_rows(
    events: List[dict],
    feedback: List[dict],
    source_label: str,
    since_days: int,
    threshold: float,
    max_samples: int,
) -> Dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source_label,
        "lookback_days": since_days,
        "low_confidence_threshold": threshold,
        "totals": {
            "events": len(events),
            "feedback": len(feedback),
        },
        "buckets": _bucket_events(events),
        "retrieval_model_distribution": _retrieval_model_distribution(events),
        "feedback_summary": _feedback_summary(feedback),
        "retrieval_model_quality": _retrieval_model_quality(events, feedback),
        "samples": {
            "failed_queries": _failed_query_samples(events, max_samples),
            "low_confidence_queries": _low_confidence_samples(events, threshold, max_samples),
            "positive_examples": _join_feedback_to_events(events, feedback, 1, max_samples),
            "negative_examples": _join_feedback_to_events(events, feedback, -1, max_samples),
        },
        "recommendations": _build_recommendations(events, feedback, threshold),
    }


def build_report(
    db_url: str,
    since_days: int,
    threshold: float,
    max_samples: int,
) -> Dict[str, Any]:
    since_iso = _since_iso(since_days)
    conn = _open_db(db_url)
    try:
        events = _fetch_events(conn, since_iso)
        feedback = _fetch_feedback(conn, since_iso)
    finally:
        conn.close()
    return build_report_from_rows(
        events=events,
        feedback=feedback,
        source_label="supabase_postgres",
        since_days=since_days,
        threshold=threshold,
        max_samples=max_samples,
    )


def main() -> int:
    args = _parse_args()
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    try:
        report = build_report(
            db_url=(args.db_url or os.getenv("SUPABASE_DB_URL", "")).strip(),
            since_days=args.since,
            threshold=args.low_confidence_threshold,
            max_samples=args.max_samples,
        )
    except FileNotFoundError as exc:
        LOGGER.error("%s", exc)
        return 1
    except psycopg.Error as exc:
        LOGGER.error("Database error: %s", exc)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    LOGGER.info("Report written to %s", args.output)

    print(f"Wrote chat log report: {args.output}")
    print(
        "Totals: events={events}, feedback={feedback}".format(
            events=report["totals"]["events"],
            feedback=report["totals"]["feedback"],
        )
    )
    for hint in report["recommendations"]["suggestions"]:
        print(f"- {hint}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
