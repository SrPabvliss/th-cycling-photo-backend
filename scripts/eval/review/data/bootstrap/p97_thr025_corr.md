# Bootstrap pareado del encadenado: `p97_thr025_corr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 83.0 | 83.0 | **+0.0** | [-0.6, +0.6] | [-0.9, +1.2] | 375 / 374 | 1 | 1 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 74.2 | 83.0 | **-8.8** | [-9.6, -8.0] | [-13.9, -2.6] | 386 / 1229 | 2.4e-102 | 4.8e-102 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 74.2 | 83.0 | **-8.8** | [-9.6, -8.0] | [-13.4, -3.1] | 365 / 1209 | 1.6e-105 | 4.8e-105 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 96.0 | 94.7 | **+1.3** | [+0.9, +1.7] | [+0.5, +2.6] | 247 / 118 | 1.3e-11 | 1.3e-11 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 83.1 | 94.7 | **-11.6** | [-12.4, -10.9] | [-18.0, -4.0] | 167 / 1284 | 1.2e-213 | 2.4e-213 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 83.1 | 96.0 | **-12.9** | [-13.7, -12.2] | [-19.2, -5.6] | 99 / 1345 | 9.6e-280 | 2.9e-279 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | 12044 | **+3** | [-2, +23] | [+3, +4] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | 12044 | **+64** | [+37, +89] | [+63, +64] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | 12044 | **+50** | [+25, +82] | [+49, +51] | E/main, F/main | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | +1.4 | +2.7 | -0.5 | +2.7 | +1.6 | -0.9 | +2.9 | -4.2 | -1.0 | -0.9 | -2.1 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | -0.7 | -0.5 | -5.8 | -6.0 | +0.5 | -20.9 | -10.7 | -0.8 | -15.3 | -9.4 | -3.2 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | -2.1 | -3.3 | -5.3 | -8.7 | -1.1 | -19.9 | -13.6 | +3.5 | -14.3 | -8.5 | -1.1 |
