#!/usr/bin/env bash
# Full run: the four combinations over every photo, in parallel (one process
# per app). Each run is resumable with --resume <id> if it stops.
set -uo pipefail
cd "$(dirname "$0")/../.."
LOG=../cycling-photo-backups/eval
mkdir -p "$LOG"
STAMP=$(date +%Y%m%d-%H%M)
for pair in "yolo parseq" "yolo trocr" "rfdetr_v3 parseq" "rfdetr_v3 trocr"; do
  read -r det ocr <<< "$pair"
  nohup npx tsx scripts/eval/run.ts --detector "$det" --ocr "$ocr" \
    --label "completa $det+$ocr" --concurrency 4 \
    > "$LOG/full-$det-$ocr-$STAMP.log" 2>&1 &
  echo "$det+$ocr pid $!"
done
wait
echo "all done"
