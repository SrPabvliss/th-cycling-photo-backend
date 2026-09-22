#!/usr/bin/env bash
# Pilot: the four combinations over one event, one after the other.
set -euo pipefail
cd "$(dirname "$0")/../.."
EVENT="${1:?event uuid}"
LABEL="${2:-piloto}"
for pair in "yolo parseq" "yolo trocr" "rfdetr_v3 parseq" "rfdetr_v3 trocr"; do
  read -r det ocr <<< "$pair"
  echo "=== $det + $ocr"
  npx tsx scripts/eval/run.ts --detector "$det" --ocr "$ocr" --label "$LABEL $det+$ocr" \
    --events "$EVENT" --concurrency 4 2>&1 | grep -v injecting
done
