# Bootstrap pareado del encadenado: `main_thr025_corr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 83.0 | 69.5 | **+13.5** | [+12.6, +14.4] | [+6.9, +19.3] | 1743 / 440 | 1.1e-182 | 9.2e-182 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 80.3 | 69.5 | **+10.9** | [+10.0, +11.8] | [+3.9, +16.4] | 1625 / 575 | 2.5e-115 | 1.7e-114 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 83.0 | 80.3 | **+2.6** | [+2.0, +3.2] | [+1.6, +3.9] | 545 / 292 | 1.7e-18 | 5e-18 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 80.3 | 75.0 | **+5.3** | [+4.5, +6.0] | [+3.5, +6.9] | 949 / 439 | 1.9e-43 | 9.3e-43 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 66.5 | 63.3 | **+3.3** | [+2.6, +3.9] | [+2.0, +4.8] | 665 / 349 | 2e-23 | 7.9e-23 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 80.3 | 66.5 | **+13.8** | [+12.9, +14.7] | [+3.9, +21.7] | 1723 / 393 | 7.2e-198 | 6.5e-197 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 80.3 | 80.5 | **-0.2** | [-0.8, +0.5] | [-2.2, +1.4] | 517 / 536 | 0.58 | 0.58 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 80.5 | 66.5 | **+14.0** | [+13.2, +14.9] | [+5.8, +20.8] | 1682 / 333 | 3.2e-216 | 3.2e-215 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 66.5 | 60.2 | **+6.3** | [+5.5, +7.1] | [+2.7, +9.9] | 1136 / 528 | 3.3e-51 | 2e-50 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 66.5 | 69.5 | **-2.9** | [-3.9, -2.0] | [-5.9, +1.1] | 946 / 1226 | 2e-09 | 4.1e-09 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 94.7 | 84.3 | **+10.4** | [+9.7, +11.2] | [+2.8, +16.9] | 1246 / 243 | 2.1e-162 | 1.7e-161 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 94.7 | 84.3 | **+10.4** | [+9.7, +11.2] | [+2.8, +16.9] | 1246 / 243 | 2.1e-162 | 1.7e-161 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 94.7 | 94.7 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 94.7 | 94.7 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 77.4 | 77.4 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 94.7 | 77.4 | **+17.3** | [+16.5, +18.1] | [+5.2, +27.8] | 1841 / 174 | 0 | 0 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 94.7 | 95.0 | **-0.3** | [-0.8, +0.2] | [-2.2, +1.2] | 288 / 315 | 0.29 | 1 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 95.0 | 77.4 | **+17.6** | [+16.8, +18.4] | [+6.7, +26.7] | 1800 / 106 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 77.4 | 69.7 | **+7.7** | [+6.9, +8.4] | [+4.0, +11.8] | 1126 / 389 | 4e-83 | 2.4e-82 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 77.4 | 84.3 | **-6.9** | [-7.7, -6.1] | [-11.0, -2.0] | 510 / 1174 | 2.8e-60 | 1.4e-59 |

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
| ganador frente a configuración de producción | +2.2 | +6.1 | +8.5 | +11.5 | +7.4 | +28.0 | +7.9 | +9.2 | +19.7 | +8.0 | +9.5 |
| RF-DETR-L + S frente a producción | +1.5 | +4.1 | +4.7 | +10.4 | +1.2 | +24.6 | +1.2 | +5.0 | +19.1 | +6.1 | +6.5 |
| lector: B frente a S (mismo detector) | +0.7 | +2.0 | +3.8 | +1.1 | +6.2 | +3.4 | +6.7 | +4.2 | +0.6 | +1.9 | +2.9 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +1.6 | +7.5 | +2.4 | +11.5 | +3.1 | +6.3 | +0.0 | +8.8 | +7.0 | +1.4 | +4.3 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.7 | +6.1 | +1.2 | +9.9 | +2.8 | +3.7 | -0.2 | +0.8 | +3.1 | +2.3 | +3.1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.0 | +1.4 | +8.1 | -1.5 | +3.9 | +30.7 | +12.6 | +5.8 | +27.1 | +20.7 | +6.3 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -2.4 | -4.8 | -0.7 | -4.2 | +0.0 | +3.7 | -4.1 | +2.3 | +0.6 | +0.9 | +0.9 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +4.5 | +6.1 | +8.8 | +2.7 | +3.9 | +27.0 | +16.7 | +3.5 | +26.5 | +19.7 | +5.4 |
| detector: YOLO26m frente a YOLO11m, receta común | +4.7 | +21.2 | +6.1 | +4.3 | +0.0 | +5.5 | +5.3 | -2.3 | +11.4 | -5.2 | +1.0 |
| YOLO26m 1 clase + S frente a producción | -0.5 | +2.7 | -3.4 | +11.9 | -2.7 | -6.1 | -11.5 | -0.8 | -8.0 | -14.6 | +0.3 |
