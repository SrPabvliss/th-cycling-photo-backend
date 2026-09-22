#!/usr/bin/env bash
# Resume the full run after an interruption: runs 9-11 continue, rfdetr+trocr starts.
set -uo pipefail
cd "$(dirname "$0")/../.."
LOG=../cycling-photo-backups/eval; STAMP=$(date +%Y%m%d-%H%M)
R() { nohup npx tsx scripts/eval/run.ts --concurrency 4 "$@" > "$LOG/full-$STAMP-$1-$2.log" 2>&1 & }
nohup npx tsx scripts/eval/run.ts --detector yolo --ocr parseq --label x --resume 9 --concurrency 4 > "$LOG/full-$STAMP-yolo-parseq.log" 2>&1 &
nohup npx tsx scripts/eval/run.ts --detector yolo --ocr trocr --label x --resume 10 --concurrency 4 > "$LOG/full-$STAMP-yolo-trocr.log" 2>&1 &
nohup npx tsx scripts/eval/run.ts --detector rfdetr_v3 --ocr parseq --label x --resume 11 --concurrency 4 > "$LOG/full-$STAMP-rfdetr-parseq.log" 2>&1 &
nohup npx tsx scripts/eval/run.ts --detector rfdetr_v3 --ocr trocr --label "completa rfdetr_v3+trocr" --concurrency 4 > "$LOG/full-$STAMP-rfdetr-trocr.log" 2>&1 &
wait
