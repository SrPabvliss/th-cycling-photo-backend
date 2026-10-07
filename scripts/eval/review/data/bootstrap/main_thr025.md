# Bootstrap pareado del encadenado: `main_thr025.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9593 | 82.9 | 69.4 | **+13.4** | [+12.5, +14.3] | [+6.7, +19.1] | 1726 / 436 | 8.7e-181 | 7e-180 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9593 | 80.3 | 69.4 | **+10.9** | [+10.0, +11.8] | [+3.8, +16.6] | 1615 / 569 | 2.5e-115 | 1.8e-114 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9593 | 82.9 | 80.3 | **+2.5** | [+2.0, +3.1] | [+1.6, +3.8] | 533 / 289 | 1.4e-17 | 4.1e-17 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9593 | 80.3 | 75.0 | **+5.3** | [+4.5, +6.1] | [+3.5, +6.8] | 940 / 432 | 1.3e-43 | 6.3e-43 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9593 | 66.5 | 63.3 | **+3.2** | [+2.6, +3.9] | [+1.9, +4.7] | 657 / 347 | 8.3e-23 | 3.3e-22 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 80.3 | 66.5 | **+13.8** | [+12.9, +14.7] | [+4.0, +21.6] | 1716 / 391 | 3e-197 | 2.7e-196 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9593 | 80.3 | 80.6 | **-0.2** | [-0.9, +0.4] | [-2.3, +1.3] | 514 / 537 | 0.5 | 0.5 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 80.6 | 66.5 | **+14.1** | [+13.2, +14.9] | [+5.8, +20.7] | 1676 / 328 | 2.7e-217 | 2.7e-216 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9593 | 66.5 | 60.2 | **+6.3** | [+5.5, +7.2] | [+2.6, +9.9] | 1128 / 522 | 2.6e-51 | 1.6e-50 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9593 | 66.5 | 69.4 | **-2.9** | [-3.9, -2.0] | [-5.9, +1.1] | 940 / 1219 | 2.1e-09 | 4.2e-09 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9593 | 94.7 | 84.2 | **+10.4** | [+9.7, +11.2] | [+2.8, +16.8] | 1244 / 243 | 6e-162 | 4.8e-161 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9593 | 94.7 | 84.2 | **+10.4** | [+9.7, +11.2] | [+2.8, +16.9] | 1244 / 243 | 6e-162 | 4.8e-161 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9593 | 94.7 | 94.7 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9593 | 94.7 | 94.7 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9593 | 77.4 | 77.4 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 94.7 | 77.4 | **+17.3** | [+16.5, +18.2] | [+5.2, +27.7] | 1835 / 174 | 0 | 0 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9593 | 94.7 | 95.0 | **-0.3** | [-0.8, +0.2] | [-2.2, +1.1] | 287 / 315 | 0.27 | 1 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9593 | 95.0 | 77.4 | **+17.6** | [+16.8, +18.4] | [+6.6, +26.9] | 1794 / 105 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9593 | 77.4 | 69.7 | **+7.7** | [+6.9, +8.4] | [+4.0, +12.0] | 1121 / 386 | 3.9e-83 | 2.3e-82 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9593 | 77.4 | 84.2 | **-6.9** | [-7.7, -6.1] | [-11.1, -2.0] | 509 / 1169 | 9e-60 | 4.5e-59 |

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
| ganador frente a configuración de producción | +2.2 | +6.0 | +8.1 | +11.5 | +7.4 | +27.8 | +7.7 | +10.1 | +19.7 | +8.0 | +9.3 |
| RF-DETR-L + S frente a producción | +1.5 | +3.8 | +4.4 | +10.3 | +1.4 | +24.6 | +1.4 | +5.8 | +19.1 | +6.6 | +6.6 |
| lector: B frente a S (mismo detector) | +0.7 | +2.2 | +3.7 | +1.3 | +6.1 | +3.3 | +6.2 | +4.3 | +0.6 | +1.4 | +2.7 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +1.7 | +7.2 | +2.2 | +11.2 | +3.2 | +6.3 | +0.0 | +9.3 | +7.0 | +1.9 | +4.4 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.6 | +6.0 | +0.6 | +9.8 | +2.7 | +3.7 | +0.0 | +1.2 | +3.1 | +2.4 | +3.1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.0 | +1.4 | +8.1 | -1.7 | +3.8 | +30.8 | +12.7 | +6.2 | +27.1 | +20.8 | +6.2 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -2.5 | -4.8 | -1.0 | -4.2 | +0.0 | +3.6 | -4.1 | +2.3 | +0.6 | +0.9 | +1.0 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +4.6 | +6.1 | +9.0 | +2.5 | +3.8 | +27.2 | +16.8 | +3.9 | +26.4 | +19.8 | +5.3 |
| detector: YOLO26m frente a YOLO11m, receta común | +4.6 | +21.1 | +5.9 | +4.5 | +0.1 | +5.5 | +5.0 | -2.3 | +11.6 | -5.2 | +1.0 |
| YOLO26m 1 clase + S frente a producción | -0.5 | +2.5 | -3.7 | +11.9 | -2.4 | -6.2 | -11.3 | -0.4 | -8.0 | -14.2 | +0.3 |
