"""Build the folder of representative photos per dimension and option.

representantes.csv (hand selection by the assistant, reviewed by the author) lists,
for every option of every dimension in dimensiones.json, up to 3 principal photos
(the most extreme examples of that condition found in the 13 024 test photos with a
legible bib) and 3 alternatives. This script copies reduced copies of those photos
into <out>/<dimension>/<option>/<P|A><n>_<event>_<file>.jpg, writes one contact
sheet per dimension and a README.md with the table.

Usage: uv run python representantes.py --out DIR [--cache ~/thesis/review-cache]
"""
import argparse, csv, json, os, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ORDER = ["lost line", "2da.", "cevallos", "lumbis", "ecuador open", "pimampiro", "3ra.", "sigchos", "el bosque", "shimano", "telef"]
SHORT = dict(zip(ORDER, ["LostLine", "Coto", "Cevallos", "Lumbisi", "EcuadorOPEN", "Pimampiro", "Pamba", "Sigchos", "ElBosque", "SHIMANO", "Teleferico"]))
short = lambda e: next((SHORT[k] for k in ORDER if k in e.lower()), e)

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--cache", default=os.path.expanduser("~/thesis/review-cache"))
a = ap.parse_args()
out = Path(a.out)
tax = json.load(open(HERE / "dimensiones.json"))["dimensiones"]
rows = list(csv.DictReader(open(HERE / "representantes.csv")))
ev_id = {}
for l in open(HERE / "muestra.csv"):
    pass
# event_id per photo comes from the per-photo stats export (legibles) kept next to the sample
leg = {}
for r in csv.DictReader(open(HERE / "muestra.csv")):
    ev_id[r["event"]] = r["event_id"]
missing = [r for r in rows if r["event"] not in ev_id]
assert not missing, missing
if out.exists():
    shutil.rmtree(out)
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
fontb = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
md = ["# Fotos representativas por dimensión y opción\n",
      "Selección del asistente sobre las 13 024 fotos de prueba con dorsal legible (`representantes.csv`): hasta 3 principales por opción (los ejemplos más marcados de esa condición) y 3 alternativas por si el autor no está de acuerdo. Carpeta `<dimensión>/<opción>/P<n>_...` y `A<n>_...`; una hoja de contacto por dimensión (`hoja-<dimensión>.jpg`). Generado por `scripts/eval/review/caracterizacion/representantes.py`.\n"]
for d in tax:
    opts = [o for o, _ in d["opciones"]]
    labels = {o: l for o, l in d["opciones"]}
    md.append(f"## {d['label']}\n")
    md.append("| Opción | Rango | n | Evento | Archivo | Nota |\n|---|---|---:|---|---|---|")
    cells = []
    for o in opts:
        sel = [r for r in rows if r["dimension"] == d["id"] and r["opcion"] == o]
        if not sel:
            md.append(f"| {labels[o].split(' (')[0]} | — | | | | sin foto: excluida por construcción (sin dorsal legible) |")
            continue
        dirp = out / d["id"] / o
        dirp.mkdir(parents=True, exist_ok=True)
        for r in sel:
            tag = ("P" if r["rango"] == "principal" else "A") + r["orden"]
            src = Path(a.cache) / ev_id[r["event"]] / f"{r['photo_id']}.jpg"
            im = Image.open(src).convert("RGB")
            im.thumbnail((1200, 1200))
            name = f"{tag}_{short(r['event'])}_{Path(r['filename']).stem}.jpg"
            im.save(dirp / name, quality=85)
            cells.append((o, tag, im.copy(), f"{short(r['event'])} {r['filename']}"))
            md.append(f"| {labels[o].split(' (')[0]} | {r['rango']} | {r['orden']} | {short(r['event'])} | {r['filename']} | {r['nota']} |")
    md.append("")
    # contact sheet: one row per option, P1..P3 A1..A3
    cw, ch = 200, 300
    rows_opts = [o for o in opts if any(c[0] == o for c in cells)]
    sheet = Image.new("RGB", (6 * cw + 160, len(rows_opts) * (ch + 24) + 30), "white")
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 6), d["label"], fill="black", font=fontb)
    for ri, o in enumerate(rows_opts):
        y = 30 + ri * (ch + 24)
        dr.text((8, y + 4), labels[o].split(" (")[0][:22], fill="black", font=fontb)
        for c in [c for c in cells if c[0] == o]:
            idx = ("P1 P2 P3 A1 A2 A3".split()).index(c[1])
            x = 160 + idx * cw
            th = c[2].copy(); th.thumbnail((cw, ch))
            sheet.paste(th, (x + (cw - th.width) // 2, y))
            dr.text((x + 2, y + ch + 2), f"{c[1]} {c[3][:28]}", fill="black" if c[1][0] == "P" else "gray", font=font)
    sheet.save(out / f"hoja-{d['id']}.jpg", quality=80)
(out / "README.md").write_text("\n".join(md) + "\n")
print(out, len(rows), "fotos copiadas")
