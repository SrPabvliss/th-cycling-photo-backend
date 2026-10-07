# Bootstrap pareado del encadenado: `p97_valthr.csv` (10000 remuestreos, semilla 42)

Fotos con dorsal legible, pareadas por foto. Diferencia en puntos porcentuales (A − B). IC 95 % por foto (percentil) y por evento (bootstrap de los 11 eventos como conglomerados). McNemar exacto sobre fotos discordantes; Holm sobre las comparaciones de la tabla.

## Lectura exacta

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9593 | 75.2 | 81.8 | **-6.5** | [-7.2, -5.9] | [-9.6, -3.0] | 256 / 884 | 2.7e-81 | 5.3e-81 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9593 | 71.3 | 81.8 | **-10.4** | [-11.3, -9.6] | [-16.3, -3.3] | 404 / 1404 | 4.7e-129 | 1.4e-128 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9593 | 71.3 | 75.2 | **-3.9** | [-4.8, -3.0] | [-7.4, +1.0] | 738 / 1110 | 4.7e-18 | 4.7e-18 |

## Placa encontrada

| Comparación | A | B | n | A % | B % | dif | IC foto | IC evento | discordantes A>B / B>A | p McNemar | p Holm |
|---|---|---|---:|---:|---:|---:|---|---|---|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | `rfdetr_l_896_c5+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9593 | 84.5 | 92.8 | **-8.3** | [-9.0, -7.7] | [-12.0, -4.2] | 84 / 884 | 4.3e-169 | 8.5e-169 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896+svtrv2_b` | 9593 | 79.4 | 92.8 | **-13.4** | [-14.3, -12.6] | [-20.8, -4.7] | 234 / 1522 | 3.7e-231 | 1.1e-230 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | `yolo26m_c5_1024+svtrv2_b` | `rfdetr_l_896_c5+svtrv2_b` | 9593 | 79.4 | 84.5 | **-5.1** | [-5.9, -4.2] | [-9.8, +1.2] | 644 / 1132 | 2.9e-31 | 2.9e-31 |

## Tiempo total por foto (ms), pareado en el mismo host, sin peticiones frías

| Comparación | n | mediana de A − B | [p25, p75] | IC 95 % de la mediana | hosts | cómo |
|---|---:|---:|---|---|---|---|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | 12041 | **+3** | [-2, +23] | [+3, +4] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | 12041 | **+64** | [+37, +89] | [+63, +64] | E/main, F/main | directo |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | 12041 | **+50** | [+25, +82] | [+49, +51] | E/main, F/main | directo |

## Diferencia de lectura exacta por evento (puntos)

| Comparación | 2da. Válida Copa Bike Parks. Coto Bike Park | 3ra. Válida Copa Bike Parks, Pamba | DOWNHILL CEVALLOS | Downhill El Bosque Tercera Edición | Downhill Lumbisi 2026 | Downhill Teleférico | ENDURO RETO PIMAMPIRO 2026 | Ecuador OPEN | OPEN SHIMANO | Sigchos Fest | The Lost Line - Freestyle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RF-DETR-L: 5 clases frente a 1 (mismo lector B) | -6.9 | -1.4 | -2.0 | -10.8 | +0.0 | -13.8 | -1.4 | -10.5 | -8.4 | -4.2 | -2.2 |
| YOLO26m 5 clases frente a RF-DETR-L 1 clase (B) | -1.2 | +1.1 | -9.9 | -5.9 | -0.4 | -24.5 | -13.5 | -3.5 | -17.5 | -8.5 | -3.9 |
| YOLO26m 5 clases frente a RF-DETR-L 5 clases (B) | +5.7 | +2.5 | -7.9 | +4.9 | -0.4 | -10.7 | -12.0 | +7.0 | -9.2 | -4.2 | -1.7 |
