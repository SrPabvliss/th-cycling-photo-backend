# Bootstrap pareado del encadenado: `opt_thr025.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 83.4 | 70.0 | **+13.4** | [+12.5, +14.3] | [+6.7, +19.1] | 1712 / 421 | 6.6e-184 | 8.6e-183 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 80.8 | 70.0 | **+10.9** | [+10.0, +11.8] | [+3.5, +16.6] | 1570 / 523 | 5.7e-121 | 5.7e-120 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 83.4 | 80.8 | **+2.5** | [+1.9, +3.1] | [+1.2, +4.0] | 549 / 305 | 5.7e-17 | 2.3e-16 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 80.8 | 75.6 | **+5.3** | [+4.5, +6.0] | [+3.5, +6.6] | 935 / 428 | 9.5e-44 | 5.7e-43 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 68.9 | 65.5 | **+3.4** | [+2.8, +4.0] | [+2.2, +4.6] | 663 / 337 | 3.4e-25 | 1.7e-24 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 80.8 | 68.9 | **+12.0** | [+11.1, +12.8] | [+3.6, +18.8] | 1521 / 368 | 4.9e-166 | 5.4e-165 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 80.8 | 80.6 | **+0.3** | [-0.4, +0.9] | [-1.8, +1.8] | 523 / 497 | 0.43 | 0.87 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 80.6 | 68.9 | **+11.7** | [+10.9, +12.6] | [+4.8, +17.2] | 1461 / 334 | 1e-167 | 1.2e-166 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 68.9 | 61.7 | **+7.1** | [+6.4, +8.0] | [+3.0, +10.8] | 1156 / 469 | 5.9e-67 | 4.1e-66 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 68.9 | 70.0 | **-1.1** | [-2.0, -0.2] | [-3.2, +1.7] | 979 / 1085 | 0.021 | 0.062 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 83.5 | 83.4 | **+0.1** | [-0.5, +0.6] | [-0.9, +1.4] | 363 / 356 | 0.82 | 0.87 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 75.4 | 83.4 | **-7.9** | [-8.7, -7.2] | [-12.6, -2.3] | 352 / 1116 | 1.3e-92 | 1e-91 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 75.4 | 83.5 | **-8.0** | [-8.8, -7.3] | [-12.3, -2.7] | 330 / 1101 | 4.8e-97 | 4.3e-96 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 95.0 | 84.1 | **+10.9** | [+10.2, +11.6] | [+3.3, +17.2] | 1249 / 200 | 1.7e-185 | 1.6e-184 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 95.0 | 84.1 | **+10.9** | [+10.2, +11.7] | [+3.4, +17.3] | 1249 / 200 | 1.7e-185 | 1.6e-184 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 95.0 | 95.0 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 95.0 | 95.0 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 79.6 | 79.6 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 95.0 | 79.6 | **+15.4** | [+14.6, +16.2] | [+5.0, +24.4] | 1625 / 142 | 3.7e-319 | 4.4e-318 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 95.0 | 95.0 | **-0.0** | [-0.5, +0.5] | [-1.9, +1.4] | 295 / 298 | 0.93 | 1 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 95.0 | 79.6 | **+15.4** | [+14.7, +16.2] | [+6.0, +23.1] | 1592 / 106 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 79.6 | 71.1 | **+8.5** | [+7.8, +9.3] | [+4.2, +12.6] | 1168 / 348 | 1.5e-103 | 1.1e-102 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 79.6 | 84.1 | **-4.5** | [-5.3, -3.7] | [-7.3, -1.3] | 564 / 998 | 2.8e-28 | 1.7e-27 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 96.3 | 95.0 | **+1.3** | [+0.9, +1.7] | [+0.4, +2.8] | 233 / 107 | 7e-12 | 3.5e-11 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 84.4 | 95.0 | **-10.6** | [-11.3, -9.9] | [-16.2, -3.7] | 147 / 1165 | 6.5e-197 | 6.5e-196 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 84.4 | 96.3 | **-11.9** | [-12.6, -11.2] | [-17.3, -5.4] | 82 / 1226 | 2.2e-262 | 2.4e-261 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| ganador frente a configuración de producción | 12037 | **+19** | [+16, +24] | [+19, +20] | A/opt, B/opt, C/opt, D/opt | directo |
| RF-DETR-L + S frente a producción | 12037 | **+16** | [+13, +20] | [+16, +16] | A/opt, B/opt, C/opt, D/opt | directo |
| lector: B frente a S (mismo detector) | 12037 | **+4** | [+1, +6] | [+4, +4] | A/opt, B/opt, C/opt, D/opt | directo |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | 12037 | **-1** | [-3, +1] | [-1, -1] | A/opt, B/opt, C/opt, D/opt | directo |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | 12036 | **-1** | [-3, +1] | [-1, -1] | A/opt, B/opt, C/opt, D/opt | directo |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | 12037 | **+16** | [+14, +21] | [+16, +16] | A/opt, B/opt, C/opt, D/opt | directo |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | 12037 | **-14** | [-18, -11] | [-14, -14] | A/opt, B/opt, C/opt, D/opt | directo |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | 12037 | **+30** | [+28, +39] | [+30, +31] | A/opt, B/opt, C/opt, D/opt | directo |
| detector: YOLO26m frente a YOLO11m, receta común | 12037 | **+0** | [-2, +4] | [+0, +0] | A/opt, B/opt, C/opt, D/opt | directo |
| YOLO26m 1 clase + S frente a producción | 12037 | **-0** | [-4, +2] | [-0, -0] | A/opt, B/opt, C/opt, D/opt | directo |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | 12036 | **+1** | [-1, +17] | [+1, +2] | A/opt, B/opt, C/opt, D/opt | directo |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | 12037 | **-14** | [-18, -12] | [-15, -14] | A/opt, B/opt, C/opt, D/opt | directo |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | 12036 | **-16** | [-34, -13] | [-17, -16] | A/opt, B/opt, C/opt, D/opt | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ganador frente a configuración de producción | +3.1 | +7.2 | +7.3 | +11.1 | +6.3 | +27.9 | +6.2 | +3.8 | +20.2 | +8.9 | +9.8 |
| RF-DETR-L + S frente a producción | +2.8 | +5.0 | +2.7 | +10.1 | +0.1 | +23.9 | +1.4 | +1.5 | +20.4 | +5.2 | +6.7 |
| lector: B frente a S (mismo detector) | +0.3 | +2.2 | +4.6 | +1.0 | +6.2 | +4.0 | +4.8 | +2.3 | -0.2 | +3.8 | +3.1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +2.4 | +8.6 | +0.4 | +9.5 | +4.4 | +6.1 | +1.7 | +6.5 | +6.9 | +1.4 | +4.7 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.5 | +6.7 | +2.3 | +7.6 | +3.5 | +3.2 | -1.0 | +1.5 | +3.1 | +4.2 | +4.4 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.4 | +1.9 | +5.0 | +0.6 | +4.2 | +26.9 | +9.8 | +2.7 | +23.8 | +17.8 | +4.3 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -1.5 | -3.4 | -1.8 | -4.8 | +0.5 | +3.9 | -1.4 | +1.5 | +1.9 | -1.4 | +1.2 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +4.0 | +5.3 | +6.8 | +5.3 | +3.6 | +23.0 | +11.2 | +1.2 | +21.9 | +19.2 | +3.1 |
| detector: YOLO26m frente a YOLO11m, receta común | +4.3 | +22.3 | +6.8 | +2.9 | -1.1 | +7.9 | +4.1 | +0.4 | +13.2 | -1.4 | +1.3 |
| YOLO26m 1 clase + S frente a producción | +0.4 | +3.1 | -2.3 | +9.5 | -4.0 | -3.0 | -8.4 | -1.2 | -3.5 | -12.7 | +2.4 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | +1.9 | +1.0 | +0.6 | +4.5 | +0.0 | -1.0 | +1.0 | +0.0 | -0.9 | +0.0 | -2.3 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | -0.9 | -0.5 | -5.8 | -4.9 | -1.2 | -19.1 | -7.6 | +2.7 | -14.1 | -6.6 | -2.7 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | -2.8 | -1.5 | -6.4 | -9.4 | -1.2 | -18.1 | -8.6 | +2.7 | -13.2 | -6.6 | -0.3 |
