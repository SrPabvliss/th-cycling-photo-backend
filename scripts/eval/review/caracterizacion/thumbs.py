"""Thumbnails (long side 420 px) of the candidate photos, for the grid of repr.html.
Usage: uv run python thumbs.py [--cache ~/thesis/review-cache]  (writes <cache>/thumbs/<photo_id>.jpg)
"""
import argparse, csv, os
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("--cache", default=os.path.expanduser("~/thesis/review-cache"))
a = ap.parse_args()
out = Path(a.cache) / "thumbs"
out.mkdir(exist_ok=True)
seen = set()
n = 0
for r in csv.DictReader(open(HERE / "candidatos.csv")):
    if r["photo_id"] in seen:
        continue
    seen.add(r["photo_id"])
    dst = out / f"{r['photo_id']}.jpg"
    if dst.exists():
        continue
    im = Image.open(Path(a.cache) / r["event_id"] / f"{r['photo_id']}.jpg").convert("RGB")
    im.thumbnail((420, 420))
    im.save(dst, quality=80)
    n += 1
print(len(seen), "fotos,", n, "miniaturas nuevas")
