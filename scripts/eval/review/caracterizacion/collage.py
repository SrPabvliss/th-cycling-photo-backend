"""Render the test-set conditions collage from the author's choices.

Reads data/collage.csv (written by the /collage page of repr-server.ts; last
line per (dimension, opcion) wins), candidatos.csv (event ids and file names)
and dimensiones.json (row and cell order), and draws one figure: a row per
dimension, a cell per visible condition, an English label under each photo.
The crop is the same as in the page: the largest window with the chosen
aspect inside the photo, divided by zoom, centred on the focal point (fx, fy)
and clamped inside the image.

Usage (PIL only lives in cycling-photo-ai):
  cd ~/thesis/projects/cycling-photo-ai && uv run python \
    ~/thesis/projects/cycling-photo-backend/scripts/eval/review/caracterizacion/collage.py \
    --out collage.png [--cell 900] [--cache ~/thesis/review-cache] [--csv-out tabla.csv]
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
DEF_DIM = {"luz": "Lighting", "entorno": "Surroundings", "clima": "Weather", "angulo": "Camera angle", "distancia": "Distance"}
FONTS = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size, index=1 if bold and p.endswith(".ttc") else 0)
            except OSError:
                continue
    return ImageFont.load_default()


def crop_box(w: int, h: int, ar: float, fx: float, fy: float, zoom: float) -> tuple[float, float, float, float]:
    cw = min(w, h * ar) / zoom
    ch = cw / ar
    cw, ch = min(cw, w), min(ch, h)
    x = min(max(0.0, fx * w - cw / 2), w - cw)
    y = min(max(0.0, fy * h - ch / 2), h - ch)
    return x, y, x + cw, y + ch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--cell", type=int, default=900, help="cell width in px (print: 900 gives ~5 cols at 300 dpi on 16 cm... adjust)")
    ap.add_argument("--cache", default=str(Path.home() / "thesis" / "review-cache"))
    ap.add_argument("--state", default=str(HERE / "data" / "collage.csv"))
    ap.add_argument("--csv-out", help="also write the table of chosen photos")
    a = ap.parse_args()

    tax = json.load(open(HERE / "dimensiones.json"))["dimensiones"]
    cands = {(r["dimension"], r["opcion"], r["photo_id"]): r for r in csv.DictReader(open(HERE / "candidatos.csv"))}
    state: dict[tuple[str, str], dict] = {}
    for r in csv.DictReader(open(a.state)):
        state[(r["dimension"], r["opcion"])] = r

    def g(name: str, dflt: str) -> str:
        return state.get(("_global", name), {}).get("label") or dflt

    ar = float(g("ar", "1.3333"))
    align = g("align", "left")
    show_title = g("showtitle", "0") == "1"
    title = g("title", "Event photo conditions")

    cell_w = a.cell
    cell_h = round(cell_w / ar)
    gap = round(cell_w * 0.05)
    pad = round(cell_w * 0.10)
    cap_f = font(round(cell_w * 0.075))
    row_f = font(round(cell_w * 0.085), bold=True)
    title_f = font(round(cell_w * 0.10), bold=True)
    cap_h = round(cell_w * 0.075 * 1.6)
    title_h = round(cell_w * 0.10 * 1.6 + gap * 0.5) if show_title else 0

    rows = []
    chosen = []
    for d in tax:
        label = state.get((d["id"], ""), {}).get("label") or DEF_DIM.get(d["id"], d["label"])
        cells = []
        for opt, _desc in d["opciones"]:
            s = state.get((d["id"], opt))
            if not s or s.get("visible") == "0" or not s.get("photo_id"):
                continue
            c = cands.get((d["id"], opt, s["photo_id"]))
            if not c:
                raise SystemExit(f"{d['id']}/{opt}: photo {s['photo_id']} is not a candidate")
            cells.append((opt, s, c))
            chosen.append({"dimension": d["id"], "opcion": opt, "label": s["label"], "photo_id": c["photo_id"], "event": c["event"], "filename": c["filename"], "fx": s["fx"], "fy": s["fy"], "zoom": s["zoom"]})
        if cells:
            rows.append((label, cells))
    if not rows:
        raise SystemExit("no visible cells with a photo in the collage state")

    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    rowt_w = max(probe.textlength(label, font=row_f) for label, _ in rows) + gap * 0.5
    max_cells = max(len(c) for _, c in rows)
    W = round(pad * 2 + rowt_w + gap + max_cells * cell_w + (max_cells - 1) * gap)
    row_h = cell_h + round(cell_w * 0.03) + cap_h
    H = round(pad * 2 + title_h + len(rows) * row_h + (len(rows) - 1) * gap)
    im = Image.new("RGB", (W, H), "white")
    dr = ImageDraw.Draw(im)
    y = pad
    if show_title:
        dr.text((W / 2, y), title, font=title_f, fill="black", anchor="mt")
        y += title_h
    for label, cells in rows:
        dr.text((pad, y + cell_h / 2), label, font=row_f, fill="black", anchor="lm")
        row_w = len(cells) * cell_w + (len(cells) - 1) * gap
        x = pad + rowt_w + gap + ((max_cells * cell_w + (max_cells - 1) * gap - row_w) / 2 if align == "center" else 0)
        for _opt, s, c in cells:
            src = Path(a.cache) / c["event_id"] / f"{c['photo_id']}.jpg"
            ph = Image.open(src).convert("RGB")
            box = crop_box(ph.width, ph.height, ar, float(s["fx"]), float(s["fy"]), float(s["zoom"]))
            tile = ph.resize((cell_w, cell_h), Image.LANCZOS, box=box)
            im.paste(tile, (round(x), round(y)))
            dr.text((x + cell_w / 2, y + cell_h + cell_w * 0.03), s["label"], font=cap_f, fill="black", anchor="mt")
            x += cell_w + gap
        y += row_h + gap
    im.save(a.out, quality=95)
    print(f"{a.out}: {W}x{H}, {sum(len(c) for _, c in rows)} cells in {len(rows)} rows")
    if a.csv_out:
        with open(a.csv_out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(chosen[0].keys()))
            w.writeheader()
            w.writerows(chosen)
        print(f"{a.csv_out}: {len(chosen)} rows")


if __name__ == "__main__":
    main()
