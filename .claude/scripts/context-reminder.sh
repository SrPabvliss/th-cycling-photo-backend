#!/bin/bash
# Context reminder al terminar sesión

SESSIONS_DIR=".claude/ledger/sessions"

# Buscar sesión más reciente (no template)
LATEST_SESSION=$(ls -t "$SESSIONS_DIR"/*.md 2>/dev/null | grep -v "_TEMPLATE" | head -1)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 CONTEXTKEEPER REMINDER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$LATEST_SESSION" ]; then
    TICKET=$(basename "$LATEST_SESSION" .md)
    echo "Session: $TICKET"
    echo ""
    echo "Update if changed:"
    echo "  • Status/phase"
    echo "  • Decisions"
    echo "  • Files touched"
    echo ""
    echo "Also check: .claude/ledger/research/"
else
    echo "No active session."
    echo "Create: sessions/{TICKET-ID}.md"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
