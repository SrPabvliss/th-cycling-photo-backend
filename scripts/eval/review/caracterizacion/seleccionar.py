"""Pick the 10 photos per event that sit at the extremes of the pixel statistics
(scripts/eval/review/caracterizacion/imgstats.py), among included photos with a
legible bib, so the author can confirm the conditions each event spans.

Usage: python3 seleccionar.py imgstats.tsv legibles.tsv > muestra.csv
"""
import csv, sys

CRITERIA = [  # (label shown in the app, column, pick max?)
    ("más oscura", "luma", False), ("más clara", "luma", True), ("más quemada (sol duro)", "pct_hi", True),
    ("menos saturada (polvo, niebla, luz plana)", "sat", False), ("más saturada", "sat", True),
    ("menos nítida", "sharp", False), ("más nítida", "sharp", True),
    ("placa más pequeña (lejos)", "plate_h_rel", False), ("placa más grande (cerca)", "plate_h_rel", True),
    ("placa más oblicua o doblada (ancho/alto mínimo)", "plate_aspect", False),
]
stats = {r["photo_id"]: r for r in csv.DictReader(open(sys.argv[1]), delimiter="\t")}
leg = [l.rstrip("\n").split("\t") for l in open(sys.argv[2])]
by = {}
for pid, eid, ev, fn, w, h, truth, boxes in leg:
    s = stats.get(pid)
    if not s or not s["plate_h_rel"]:
        continue
    by.setdefault(ev, []).append((pid, eid, ev, fn, w, h, truth, boxes, s))
out = csv.writer(sys.stdout, lineterminator="\n")
out.writerow("photo_id,event_id,event,filename,w,h,unreadable,truth,boxes,criterio".split(","))
for ev in sorted(by):
    taken = set()
    for label, col, hi in CRITERIA:
        cand = sorted(by[ev], key=lambda r: float(r[8][col]), reverse=hi)
        pick = next(r for r in cand if r[0] not in taken)
        taken.add(pick[0])
        out.writerow([*pick[:6], "f", pick[6], pick[7], f"{label}: {pick[8][col]}"])
