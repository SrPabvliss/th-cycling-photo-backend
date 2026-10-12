"""Tabulate the author's event characterization (data/carac-decisiones.csv).

Last line per photo wins. Per event and dimension: distribution of the options,
the mode and the normalized entropy (0 = every photo alike, 1 = uniform over the
options), so the paper can state how varied each event is and how different the
events are from each other. Also lists the photos flagged as representative.

Usage: python3 tabular.py [--representativas out.csv] > README.md
"""

from __future__ import annotations

import collections
import csv
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORDER = ["lost line", "2da.", "cevallos", "lumbis", "ecuador open", "pimampiro", "3ra.", "sigchos", "el bosque", "shimano", "telef"]
SHORT = dict(zip(ORDER, ["Lost Line", "Coto", "Cevallos", "Lumbisí", "Ecuador OPEN", "Pimampiro", "Pamba", "Sigchos", "El Bosque", "SHIMANO", "Teleférico"]))


def short(event: str) -> str:
    low = event.lower()
    return next((SHORT[k] for k in ORDER if k in low), event)


def load() -> list[dict]:
    rows = list(csv.DictReader(open(HERE / "data" / "carac-decisiones.csv")))
    last: dict[str, dict] = {}
    for r in rows:
        last[r["photo_id"]] = r
    return list(last.values())


def entropy(counter: collections.Counter, k: int) -> float:
    n = sum(counter.values())
    if n == 0 or k < 2:
        return 0.0
    h = -sum((c / n) * math.log(c / n) for c in counter.values() if c)
    return h / math.log(k)


def main() -> None:
    tax = json.load(open(HERE / "dimensiones.json"))["dimensiones"]
    lab = {(d["id"], a): b.split(" (")[0] for d in tax for a, b in d["opciones"]}
    D = load()
    sample = list(csv.DictReader(open(HERE / "muestra.csv")))
    events = []
    for r in sample:
        if r["event"] not in events:
            events.append(r["event"])
    events.sort(key=lambda e: ORDER.index(next((k for k in ORDER if k in e.lower()), ORDER[0])))
    per_event = {e: [d for d in D if d["event"] == e] for e in events}
    reps = [d for d in D if d["representativa"] == "1"]
    if "--representativas" in sys.argv:
        p = sys.argv[sys.argv.index("--representativas") + 1]
        w = csv.writer(open(p, "w"))
        w.writerow(["photo_id", "event_id", "event", "filename", *[d["id"] for d in tax], "note"])
        for d in sorted(reps, key=lambda d: (d["event"], d["filename"])):
            w.writerow([d["photo_id"], d["event_id"], d["event"], d["filename"], *[d[x["id"]] for x in tax], d["note"]])
    o = []
    o.append("# Caracterización de los eventos por foto (criterio del autor)\n")
    o.append(f"Codificación manual del autor con la app `scripts/eval/review/caracterizacion/` (backend, rama `eswa/evaluacion`) sobre 10 fotos con dorsal legible por evento elegidas en los extremos de las medidas de píxeles (`seleccionar.py`, `muestra.csv`: más oscura, más clara, más quemada, menos y más saturada, menos y más nítida, placa más pequeña, más grande y más oblicua), en cinco dimensiones cerradas (`dimensiones.json`). Decisiones en `carac-decisiones.csv`, última línea por foto. {len(D)} de {len(sample)} fotos codificadas; {len(reps)} marcadas representativas. Entropía normalizada: 0 = todas las fotos del evento iguales en esa dimensión, 1 = reparto uniforme entre las opciones. Tabla generada por `tabular.py`.\n")
    o.append("## Moda por evento y dimensión (entre paréntesis, % de las fotos del evento)\n")
    o.append("| Evento | n | " + " | ".join(d["label"] for d in tax) + " |\n|---|---:|" + "---|" * len(tax))
    for e in events:
        g = per_event[e]
        cells = []
        for d in tax:
            c = collections.Counter(x[d["id"]] for x in g)
            if not c:
                cells.append("")
                continue
            m, n = c.most_common(1)[0]
            cells.append(f"{lab[(d['id'], m)]} ({100 * n / len(g):.0f})")
        o.append(f"| {short(e)} | {len(g)} | " + " | ".join(cells) + " |")
    o.append("")
    o.append("## Variedad dentro de cada evento (entropía normalizada por dimensión)\n")
    o.append("| Evento | " + " | ".join(d["label"] for d in tax) + " | Media |\n|---|" + "---:|" * (len(tax) + 1))
    for e in events:
        g = per_event[e]
        hs = [entropy(collections.Counter(x[d["id"]] for x in g), len(d["opciones"])) for d in tax]
        o.append(f"| {short(e)} | " + " | ".join(f"{h:.2f}" for h in hs) + f" | {sum(hs) / len(hs):.2f} |")
    o.append("")
    o.append("## Distribución completa por dimensión (fotos por evento)\n")
    for d in tax:
        opts = [a for a, _ in d["opciones"]]
        o.append(f"### {d['label']}\n")
        o.append("| Evento | " + " | ".join(lab[(d["id"], a)] for a in opts) + " |\n|---|" + "---:|" * len(opts))
        tot = collections.Counter()
        for e in events:
            c = collections.Counter(x[d["id"]] for x in per_event[e])
            tot.update(c)
            o.append(f"| {short(e)} | " + " | ".join(str(c.get(a, 0)) for a in opts) + " |")
        o.append("| Todos | " + " | ".join(str(tot.get(a, 0)) for a in opts) + " |")
        used = sum(1 for a in opts if tot.get(a, 0))
        o.append(f"\nOpciones presentes en el conjunto: {used} de {len(opts)}; entropía entre todas las fotos {entropy(tot, len(opts)):.2f}.\n")
    o.append("## Fotos representativas marcadas\n")
    if reps:
        o.append("| Evento | Archivo | " + " | ".join(d["label"] for d in tax) + " | Nota |\n|---|---|" + "---|" * (len(tax) + 1))
        for d in sorted(reps, key=lambda d: (short(d["event"]), d["filename"])):
            o.append(f"| {short(d['event'])} | {d['filename']} | " + " | ".join(lab[(x["id"], d[x["id"]])] for x in tax) + f" | {d['note']} |")
    else:
        o.append("Ninguna todavía.")
    o.append("")
    print("\n".join(o))


if __name__ == "__main__":
    main()
