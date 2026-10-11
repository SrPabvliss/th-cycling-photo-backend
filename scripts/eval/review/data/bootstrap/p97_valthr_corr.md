# Bootstrap pareado del encadenado: `p97_valthr_corr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 75.2 | 81.9 | **-6.6** | [-7.3, -6.0] | [-9.7, -3.3] | 256 / 895 | 2.1e-83 | 4.2e-83 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 71.3 | 81.9 | **-10.6** | [-11.4, -9.7] | [-16.5, -3.5] | 404 / 1421 | 2.6e-132 | 7.7e-132 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 71.3 | 75.2 | **-3.9** | [-4.8, -3.1] | [-7.5, +0.8] | 739 / 1117 | 1.6e-18 | 1.6e-18 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 84.5 | 92.8 | **-8.4** | [-9.0, -7.8] | [-12.0, -4.3] | 84 / 891 | 6.3e-171 | 1.3e-170 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9629 | 79.4 | 92.8 | **-13.5** | [-14.3, -12.7] | [-20.9, -4.7] | 234 / 1530 | 4.5e-233 | 1.3e-232 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9629 | 79.4 | 84.5 | **-5.1** | [-5.9, -4.3] | [-9.7, +1.0] | 646 / 1135 | 2.7e-31 | 2.7e-31 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | 12044 | **+3** | [-2, +23] | [+3, +4] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | 12044 | **+64** | [+37, +89] | [+63, +64] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | 12044 | **+50** | [+25, +82] | [+49, +51] | E/main, F/main | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | -6.9 | -1.4 | -2.3 | -10.9 | -0.1 | -13.9 | -1.7 | -10.4 | -8.4 | -4.2 | -2.2 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | -1.2 | +1.1 | -10.5 | -6.0 | -0.7 | -24.6 | -13.6 | -3.5 | -17.6 | -8.5 | -4.0 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | +5.7 | +2.4 | -8.2 | +4.9 | -0.5 | -10.7 | -11.9 | +6.9 | -9.1 | -4.2 | -1.8 |
