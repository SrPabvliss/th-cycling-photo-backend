"""Tabulate the failure-cause labels of the winning pair (data/fallos-decisiones.csv).

Merge rule per photo: the motivo comes from the last line; the reference correction
(truth_fix) comes from the last line that carries one, because a correction and the
remaining motivo may have been saved as two consecutive lines.

Usage: python3 tabular.py [--corrections out.csv] > README.md
"""

from __future__ import annotations

import collections
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEYS = "at,photo_id,event_id,event,filename,tipo,truth,read,motivo,submotivo,marcas,note,truth_fix,has_fix".split(",")
TIP = {
    "no_detectada": "No detectada",
    "sustitucion": "Sustitución",
    "digitos_de_mas": "Dígitos de más",
    "digitos_de_menos": "Dígitos de menos",
    "varias_lecturas": "Varias lecturas",
    "lee_sin_placa": "Lee donde la referencia dice sin placa",
    "ilegible_ref": "Ilegible en referencia",
}


def load() -> list[dict]:
    rows = [dict(zip(KEYS, r + [""] * (len(KEYS) - len(r)))) for r in list(csv.reader(open(HERE / "data" / "fallos-decisiones.csv")))[1:]]
    by: dict[str, list[dict]] = collections.defaultdict(list)
    for r in rows:
        by[r["photo_id"]].append(r)
    out = []
    for rs in by.values():
        d = dict(rs[-1])
        fixes = [r for r in rs if r["has_fix"] == "1" or r["truth_fix"]]
        d["has_fix"] = "1" if fixes else ""
        d["truth_fix"] = fixes[-1]["truth_fix"] if fixes else ""
        if d["motivo"] == "referencia_errada" and d["truth_fix"] != d["read"]:
            d["motivo_missing"] = "1"
        out.append(d)
    return out


def main() -> None:
    tax = json.load(open(HERE / "motivos.json"))
    lab = {m["id"]: m["label"] for m in tax["motivos"]}
    short = {m["id"]: m["label"].split(" (")[0].split(":")[0] for m in tax["motivos"]}
    sub = {(m["id"], a): b for m in tax["motivos"] for a, b in m["sub"]}
    D = load()
    U = list(csv.DictReader(open(HERE / "universo-fallos.csv")))
    real = [d for d in D if d["tipo"] != "ilegible_ref"]
    fix = [d for d in D if d["has_fix"] == "1"]
    if "--corrections" in sys.argv:
        p = sys.argv[sys.argv.index("--corrections") + 1]
        w = csv.writer(open(p, "w"))
        w.writerow(["photo_id", "event_id", "event", "filename", "tipo", "truth_before", "read", "truth_after", "unreadable_before", "motivo_restante"])
        for d in sorted(fix, key=lambda d: (d["event"], d["filename"])):
            w.writerow([d["photo_id"], d["event_id"], d["event"], d["filename"], d["tipo"], d["truth"], d["read"], d["truth_fix"], "1" if d["tipo"] == "ilegible_ref" else "", "" if d["motivo"] == "referencia_errada" else d["motivo"]])
    o = []
    o.append("# Motivos de fallo del par ganador (RF-DETR-L@896 + SVTRv2-B)\n")
    o.append("Etiquetado manual del autor, 2026-10-11, con la app `scripts/eval/review/fallos/` (backend, rama `eswa/evaluacion`). Muestra estratificada por evento y tipo de fallo sobre el universo de fallos del par ganador a umbral de validación 0,50 (corridas 50, 54, 58, 62; `universo-fallos.csv`): fallos reales más 50 fotos marcadas ilegibles en la referencia, para validar esa marca. Un motivo principal por foto y submotivo (`motivos.json`). Decisiones en `fallos-decisiones.csv`, última línea por foto; la corrección de referencia se toma de la última línea que la lleve. Tabla generada por `tabular.py`.\n")
    cu = collections.Counter(r["tipo"] for r in U)
    cs = collections.Counter(d["tipo"] for d in D)
    o.append("## Universo y muestra\n")
    o.append("| Tipo de fallo | Universo | Muestra |\n|---|---:|---:|")
    for t in TIP:
        o.append(f"| {TIP[t]} | {cu.get(t, 0)} | {cs.get(t, 0)} |")
    o.append(f"| Total | {len(U)} | {len(D)} |\n")
    cm = collections.Counter(d["motivo"] for d in real)
    o.append(f"## Motivo principal ({len(real)} fallos reales; sin las 50 ilegibles de validación)\n")
    o.append("| Motivo | Fotos | % | Submotivos |\n|---|---:|---:|---|")
    for m, n in cm.most_common():
        ss = collections.Counter(d["submotivo"] for d in real if d["motivo"] == m and d["submotivo"])
        o.append(f"| {lab[m]} | {n} | {100 * n / len(real):.1f} | {', '.join(f'{sub[(m, k)]} {v}' for k, v in ss.most_common())} |")
    o.append("")
    ms = [m for m, _ in cm.most_common()]
    head = "| n | " + " | ".join(short[m] for m in ms) + " |"
    o.append("## Motivo por tipo de fallo\n")
    o.append("| Tipo " + head + "\n|---|---:|" + "---:|" * len(ms))
    for t in TIP:
        g = [d for d in D if d["tipo"] == t]
        if not g:
            continue
        c = collections.Counter(d["motivo"] for d in g)
        o.append(f"| {TIP[t]} | {len(g)} | " + " | ".join(str(c.get(m, 0)) for m in ms) + " |")
    o.append("")
    o.append("## Motivo por evento (fallos reales)\n")
    o.append("| Evento " + head + "\n|---|---:|" + "---:|" * len(ms))
    for e in sorted(set(d["event"] for d in real)):
        g = [d for d in real if d["event"] == e]
        c = collections.Counter(d["motivo"] for d in g)
        o.append(f"| {e} | {len(g)} | " + " | ".join(str(c.get(m, 0)) for m in ms) + " |")
    o.append("")
    fr = [d for d in fix if d["tipo"] != "ilegible_ref"]
    right = sum(1 for d in fix if d["truth_fix"] == d["read"])
    o.append("## Correcciones de referencia\n")
    o.append(f"{len(fix)} fotos con referencia corregida: {len(fr)} entre los {len(real)} fallos reales ({100 * len(fr) / len(real):.1f} %) y {len(fix) - len(fr)} entre las 50 ilegibles. En {right} el modelo tenía razón; en {len(fix) - right} la etiqueta estaba mal y el modelo también falla contra la etiqueta corregida, por lo que llevan motivo. Por tipo: " + ", ".join(f"{TIP[k]} {v}" for k, v in collections.Counter(d["tipo"] for d in fix).items()) + ".\n")
    o.append("Sesgo declarado: solo se revisaron fotos donde el ganador discrepó de la referencia; una etiqueta errada con la que el ganador coincide no se detecta.\n")
    o.append("| Evento | Archivo | Tipo | Referencia | Leído | Corregida a | Motivo restante |\n|---|---|---|---|---|---|---|")
    for d in sorted(fix, key=lambda d: (d["event"], d["filename"])):
        rest = "" if d["motivo"] == "referencia_errada" else lab[d["motivo"]] + (" / " + sub[(d["motivo"], d["submotivo"])] if d["submotivo"] else "")
        o.append(f"| {d['event']} | {d['filename']} | {TIP[d['tipo']]} | {d['truth'].replace(';', ' ') or '—'} | {d['read'].replace(';', ' ') or '—'} | {d['truth_fix'].replace(';', ' ') or 'sin placa'} | {rest} |")
    o.append("")
    c_s = collections.Counter(d["motivo"] for d in D if d["tipo"] == "sustitucion")
    c_n = collections.Counter(d["motivo"] for d in D if d["tipo"] == "no_detectada")
    c_l = collections.Counter(d["motivo"] for d in D if d["tipo"] == "lee_sin_placa")
    c_i = collections.Counter(d["motivo"] for d in D if d["tipo"] == "ilegible_ref")
    cable = sum(1 for d in real if d["submotivo"] == "cable")
    o.append("## Lectura\n")
    o.append(f"- Oclusión por el cable de freno es la causa dominante: {cable} de {len(real)} fallos reales, y {c_s['oclusion']} de {sum(c_s.values())} sustituciones son oclusión. Es un remedio del organizador (cable por fuera de la placa), no del modelo.")
    o.append(f"- Barro casi no pesa: {sum(1 for d in real if d['submotivo'] == 'barro')} fotos. Dentro de captura manda reflejo o flash ({sum(1 for d in real if d['submotivo'] == 'reflejo')}) y luego desenfoque ({sum(1 for d in real if d['submotivo'] == 'desenfoque')}).")
    o.append(f"- 'Lee donde la referencia dice sin placa' es sobre todo ruido de etiqueta: {c_l['referencia_errada']} de {sum(c_l.values())} eran placas reales sin etiquetar. Esa columna de la tabla 3.2 se reinterpreta tras corregir la referencia.")
    o.append(f"- No detectada: {c_n['sin_causa']} de {sum(c_n.values())} sin causa visible, el hueco real del detector; el resto es posición {c_n['posicion']}, captura {c_n['captura']}, escala {c_n['escala']}.")
    o.append(f"- Validación de la marca 'ilegible': {c_i['referencia_errada']} de {sum(c_i.values())} eran legibles; el resto se reparte en posición {c_i['posicion']}, captura {c_i['captura']}, oclusión {c_i['oclusion']}.")
    miss = [d for d in D if d.get("motivo_missing")]
    if miss:
        o.append(f"- Pendiente: {len(miss)} fotos con referencia corregida distinta de lo leído y sin motivo del fallo restante.")
    o.append("\n## Siguiente paso\n\nAplicar las correcciones (`correcciones-referencia.csv`) a `eval.dataset_photos` y `eval.ground_truth_bibs` de la DB dev y recalcular métricas y bootstrap de todos los pares con la referencia corregida.\n")
    print("\n".join(o))


if __name__ == "__main__":
    main()
