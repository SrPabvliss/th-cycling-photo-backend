#!/usr/bin/env bash
# Launches the chained serial run of one Modal account in the background.
# One container per account (EVAL_TIMING=1), every pair per photo, events in
# the given order (reviewed events first). Log under
# ~/thesis/projects/cycling-photo-backups/eval/serial-<name>-<date>.log.
#
# Usage: scripts/eval/serial-launch.sh <name> <endpoint> <events-comma-separated> [extra args]
#   PAIRS env overrides the pair list.
set -euo pipefail
name="$1"; endpoint="$2"; events="$3"; shift 3
pairs="${PAIRS:-yolo26m_1024:parseq_v2,yolo26m_1024:svtrv2_s,rfdetr_l_896:parseq_v2,rfdetr_l_896:svtrv2_s,yolo:parseq}"
logdir="$HOME/thesis/projects/cycling-photo-backups/eval"
mkdir -p "$logdir"
log="$logdir/serial-$name-$(date +%Y%m%d-%H%M).log"
cd "$(dirname "$0")/../.."
nohup npx tsx scripts/eval/serial.ts --endpoint "$endpoint" --label "encadenado $name" \
  --pairs "$pairs" --events "$events" --bib-padding 0.12 "$@" > "$log" 2>&1 &
echo "pid $! log $log"
