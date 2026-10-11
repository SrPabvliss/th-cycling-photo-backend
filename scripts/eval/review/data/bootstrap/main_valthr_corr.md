# Bootstrap pareado del encadenado: `main_valthr_corr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 81.9 | 69.5 | **+12.4** | [+11.5, +13.3] | [+5.7, +18.0] | 1683 / 487 | 2.1e-153 | 1.7e-152 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 79.2 | 69.5 | **+9.8** | [+8.9, +10.7] | [+2.8, +15.3] | 1565 / 621 | 2e-93 | 1.4e-92 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 81.9 | 79.2 | **+2.6** | [+2.0, +3.2] | [+1.6, +3.9] | 529 / 277 | 4.9e-19 | 2e-18 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 79.2 | 74.2 | **+5.1** | [+4.4, +5.8] | [+3.3, +6.5] | 920 / 429 | 1.7e-41 | 8.4e-41 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 62.1 | 59.4 | **+2.7** | [+2.1, +3.3] | [+1.7, +3.9] | 583 / 322 | 3.2e-18 | 9.7e-18 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 79.2 | 62.1 | **+17.2** | [+16.2, +18.1] | [+5.2, +26.6] | 2023 / 370 | 8.4e-275 | 8.4e-274 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 79.2 | 78.7 | **+0.5** | [-0.2, +1.2] | [-2.0, +2.8] | 617 / 566 | 0.15 | 0.15 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 78.7 | 62.1 | **+16.6** | [+15.7, +17.6] | [+6.8, +24.7] | 1948 / 346 | 5.6e-270 | 5.1e-269 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 62.1 | 58.6 | **+3.5** | [+2.6, +4.3] | [+0.3, +7.3] | 998 / 665 | 3.1e-16 | 6.3e-16 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 62.1 | 69.5 | **-7.4** | [-8.3, -6.4] | [-11.7, -1.8] | 799 / 1508 | 6e-50 | 3.6e-49 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 92.8 | 84.3 | **+8.6** | [+7.8, +9.3] | [+0.7, +14.9] | 1168 / 344 | 6.6e-105 | 4.6e-104 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 92.8 | 84.3 | **+8.6** | [+7.8, +9.3] | [+0.7, +14.8] | 1168 / 344 | 6.6e-105 | 4.6e-104 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 92.8 | 92.8 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 92.8 | 92.8 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 71.5 | 71.5 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 92.8 | 71.5 | **+21.3** | [+20.4, +22.3] | [+6.8, +33.6] | 2271 / 217 | 0 | 0 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 92.8 | 92.1 | **+0.7** | [+0.1, +1.3] | [-2.3, +3.1] | 447 / 378 | 0.018 | 0.071 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 92.1 | 71.5 | **+20.6** | [+19.7, +21.5] | [+8.2, +30.8] | 2163 / 178 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 71.5 | 67.4 | **+4.1** | [+3.3, +4.9] | [+0.7, +8.7] | 975 / 583 | 2.3e-23 | 1.2e-22 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 71.5 | 84.3 | **-12.8** | [-13.7, -11.9] | [-18.7, -5.7] | 381 / 1611 | 2.2e-179 | 1.8e-178 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| ganador frente a configuración de producción | 12027 | **-50** | [-77, -27] | [-52, -49] | A/abl, B/abl, C/abl, D/abl | directo |
| RF-DETR-L + S frente a producción | 12029 | **-55** | [-79, -30] | [-56, -54] | A/main, B/main, C/main, D/main | directo |
| lector: B frente a S (mismo detector) | 12027 | **+5** | — | [+3, +6] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | 12028 | **-1** | [-5, +3] | [-1, -1] | A/main, B/main, C/main, D/main | directo |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | 12029 | **-0** | [-7, +6] | [-1, -0] | A/main, B/main, C/main, D/main | directo |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | 12027 | **-56** | [-86, -32] | [-57, -55] | A/main, B/main, C/main, D/main | directo |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | 12026 | **-40** | — | [-42, -39] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | 12026 | **-16** | — | [-17, -16] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| detector: YOLO26m frente a YOLO11m, receta común | 12027 | **+2** | — | [+2, +3] | A/abl, A/main, B/abl, B/main, C/abl, C/main, D/abl, D/main | vía producción (A − prod) − (B − prod) |
| YOLO26m 1 clase + S frente a producción | 12027 | **+2** | [-7, +14] | [+2, +2] | A/main, B/main, C/main, D/main | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ganador frente a configuración de producción | +0.8 | +3.5 | +8.6 | +8.0 | +7.4 | +26.8 | +7.9 | +7.3 | +18.7 | +5.2 | +9.6 |
| RF-DETR-L + S frente a producción | +0.2 | +1.6 | +4.8 | +6.9 | +1.3 | +23.3 | +1.2 | +3.1 | +18.0 | +3.3 | +6.7 |
| lector: B frente a S (mismo detector) | +0.6 | +1.9 | +3.8 | +1.1 | +6.1 | +3.5 | +6.7 | +4.2 | +0.6 | +1.9 | +2.9 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +1.4 | +7.1 | +2.3 | +10.2 | +3.1 | +6.4 | +0.0 | +8.1 | +6.9 | +0.9 | +4.3 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.6 | +5.2 | +1.2 | +7.8 | +2.3 | +2.7 | -0.7 | +1.2 | +2.7 | +2.8 | +2.8 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.4 | +1.8 | +12.2 | +0.0 | +5.0 | +37.2 | +17.7 | +5.8 | +33.5 | +20.7 | +7.4 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -2.8 | -6.0 | +0.6 | -2.9 | +0.4 | +6.2 | -3.6 | +3.5 | +1.3 | -1.4 | +1.3 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +5.3 | +7.7 | +11.6 | +2.9 | +4.6 | +31.0 | +21.2 | +2.3 | +32.1 | +22.1 | +6.1 |
| detector: YOLO26m frente a YOLO11m, receta común | +3.8 | +20.4 | +4.5 | +0.7 | -0.7 | -0.4 | +1.7 | -2.3 | +6.7 | -7.0 | +0.3 |
| YOLO26m 1 clase + S frente a producción | -2.2 | -0.1 | -7.4 | +6.9 | -3.6 | -13.9 | -16.5 | -2.7 | -15.4 | -17.4 | -0.7 |
