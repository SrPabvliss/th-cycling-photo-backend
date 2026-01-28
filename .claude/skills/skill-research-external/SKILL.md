---
name: research-external
description: >
  Research external libraries, APIs, or technical solutions.
  Use when investigating new technologies or solving technical problems.
---

# Research External

Research external technologies and solutions.

## When to Use

- Evaluating new libraries or packages
- Investigating API integrations
- Solving technical problems
- Comparing alternatives

## Process

### 1. Define the Problem

```markdown
## Research: [Topic]

### Problem Statement
What specific problem needs solving?

### Requirements
- Must have: [critical requirements]
- Nice to have: [optional features]
- Constraints: [limitations to consider]
```

### 2. Research Sources

| Source Type | Examples |
|-------------|----------|
| Official docs | Library documentation, API references |
| GitHub | Repos, issues, discussions |
| npm/package info | Downloads, maintenance, dependencies |
| Community | Stack Overflow, Discord, forums |

### 3. Evaluate Options

```markdown
### Option A: [Name]

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

**Metrics:**
- npm downloads: X/week
- Last update: [date]
- GitHub stars: X
- Bundle size: X KB
```

### 4. Document Decision

```markdown
### Recommendation

**Selected:** [Option name]

**Rationale:**
1. Reason 1
2. Reason 2

**Trade-offs Accepted:**
- Trade-off 1

**Next Steps:**
1. [ ] Step 1
2. [ ] Step 2
```

## Evaluation Criteria

| Criteria | Questions to Ask |
|----------|------------------|
| Maintenance | Last commit? Active issues? Responsive maintainers? |
| Adoption | npm downloads? GitHub stars? Used by major projects? |
| Documentation | Complete docs? Examples? TypeScript support? |
| Size | Bundle size? Tree-shakeable? |
| Compatibility | Works with our stack? NestJS/Node version? |
| License | MIT/Apache? Commercial use allowed? |

## Output Format

Research should produce:

1. **Summary document** - Problem, options, recommendation
2. **Comparison table** - Side-by-side feature comparison
3. **Decision record** - Why chosen option was selected
4. **Implementation notes** - How to integrate

## Example Topics

- AI service SDK evaluation (Roboflow, Google Vision, Clarifai)
- Storage solutions (S3, B2, local)
- Queue systems (BullMQ, RabbitMQ)
- Authentication strategies
- Caching solutions

## Tips

- Check GitHub issues for known problems
- Look for TypeScript support
- Consider long-term maintenance
- Prototype before committing
- Document findings even for rejected options
