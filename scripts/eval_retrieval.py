"""
Offline retrieval evaluation harness.

Computes Top-K hit rate and MRR for the docs chatbot retrieval service against
a curated eval set (see `data/eval/retrieval_eval.json`). Designed as a quality
gate for any continuous improvement automation: a candidate retrieval config
must clear the configured thresholds before being rolled out.

Usage:
    python -m scripts.eval_retrieval \
        --eval data/eval/retrieval_eval.json \
        --index-root data/index \
        --retrieval-models bm25 hashed_vector bm25_hashed_vector \
        --top-k 3 \
        --report-out data/chat_reports/eval_report.json

Exit code:
    0  if all evaluated models meet the gate (or no gate specified).
    3  if the gate fails (used by CI to fail a tuning rollout).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from docs_chatbot_service.core.service import (  # noqa: E402
    RetrievalModel,
    RetrievalService,
    SearchParams,
)

LOGGER = logging.getLogger("eval_retrieval")

DEFAULT_EVAL = Path("data/eval/retrieval_eval.json")
DEFAULT_INDEX_ROOT = Path("data/index")
DEFAULT_REPORT = Path("data/chat_reports/eval_report.json")
DEFAULT_TOP_K = 3
DEFAULT_MODELS = ["bm25", "hashed_vector", "bm25_hashed_vector"]
DEFAULT_GATE_HIT_AT_K = 0.6
DEFAULT_GATE_MRR = 0.5


@dataclass
class EvalExample:
    id: str
    query: str
    expected_doc_ids: List[str] = field(default_factory=list)
    expected_chunk_ids: List[str] = field(default_factory=list)
    corpus_id: Optional[str] = None
    top_k: Optional[int] = None


@dataclass
class EvalSummary:
    retrieval_model: str
    total: int
    hit_at_k: float
    mrr: float
    misses: List[Dict[str, Any]] = field(default_factory=list)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Offline retrieval evaluation harness.")
    parser.add_argument("--eval", type=Path, default=DEFAULT_EVAL)
    parser.add_argument("--index-root", type=Path, default=DEFAULT_INDEX_ROOT)
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument(
        "--retrieval-models",
        nargs="+",
        default=DEFAULT_MODELS,
        help="One or more retrieval models to evaluate.",
    )
    parser.add_argument(
        "--gate-hit-at-k",
        type=float,
        default=DEFAULT_GATE_HIT_AT_K,
        help="Minimum acceptable hit-at-k (0..1). Set to 0 to skip gate.",
    )
    parser.add_argument(
        "--gate-mrr",
        type=float,
        default=DEFAULT_GATE_MRR,
        help="Minimum acceptable MRR (0..1). Set to 0 to skip gate.",
    )
    parser.add_argument("--report-out", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def load_eval_set(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Eval set not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _examples_from_payload(payload: Dict[str, Any]) -> List[EvalExample]:
    raw_examples = payload.get("examples") or []
    if not isinstance(raw_examples, list):
        raise ValueError("eval set 'examples' must be a list")
    examples: List[EvalExample] = []
    for idx, raw in enumerate(raw_examples):
        if not isinstance(raw, dict):
            continue
        examples.append(
            EvalExample(
                id=str(raw.get("id", f"example-{idx}")),
                query=str(raw.get("query", "")).strip(),
                expected_doc_ids=[str(x) for x in (raw.get("expected_doc_ids") or [])],
                expected_chunk_ids=[str(x) for x in (raw.get("expected_chunk_ids") or [])],
                corpus_id=raw.get("corpus_id"),
                top_k=raw.get("top_k"),
            )
        )
    return [ex for ex in examples if ex.query]


def _expected_set(example: EvalExample) -> Dict[str, set]:
    return {
        "doc_ids": set(example.expected_doc_ids),
        "chunk_ids": set(example.expected_chunk_ids),
    }


def _evaluate_example(
    service: RetrievalService,
    example: EvalExample,
    retrieval_model: RetrievalModel,
    default_corpus: str,
    default_top_k: int,
) -> Dict[str, Any]:
    corpus_id = example.corpus_id or default_corpus
    top_k = example.top_k or default_top_k
    expected = _expected_set(example)
    if not expected["doc_ids"] and not expected["chunk_ids"]:
        return {
            "id": example.id,
            "query": example.query,
            "skipped": True,
            "reason": "no_expectations",
        }
    results = service.search(
        SearchParams(
            query=example.query,
            corpus_id=corpus_id,
            doc_ids=None,
            top_k=top_k,
            min_score=0.0,
            retrieval_model=retrieval_model,
        )
    )
    hit_rank: Optional[int] = None
    for rank, res in enumerate(results, start=1):
        doc_id = str(res.get("doc_id", ""))
        chunk_id = str(res.get("chunk_id", ""))
        if doc_id in expected["doc_ids"] or chunk_id in expected["chunk_ids"]:
            hit_rank = rank
            break
    return {
        "id": example.id,
        "query": example.query,
        "corpus_id": corpus_id,
        "top_k": top_k,
        "results": [
            {"doc_id": str(r.get("doc_id", "")), "chunk_id": str(r.get("chunk_id", "")), "score": float(r.get("score", 0.0) or 0.0)}
            for r in results
        ],
        "expected_doc_ids": sorted(expected["doc_ids"]),
        "expected_chunk_ids": sorted(expected["chunk_ids"]),
        "hit_rank": hit_rank,
        "hit": hit_rank is not None,
    }


def evaluate_model(
    service: RetrievalService,
    examples: Iterable[EvalExample],
    retrieval_model: RetrievalModel,
    default_corpus: str,
    default_top_k: int,
) -> EvalSummary:
    per_example: List[Dict[str, Any]] = []
    hits = 0
    rr_total = 0.0
    counted = 0
    for example in examples:
        record = _evaluate_example(service, example, retrieval_model, default_corpus, default_top_k)
        per_example.append(record)
        if record.get("skipped"):
            continue
        counted += 1
        if record.get("hit"):
            hits += 1
            rr_total += 1.0 / float(record["hit_rank"])
    hit_at_k = (hits / counted) if counted else 0.0
    mrr = (rr_total / counted) if counted else 0.0
    misses = [r for r in per_example if not r.get("skipped") and not r.get("hit")]
    summary = EvalSummary(
        retrieval_model=retrieval_model.value,
        total=counted,
        hit_at_k=hit_at_k,
        mrr=mrr,
        misses=misses,
    )
    return summary


def gate_passes(summary: EvalSummary, gate_hit: float, gate_mrr: float) -> bool:
    if gate_hit > 0 and summary.hit_at_k < gate_hit:
        return False
    if gate_mrr > 0 and summary.mrr < gate_mrr:
        return False
    return True


def run_evaluation(
    eval_path: Path,
    index_root: Path,
    retrieval_models: Iterable[str],
    top_k: int,
    gate_hit: float,
    gate_mrr: float,
) -> Dict[str, Any]:
    payload = load_eval_set(eval_path)
    examples = _examples_from_payload(payload)
    if not examples:
        raise ValueError(f"No usable examples in eval set: {eval_path}")
    default_corpus = str(payload.get("_meta", {}).get("default_corpus_id", "default"))
    default_top_k = int(payload.get("_meta", {}).get("default_top_k", top_k))

    service = RetrievalService(index_root=index_root)

    model_summaries: Dict[str, Any] = {}
    overall_pass = True
    for raw_model in retrieval_models:
        try:
            rm = RetrievalModel(raw_model)
        except ValueError:
            LOGGER.warning("Skipping unknown retrieval model: %s", raw_model)
            continue
        summary = evaluate_model(service, examples, rm, default_corpus, top_k or default_top_k)
        passes = gate_passes(summary, gate_hit, gate_mrr)
        if not passes:
            overall_pass = False
        model_summaries[summary.retrieval_model] = {
            "total": summary.total,
            "hit_at_k": summary.hit_at_k,
            "mrr": summary.mrr,
            "passes_gate": passes,
            "misses": summary.misses,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "eval_path": str(eval_path),
        "index_root": str(index_root),
        "default_corpus_id": default_corpus,
        "top_k": top_k or default_top_k,
        "gate": {"hit_at_k": gate_hit, "mrr": gate_mrr},
        "overall_passes_gate": overall_pass,
        "models": model_summaries,
    }


def main() -> int:
    args = _parse_args()
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    try:
        report = run_evaluation(
            eval_path=args.eval,
            index_root=args.index_root,
            retrieval_models=args.retrieval_models,
            top_k=args.top_k,
            gate_hit=args.gate_hit_at_k,
            gate_mrr=args.gate_mrr,
        )
    except (FileNotFoundError, ValueError) as exc:
        LOGGER.error("%s", exc)
        return 1

    args.report_out.parent.mkdir(parents=True, exist_ok=True)
    args.report_out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote eval report: {args.report_out}")
    for model, summary in report["models"].items():
        status = "PASS" if summary["passes_gate"] else "FAIL"
        print(
            "{model:>30s}  hit@k={hit:.2f}  mrr={mrr:.2f}  total={total}  [{status}]".format(
                model=model,
                hit=summary["hit_at_k"],
                mrr=summary["mrr"],
                total=summary["total"],
                status=status,
            )
        )
    if not report["overall_passes_gate"]:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
