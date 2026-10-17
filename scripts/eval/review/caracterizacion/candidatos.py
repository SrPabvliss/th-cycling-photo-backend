"""Candidate pool per dimension and option for the author's visual selection of
representative photos (repr-server.ts / repr.html).

Pool for an option = every photo already labelled with that option (prelabels.csv,
overridden by data/carac-decisiones.csv) plus, among the remaining photos with a
legible bib and a box of the winning pair (legibles.tsv), the N best ranked by a
pixel proxy (imgstats.tsv) when the condition has one, or a random sample from the
events where the condition is known to occur when it does not. The author then
shortlists and picks by eye; the proxy only decides what is shown first.

Usage: python3 candidatos.py [--n 60] > candidatos.csv
"""
import argparse, csv, json, random, statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=60)
a = ap.parse_args()

stats = {r["photo_id"]: r for r in csv.DictReader(open(HERE / "imgstats.tsv"), delimiter="\t")}
leg = {}
for l in open(HERE / "legibles.tsv"):
    pid, eid, ev, fn, w, h, truth, boxes = l.rstrip("\n").split("\t")
    if pid in stats and stats[pid]["plate_h_rel"]:
        leg[pid] = dict(photo_id=pid, event_id=eid, event=ev, filename=fn, truth=truth, boxes=boxes)
cols = ["luma", "contrast", "pct_hi", "pct_lo", "sharp", "colorful", "sat", "plate_h_rel", "plate_aspect"]
mu = {c: statistics.mean(float(stats[p][c]) for p in leg) for c in cols}
sd = {c: statistics.pstdev(float(stats[p][c]) for p in leg) for c in cols}
z = lambda p, c: (float(stats[p][c]) - mu[c]) / sd[c]

pre = {r["photo_id"]: dict(r) for r in csv.DictReader(open(HERE / "prelabels.csv"))}
dec_path = HERE / "data" / "carac-decisiones.csv"
if dec_path.exists():
    for d in csv.DictReader(open(dec_path)):
        if d["photo_id"] in pre:
            for k in ["luz", "entorno", "clima", "angulo", "distancia"]:
                pre[d["photo_id"]][k] = d[k]

SCORE = {
    ("luz", "sol_directo"): lambda p: z(p, "pct_hi") + z(p, "contrast"),
    ("luz", "nublado_difusa"): lambda p: z(p, "luma") - z(p, "contrast") - z(p, "sat"),
    ("luz", "sombra_bosque"): lambda p: -z(p, "luma") - z(p, "contrast"),
    ("luz", "noche_artificial"): lambda p: -z(p, "luma"),
    ("clima", "niebla"): lambda p: -z(p, "contrast") - z(p, "sat") - z(p, "sharp"),
    ("clima", "polvo"): lambda p: -z(p, "sat") - z(p, "contrast"),
    ("clima", "seco"): lambda p: z(p, "sat"),
    ("entorno", "bosque"): lambda p: -z(p, "luma"),
    ("entorno", "pasto_paramo"): lambda p: z(p, "sat"),
    ("entorno", "tierra_abierta"): lambda p: -z(p, "sat"),
    ("angulo", "frontal"): lambda p: z(p, "plate_aspect"),
    ("angulo", "lateral_contrapicado"): lambda p: -z(p, "plate_aspect"),
    ("angulo", "tres_cuartos"): lambda p: -abs(z(p, "plate_aspect")),
    ("distancia", "cerca"): lambda p: z(p, "plate_h_rel"),
    ("distancia", "lejos"): lambda p: -z(p, "plate_h_rel"),
    ("distancia", "media"): lambda p: -abs(z(p, "plate_h_rel")),
}
# Conditions without a pixel proxy: sample from the events where they occur.
EVENTS = {
    ("clima", "barro"): ["lost line"],
    ("clima", "mojado_lluvia"): ["3ra.", "lost line"],
    ("entorno", "urbano"): ["cevallos", "sigchos", "lost line"],
    ("clima", "niebla"): ["3ra."],
    ("luz", "noche_artificial"): ["cevallos"],
}
tax = json.load(open(HERE / "dimensiones.json"))["dimensiones"]
w = csv.writer(open(1, "w", newline=""), lineterminator="\n")
w.writerow(["dimension", "opcion", "orden", "origen", "score", "photo_id", "event_id", "event", "filename", "truth", "boxes"])
random.seed(7)
for d in tax:
    for opt, _ in d["opciones"]:
        key = (d["id"], opt)
        sc = SCORE.get(key, lambda p: 0.0)
        lab = sorted((p for p in pre if p in leg and pre[p][d["id"]] == opt), key=sc, reverse=True)
        evs = EVENTS.get(key)
        pool = [p for p in leg if p not in pre and (not evs or any(e in leg[p]["event"].lower() for e in evs))]
        if key in SCORE:
            pool.sort(key=sc, reverse=True)
        elif evs:
            pool = random.sample(pool, min(a.n, len(pool)))
        else:
            pool = []
        items = [("etiquetada", p) for p in lab] + [("minada", p) for p in pool[: a.n]]
        for i, (src, p) in enumerate(items):
            r = leg[p]
            w.writerow([d["id"], opt, i, src, f"{sc(p):.2f}", p, r["event_id"], r["event"], r["filename"], r["truth"], r["boxes"]])
