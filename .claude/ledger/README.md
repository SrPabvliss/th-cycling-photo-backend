# ContextKeeper

> Sistema de gestión de contexto para optimizar consumo de tokens.

## Estructura

```
.claude/ledger/
├── sessions/           # Una sesión por ticket (persistente, local)
│   └── {TICKET-ID}.md
└── research/           # Cache de investigaciones (persistente, crece)
    └── {technology}.md
```

## Reglas

### Sessions
- **Un archivo por ticket**: `sessions/TTV-001.md`
- **NO código** - solo estado, decisiones, riesgos
- **Máximo ~50 líneas** - conciso y escaneable
- **Actualizar, no acumular** - sobrescribir estado, no histórico infinito

### Research Cache
- **Un archivo por tecnología**: `research/socket-io.md`
- **Solo facts** - versión, docs, notas clave
- **Consultar antes de investigar** - evita MCP calls redundantes
- **Crece con el tiempo** - conocimiento acumulado

## Uso

Al iniciar trabajo en un ticket:
```
"Trabajamos en TTV-015"
→ Lee/crea .claude/ledger/sessions/TTV-015.md
```

Al necesitar research:
```
"Necesito info de socket.io"
→ Primero lee .claude/ledger/research/socket-io.md
→ Si no existe o insuficiente → Investiga → Actualiza cache
```

## Beneficios

| Sin ContextKeeper | Con ContextKeeper |
|-------------------|-------------------|
| Planner lee 50K+ tokens | Planner lee ~2K del ledger |
| Research cada vez | Research consulta cache primero |
| Sin contexto de errores | Historial de review attempts |
