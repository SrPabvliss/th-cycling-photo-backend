# Bootstrap pareado del encadenado: `opt_valthr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 82.2 | 70.0 | **+12.2** | [+11.3, +13.1] | [+5.4, +17.8] | 1650 / 474 | 1.2e-151 | 1.3e-150 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 79.7 | 70.0 | **+9.8** | [+8.9, +10.7] | [+2.5, +15.4] | 1512 / 572 | 2.1e-97 | 1.9e-96 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 82.2 | 79.7 | **+2.5** | [+1.9, +3.0] | [+1.1, +3.9] | 531 / 295 | 1.8e-16 | 5.5e-16 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 79.7 | 74.7 | **+5.0** | [+4.3, +5.8] | [+3.3, +6.3] | 907 / 424 | 1e-40 | 7e-40 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 64.7 | 61.6 | **+3.0** | [+2.4, +3.7] | [+2.1, +4.2] | 595 / 303 | 1.1e-22 | 4.6e-22 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 79.7 | 64.7 | **+15.1** | [+14.2, +15.9] | [+4.7, +23.4] | 1818 / 369 | 3e-229 | 3.9e-228 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 79.7 | 78.8 | **+1.0** | [+0.3, +1.7] | [-1.6, +3.0] | 622 / 529 | 0.0067 | 0.0067 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 78.8 | 64.7 | **+14.1** | [+13.2, +15.0] | [+5.7, +20.8] | 1720 / 364 | 4.5e-210 | 5.4e-209 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 64.7 | 59.8 | **+4.9** | [+4.1, +5.7] | [+1.2, +8.7] | 1048 / 580 | 2.2e-31 | 1.3e-30 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 64.7 | 70.0 | **-5.3** | [-6.2, -4.4] | [-8.7, -1.0] | 837 / 1346 | 9e-28 | 4.5e-27 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 75.9 | 82.2 | **-6.3** | [-7.0, -5.6] | [-9.0, -3.5] | 249 / 856 | 2.2e-78 | 1.7e-77 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 72.8 | 82.2 | **-9.4** | [-10.2, -8.6] | [-14.9, -2.9] | 377 / 1283 | 2.3e-115 | 2.3e-114 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 72.8 | 75.9 | **-3.1** | [-3.9, -2.3] | [-6.3, +1.2] | 691 / 990 | 3.2e-13 | 6.3e-13 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| ganador frente a configuración de producción | `rfdetr_l_896+svtrv2_b` | `yolo+parseq` | 9629 | 93.1 | 84.1 | **+9.0** | [+8.3, +9.8] | [+1.3, +15.2] | 1171 / 302 | 8.8e-121 | 7.9e-120 |
| RF-DETR-L + S frente a producción | `rfdetr_l_896+svtrv2_s` | `yolo+parseq` | 9629 | 93.1 | 84.1 | **+9.0** | [+8.3, +9.8] | [+1.3, +15.3] | 1171 / 302 | 8.8e-121 | 7.9e-120 |
| lector: B frente a S (mismo detector) | `rfdetr_l_896+svtrv2_b` | `rfdetr_l_896+svtrv2_s` | 9629 | 93.1 | 93.1 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | `rfdetr_l_896+svtrv2_s` | `rfdetr_l_896+parseq_v2` | 9629 | 93.1 | 93.1 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | `yolo26m_1024+svtrv2_s` | `yolo26m_1024+parseq_v2` | 9629 | 74.0 | 74.0 | **+0.0** | [+0.0, +0.0] | [+0.0, +0.0] | 0 / 0 | 1 | 1 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | `rfdetr_l_896+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 93.1 | 74.0 | **+19.1** | [+18.3, +20.0] | [+6.6, +29.9] | 2033 / 190 | 0 | 0 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | `rfdetr_l_896+svtrv2_s` | `dfine_l_640+svtrv2_s` | 9629 | 93.1 | 92.2 | **+0.9** | [+0.3, +1.5] | [-2.0, +3.3] | 438 / 351 | 0.0022 | 0.0087 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | `dfine_l_640+svtrv2_s` | `yolo26m_1024+svtrv2_s` | 9629 | 92.2 | 74.0 | **+18.2** | [+17.4, +19.1] | [+7.6, +26.9] | 1935 / 179 | 0 | 0 |
| detector: YOLO26m frente a YOLO11m, receta común | `yolo26m_1024+svtrv2_s` | `yolo11m_1024_fx+svtrv2_s` | 9629 | 74.0 | 68.7 | **+5.3** | [+4.5, +6.1] | [+1.3, +9.9] | 1026 / 515 | 2.7e-39 | 1.6e-38 |
| YOLO26m 1 clase + S frente a producción | `yolo26m_1024+svtrv2_s` | `yolo+parseq` | 9629 | 74.0 | 84.1 | **-10.1** | [-11.0, -9.2] | [-14.7, -5.0] | 434 / 1408 | 1.2e-119 | 8.1e-119 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 85.3 | 93.1 | **-7.8** | [-8.4, -7.2] | [-11.3, -4.1] | 81 / 834 | 2.7e-158 | 2.7e-157 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 80.8 | 93.1 | **-12.3** | [-13.1, -11.5] | [-19.1, -4.3] | 220 / 1403 | 9e-211 | 1e-209 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 80.8 | 85.3 | **-4.5** | [-5.3, -3.6] | [-8.5, +1.0] | 595 / 1025 | 8e-27 | 4e-26 |

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
| ganador frente a configuración de producción | +1.3 | +4.6 | +7.3 | +7.7 | +6.3 | +26.3 | +5.5 | +3.8 | +19.1 | +5.6 | +10.1 |
| RF-DETR-L + S frente a producción | +1.0 | +2.7 | +2.7 | +6.7 | +0.1 | +22.5 | +1.2 | +1.5 | +19.4 | +2.3 | +6.9 |
| lector: B frente a S (mismo detector) | +0.3 | +1.9 | +4.6 | +1.0 | +6.2 | +3.8 | +4.3 | +2.3 | -0.2 | +3.3 | +3.2 |
| lector: SVTRv2-S frente a PARSeq (RF-DETR-L) | +2.1 | +7.7 | +0.4 | +8.4 | +4.6 | +6.0 | +1.7 | +6.5 | +6.7 | +0.9 | +4.7 |
| lector: SVTRv2-S frente a PARSeq (YOLO26m) | +0.6 | +6.1 | +2.2 | +6.6 | +3.6 | +2.1 | +0.0 | +1.5 | +2.6 | +4.2 | +4.4 |
| detector: RF-DETR-L frente a YOLO26m (mismo lector) | +2.6 | +1.6 | +8.4 | +1.5 | +5.5 | +33.3 | +15.0 | +4.6 | +29.3 | +19.2 | +5.1 |
| detector: RF-DETR-L frente a D-FINE-L (mismo lector) | -2.5 | -4.3 | -0.8 | -3.1 | +0.8 | +6.0 | -1.4 | +3.8 | +2.9 | -2.8 | +1.6 |
| detector: D-FINE-L frente a YOLO26m (mismo lector) | +5.2 | +6.0 | +9.2 | +4.6 | +4.7 | +27.3 | +16.5 | +0.8 | +26.4 | +22.1 | +3.4 |
| detector: YOLO26m frente a YOLO11m, receta común | +3.7 | +22.3 | +5.3 | +0.4 | -1.2 | +1.9 | +1.7 | -0.8 | +10.0 | -5.6 | +1.4 |
| YOLO26m 1 clase + S frente a producción | -1.6 | +1.1 | -5.7 | +5.2 | -5.4 | -10.8 | -13.8 | -3.1 | -9.9 | -16.9 | +1.8 |
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | -5.9 | -3.4 | -2.4 | -6.9 | -1.9 | -13.3 | -1.4 | -7.7 | -7.8 | -5.2 | -2.7 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | -1.2 | +0.3 | -10.3 | -3.8 | -1.6 | -22.9 | -9.1 | +0.0 | -15.4 | -7.5 | -3.5 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | +4.7 | +3.7 | -7.9 | +3.1 | +0.3 | -9.5 | -7.6 | +7.7 | -7.6 | -2.3 | -0.9 |
