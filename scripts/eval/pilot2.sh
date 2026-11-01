#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
R() { npx tsx scripts/eval/run.ts --events 48a131cc-b2ba-4e75-b64e-975d699effa2 --concurrency 4 "$@" 2>&1 | grep -v injecting; }
echo "=== yolo+parseq pre=on";   R --detector yolo --ocr parseq --label "piloto pre=on yolo+parseq" --endpoint https://martinvillacres51--eval-yolo-parseq-pre-api.modal.run
echo "=== rfdetr+parseq pre=on"; R --detector rfdetr_v3 --ocr parseq --label "piloto pre=on rfdetr+parseq" --endpoint https://martinvillacres51--eval-rfdetr-parseq-pre-api.modal.run
echo "=== yolo+parseq pad=0.20";   R --detector yolo --ocr parseq --label "piloto pad=0.20 yolo+parseq" --bib-padding 0.20
echo "=== rfdetr+parseq pad=0.20"; R --detector rfdetr_v3 --ocr parseq --label "piloto pad=0.20 rfdetr+parseq" --bib-padding 0.20
