# Decisiones de Optimización - Skills y Testing

> **Fecha:** 2025-01-27  
> **Contexto:** Conversación de arquitectura de agentes y optimización

---

## 1. Skills vs Subagentes

**Decisión:** Usar solo **Skills**, no Subagentes.

**Razón:**
- Flujo inherentemente secuencial
- Skills suficientes para el caso de uso
- Menos complejidad = menos puntos de fallo

**Skills:** plan-task, implement-feature, write-tests, review-code, document-code, manage-git, research-external, **context-keeper**

---

## 2. Estrategia de Testing

**Decisión:** Calidad sobre coverage. E2E fuera de scope.

**Cambios:**
- ❌ Eliminar metas de coverage %
- ✅ Complejidad Ciclomática como criterio (CC ≥ 5 → test obligatorio)
- ✅ Prioridad: Integration > Unit selectivos
- ❌ E2E fuera de scope del backend MVP

---

## 3. ContextKeeper

**Decisión:** Sistema de ledger local para optimizar tokens.

```
.claude/ledger/
├── sessions/{TICKET-ID}.md   # Estado por ticket
└── research/{technology}.md   # Cache de investigaciones
```

**Reglas:**
- Sessions: Estado, decisiones, riesgos. NO código. Max ~50 líneas.
- Research: Facts. Consultar ANTES de MCP calls.
- En `.gitignore` (local only).

---

## 4. Flujo Refinado

```
Ticket → [Planner] → [Developer] → [Tester] → [Documenter] → [Reviewer] → PR
```

**Límite:** 3 fallos de reviewer → PR con errores para revisión manual.

---

## Próximos Pasos

- [ ] Probar ContextKeeper en ticket real
- [ ] Evaluar hook automático para ledger
- [ ] Definir flujo preview → production
