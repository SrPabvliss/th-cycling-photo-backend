# Bootstrap pareado del encadenado: `main_valthr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9593 | 81.8 | 69.4 | **+12.3** | [+11.4, +13.2] | [+5.5, +17.9] | 1666 / 483 | 1.5e-151 | 1.2e-150 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9593 | 79.2 | 69.4 | **+9.8** | [+8.9, +10.7] | [+2.8, +15.3] | 1555 / 615 | 2.4e-93 | 1.7e-92 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9593 | 81.8 | 79.2 | **+2.5** | [+2.0, +3.1] | [+1.6, +3.7] | 517 / 274 | 4.2e-18 | 1.7e-17 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9593 | 79.2 | 74.1 | **+5.1** | [+4.3, +5.8] | [+3.3, +6.5] | 911 / 422 | 1.2e-41 | 5.8e-41 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9593 | 62.1 | 59.4 | **+2.6** | [+2.0, +3.3] | [+1.6, +3.8] | 575 / 321 | 1.8e-17 | 5.3e-17 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 79.2 | 62.1 | **+17.1** | [+16.2, +18.1] | [+5.3, +26.5] | 2013 / 368 | 1.5e-273 | 1.5e-272 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9593 | 79.2 | 78.7 | **+0.5** | [-0.2, +1.2] | [-2.1, +2.7] | 614 / 567 | 0.18 | 0.18 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 78.7 | 62.1 | **+16.7** | [+15.8, +17.6] | [+6.9, +24.5] | 1939 / 341 | 1.6e-270 | 1.5e-269 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9593 | 62.1 | 58.6 | **+3.5** | [+2.6, +4.3] | [+0.3, +7.3] | 994 / 659 | 1.7e-16 | 3.4e-16 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9593 | 62.1 | 69.4 | **-7.3** | [-8.3, -6.4] | [-11.7, -1.8] | 794 / 1499 | 1.1e-49 | 6.4e-49 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9593 | 92.8 | 84.2 | **+8.6** | [+7.8, +9.3] | [+0.7, +14.8] | 1166 / 344 | 1.6e-104 | 1.1e-103 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9593 | 92.8 | 84.2 | **+8.6** | [+7.8, +9.4] | [+0.7, +15.0] | 1166 / 344 | 1.6e-104 | 1.1e-103 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9593 | 92.8 | 92.8 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9593 | 92.8 | 92.8 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9593 | 71.5 | 71.5 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 92.8 | 71.5 | **+21.3** | [+20.4, +22.2] | [+6.8, +33.5] | 2260 / 217 | 0 | 0 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9593 | 92.8 | 92.1 | **+0.7** | [+0.1, +1.3] | [-2.4, +3.1] | 445 / 378 | 0.021 | 0.085 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 92.1 | 71.5 | **+20.6** | [+19.7, +21.5] | [+8.1, +30.9] | 2152 / 176 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9593 | 71.5 | 67.4 | **+4.1** | [+3.3, +4.9] | [+0.7, +8.9] | 974 / 580 | 1.2e-23 | 6e-23 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9593 | 71.5 | 84.2 | **-12.7** | [-13.6, -11.8] | [-18.8, -5.8] | 380 / 1601 | 1e-177 | 8.3e-177 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| ganador frente a configuración de producción | 12025 | **-50** | [-77, -27] | [-52, -49] | A/abl, B/abl, C/abl, D/abl | directo |
| RF-DETR-L + S frente a producción | 12027 | **-55** | [-79, -30] | [-56, -54] | A/main, B/main, C/main, D/main | directo |
| lector: B frente a S (mismo detector) | 12025 | **+5** | — | [+3, +6] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | 12026 | **-1** | [-5, +3] | [-1, -1] | A/main, B/main, C/main, D/main | directo |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | 12027 | **-0** | [-7, +6] | [-1, -0] | A/main, B/main, C/main, D/main | directo |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | 12025 | **-56** | [-86, -32] | [-57, -55] | A/main, B/main, C/main, D/main | directo |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | 12024 | **-40** | — | [-42, -39] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | 12024 | **-16** | — | [-17, -16] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| detector: YOLO26m frente a YOLO11m, receta común | 12025 | **+2** | — | [+2, +3] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| YOLO26m 1 clase + S frente a producción | 12025 | **+2** | [-7, +14] | [+2, +2] | A/main, B/main, C/main, D/main | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ganador frente a configuración de producción | +0.8 | +3.4 | +8.2 | +8.0 | +7.4 | +26.6 | +7.7 | +8.1 | +18.6 | +5.2 | +9.4 |
| RF-DETR-L + S frente a producción | +0.2 | +1.4 | +4.5 | +6.7 | +1.5 | +23.3 | +1.4 | +3.9 | +18.0 | +3.8 | +6.7 |
| lector: B frente a S (mismo detector) | +0.6 | +2.0 | +3.7 | +1.3 | +6.0 | +3.3 | +6.2 | +4.3 | +0.6 | +1.4 | +2.7 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +1.5 | +6.8 | +2.1 | +10.0 | +3.2 | +6.4 | +0.0 | +8.5 | +6.8 | +1.4 | +4.4 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.5 | +5.0 | +0.6 | +7.7 | +2.2 | +2.7 | -0.5 | +1.6 | +2.7 | +2.8 | +2.8 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.4 | +1.8 | +12.1 | -0.1 | +4.9 | +37.2 | +17.8 | +6.2 | +33.4 | +20.8 | +7.4 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -3.0 | -6.0 | +0.4 | -2.9 | +0.4 | +6.1 | -3.6 | +3.5 | +1.3 | -1.4 | +1.4 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +5.4 | +7.8 | +11.7 | +2.8 | +4.5 | +31.1 | +21.4 | +2.7 | +32.1 | +22.2 | +6.0 |
| detector: YOLO26m frente a YOLO11m, receta común | +3.7 | +20.3 | +4.4 | +0.8 | -0.5 | -0.4 | +1.7 | -2.3 | +6.8 | -7.1 | +0.3 |
| YOLO26m 1 clase + S frente a producción | -2.2 | -0.4 | -7.6 | +6.9 | -3.4 | -13.9 | -16.3 | -2.3 | -15.5 | -17.0 | -0.6 |
