"""Paired comparisons of the chained evaluation (P-99 / P-23).

Input: the per-photo CSVs written by export-per-photo.sql (one row per run x photo). Every
comparison is paired by photo: both pairs saw the same 13 024 photos. For a metric m
(exact reading, plate found) the difference d = m(A) - m(B) gets

  - a photo-level percentile bootstrap (10 000 resamples of photos with replacement), the usual
    one for a fixed test set;
  - an event-level cluster bootstrap (resample the 11 events with replacement, 10 000 times),
    the honest one if the question is "would the order hold on new events" (only 11 clusters:
    wide intervals, read as a robustness check, not as the main CI);
  - the exact McNemar test on the discordant photos (A right / B wrong vs A wrong / B right).

Time: per-photo paired difference of total_ms on the same host (same account letter), warm
requests only, median and percentile bootstrap of the median.

Usage:
  uv run python scripts/eval/bootstrap_chained.py --csv main_valthr.csv [--boot 10000] [--out report.md]
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

# Comparisons (A, B): positive difference = A better. Pair names as in eval.runs (detector+ocr).
MAIN = [
    ("rfdetr_l_896+svtrv2_b", "yolo+parseq", "ganador frente a configuración de producción"),
    ("rfdetr_l_896+svtrv2_s", "yolo+parseq", "RF-DETR-L + S frente a producción"),
    ("rfdetr_l_896+svtrv2_b", "rfdetr_l_896+svtrv2_s", "lector: B frente a S (mismo detector)"),
    ("rfdetr_l_896+svtrv2_s", "rfdetr_l_896+parseq_v2", "lector: SVTRv2-S frente a PARSeq (RF-DETR-L)"),
    ("yolo26m_1024+svtrv2_s", "yolo26m_1024+parseq_v2", "lector: SVTRv2-S frente a PARSeq (YOLO26m)"),
    ("rfdetr_l_896+svtrv2_s", "yolo26m_1024+svtrv2_s", "detector: RF-DETR-L frente a YOLO26m (mismo lector)"),
    ("rfdetr_l_896+svtrv2_s", "dfine_l_640+svtrv2_s", "detector: RF-DETR-L frente a D-FINE-L (mismo lector)"),
    ("dfine_l_640+svtrv2_s", "yolo26m_1024+svtrv2_s", "detector: D-FINE-L frente a YOLO26m (mismo lector)"),
    ("yolo26m_1024+svtrv2_s", "yolo11m_1024_fx+svtrv2_s", "detector: YOLO26m frente a YOLO11m, receta común"),
    ("yolo26m_1024+svtrv2_s", "yolo+parseq", "YOLO26m 1 clase + S frente a producción"),
]
P97 = [
    ("rfdetr_l_896_c5+svtrv2_b", "rfdetr_l_896+svtrv2_b", "RF-DETR-L: 5 clases frente a 1 (mismo lector B)"),
    ("yolo26m_c5_1024+svtrv2_b", "rfdetr_l_896+svtrv2_b", "YOLO26m 5 clases frente a RF-DETR-L 1 clase (B)"),
    ("yolo26m_c5_1024+svtrv2_b", "rfdetr_l_896_c5+svtrv2_b", "YOLO26m 5 clases frente a RF-DETR-L 5 clases (B)"),
]


SERIES = re.compile(r"(?:encadenado|muestra)\s+(?:abl-)?([A-Z])\b")


def load(path: Path) -> dict[str, dict[str, dict]]:
    """pair -> photo_id -> row. Accuracy fields are identical across series (same model, same
    photo), so the first occurrence wins; `others` keeps the rows of the other series (the
    production configuration ran once per series) for host-paired timing."""
    by_pair: dict[str, dict[str, dict]] = defaultdict(dict)
    with open(path, newline="") as fh:
        for r in csv.DictReader(fh):
            if r["unreadable"] == "t":
                continue  # unreadable plates reported apart, as in metrics-chained.sql
            r["has_bib"] = r["has_bib"] == "t"
            r["exact"] = r["exact"] == "t"
            r["detected"] = r["detected"] == "t"
            r["cold"] = r["cold"] == "t"
            r["total_ms"] = float(r["total_ms"]) if r["total_ms"] else math.nan
            r["others"] = []
            if r["photo_id"] in by_pair[r["pair"]]:
                by_pair[r["pair"]][r["photo_id"]]["others"].append(r)
                continue
            by_pair[r["pair"]][r["photo_id"]] = r
    return by_pair


def host(row: dict) -> str:
    """Account letter plus series (main or ablation): the pairs of one series ran interleaved on the
    same container lineage, so only rows with the same host are time-comparable. Rows from two series
    on the same account ran on different days and machines."""
    return row["host"]


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar p on discordant counts b (A right, B wrong) and c (A wrong, B right)."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    from math import comb
    p = sum(comb(n, i) for i in range(0, k + 1)) / 2 ** n
    return min(1.0, 2 * p)


def paired(a: dict, b: dict, metric: str, boot: int, rng: np.random.Generator) -> dict:
    ids = [p for p in a if p in b and a[p]["has_bib"]]  # photos with a legible plate
    xa = np.array([a[p][metric] for p in ids], dtype=float)
    xb = np.array([b[p][metric] for p in ids], dtype=float)
    ev = np.array([a[p]["event"] for p in ids])
    d = xa - xb
    n = len(ids)
    # photo bootstrap of the mean difference
    idx = rng.integers(0, n, size=(boot, n))
    dm = d[idx].mean(axis=1)
    # event cluster bootstrap
    events = sorted(set(ev))
    per_ev = {e: d[ev == e] for e in events}
    ne = len(events)
    cl = np.empty(boot)
    for i in range(boot):
        pick = rng.integers(0, ne, size=ne)
        cat = np.concatenate([per_ev[events[j]] for j in pick])
        cl[i] = cat.mean()
    bb = int(((xa == 1) & (xb == 0)).sum())
    cc = int(((xa == 0) & (xb == 1)).sum())
    return {
        "n": n, "a": round(100 * xa.mean(), 2), "b": round(100 * xb.mean(), 2), "diff": round(100 * d.mean(), 2),
        "ci_photo": [round(100 * v, 2) for v in np.percentile(dm, [2.5, 97.5])],
        "ci_event": [round(100 * v, 2) for v in np.percentile(cl, [2.5, 97.5])],
        "p_photo_gt0": round(float((dm > 0).mean()), 4),
        "discordant": [bb, cc], "p_mcnemar": mcnemar_exact(bb, cc),
        "by_event": {e: round(100 * per_ev[e].mean(), 1) for e in events},
    }


def _same_host_diffs(a: dict, b: dict) -> tuple[list[float], set[str]]:
    d_list, hosts = [], set()
    for p, ra0 in a.items():
        if p not in b:
            continue
        done = False
        for ra in [ra0, *ra0["others"]]:
            if ra["cold"] or math.isnan(ra["total_ms"]):
                continue
            for rb in [b[p], *b[p]["others"]]:
                if rb["cold"] or math.isnan(rb["total_ms"]) or host(rb) != host(ra):
                    continue
                d_list.append(ra["total_ms"] - rb["total_ms"]); hosts.add(host(ra)); done = True
                break
            if done:
                break
    return d_list, hosts


def paired_time(a: dict, b: dict, boot: int, rng: np.random.Generator, anchor: dict | None = None) -> dict | None:
    d_list, hosts = _same_host_diffs(a, b)
    via = "directo"
    if not d_list and anchor is not None:
        # A and B never shared a container: compare each against the production configuration that
        # ran interleaved with it in its own series, then take the difference of the two medians.
        da, ha = _same_host_diffs(a, anchor)
        db, hb = _same_host_diffs(b, anchor)
        if not da or not db:
            return None
        da, db = np.array(da), np.array(db)
        n = min(len(da), len(db))
        ia = rng.integers(0, len(da), size=(boot, n)); ib = rng.integers(0, len(db), size=(boot, n))
        med = np.median(da[ia], axis=1) - np.median(db[ib], axis=1)
        return {"n": n, "median_ms": round(float(np.median(da) - np.median(db)), 1), "p25": None, "p75": None,
                "ci_median": [round(float(v), 1) for v in np.percentile(med, [2.5, 97.5])],
                "hosts": sorted(ha | hb), "via": "vía producción (A − prod) − (B − prod)"}
    if not d_list:
        return None
    d = np.array(d_list)
    n = len(d)
    idx = rng.integers(0, n, size=(boot, n))
    med = np.median(d[idx], axis=1)
    return {"n": n, "median_ms": round(float(np.median(d)), 1), "p25": round(float(np.percentile(d, 25)), 1),
            "p75": round(float(np.percentile(d, 75)), 1),
            "ci_median": [round(float(v), 1) for v in np.percentile(med, [2.5, 97.5])],
            "hosts": sorted(hosts), "via": via}


def holm(pvals: list[float]) -> list[float]:
    order = sorted(range(len(pvals)), key=lambda i: pvals[i])
    adj = [0.0] * len(pvals)
    running = 0.0
    m = len(pvals)
    for rank, i in enumerate(order):
        v = min(1.0, (m - rank) * pvals[i])
        running = max(running, v)
        adj[i] = running
    return adj


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, type=Path)
    ap.add_argument("--boot", type=int, default=10000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--json", type=Path)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    data = load(args.csv)
    comps = [c for c in MAIN + P97 if c[0] in data and c[1] in data]
    results = []
    for a, b, label in comps:
        res = {"a": a, "b": b, "label": label}
        for metric in ("exact", "detected"):
            res[metric] = paired(data[a], data[b], metric, args.boot, rng)
        res["time"] = paired_time(data[a], data[b], args.boot, rng, anchor=data.get("yolo+parseq"))
        results.append(res)
    for metric in ("exact", "detected"):
        adj = holm([r[metric]["p_mcnemar"] for r in results])
        for r, p in zip(results, adj):
            r[metric]["p_holm"] = p

    lines = [f"# Bootstrap pareado del encadenado: `{args.csv.name}` ({args.boot} remuestreos, semilla {args.seed})", "",
             "Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.", ""]
    for metric, title in (("exact", "Lectura exacta"), ("detected", "Placa encontrada")):
        lines += [f"## {title}", "", "| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |", "|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|"]
        for r in results:
            m = r[metric]
            lines.append(f"| {r['label']} | `{r['a']}` | `{r['b']}` | {m['n']} | {m['a']:.1f} | {m['b']:.1f} | **{m['diff']:+.1f}** | [{m['ci_photo'][0]:+.1f}, {m['ci_photo'][1]:+.1f}] | [{m['ci_event'][0]:+.1f}, {m['ci_event'][1]:+.1f}] | {m['discordant'][0]} / {m['discordant'][1]} | {m['p_mcnemar']:.2g} | {m['p_holm']:.2g} |")
        lines.append("")
    lines += ["## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías", "", "| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |", "|---|---:|---:|---|---|---|---|"]
    for r in results:
        t = r["time"]
        if t:
            pq = f"[{t['p25']:+.0f}, {t['p75']:+.0f}]" if t["p25"] is not None else "—"
            lines.append(f"| {r['label']} | {t['n']} | **{t['median_ms']:+.0f}** | {pq} | [{t['ci_median'][0]:+.0f}, {t['ci_median'][1]:+.0f}] | {', '.join(t['hosts'])} | {t['via']} |")
        else:
            lines.append(f"| {r['label']} | — | sin host común | | | | |")
    lines += ["", "## Diferencia de lectura exacta por evento (puntos)", "", "| Comparación | " + " | ".join(sorted(next(iter(results))["exact"]["by_event"])) + " |", "|---|" + "---:|" * len(results[0]["exact"]["by_event"])]
    for r in results:
        be = r["exact"]["by_event"]
        lines.append(f"| {r['label']} | " + " | ".join(f"{be[e]:+.1f}" for e in sorted(be)) + " |")
    report = "\n".join(lines) + "\n"
    print(report)
    if args.out:
        args.out.write_text(report)
    if args.json:
        args.json.write_text(json.dumps(results, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
