---
description: "Cómo Raigal calcula la puntuación 0-100, penalizaciones ponderadas y normalización ajustada por densidad."
icon: gauge
---

# Motor de Puntuación

Raigal evalúa bases de código en una escala continua de **0 a 100**, donde 100 representa un código de calidad impecable.

## Rangos de Calidad

| Rango de Puntuación | Estado | Interpretación | Código de Salida en CI |
|---|---|---|---|
| **90 – 100** | **Healthy** | Arquitectura limpia, sin defectos críticos, cero código basura. | `0` (Aprobado) |
| **75 – 89** | **Warning** | Formato mejorable, comentarios redundantes o deuda leve. | `0` (Aprobado salvo límite estricto) |
| **0 – 74** | **Failing** | Problemas estructurales, alta densidad de slop, alertas de seguridad. | `1` (Bloqueo en CI) |

## Fórmula Calibrada por Densidad

A diferencia de los linters tradicionales que restan puntos fijos por cada aviso, Raigal implementa un escalado logarítmico **ponderado por densidad de código**:

$$D = \frac{\sum (\text{peso}_i \times \text{severidad}_i)}{\text{KLOC}}$$

Donde:
- $\text{KLOC}$ representa el total de líneas de código físico dividido entre 1.000.
- Las reglas poseen multiplicadores de peso ajustables (por ejemplo, las alertas de Seguridad tienen un peso muy elevado, mientras que los comentarios triviales disminuyen su impacto suavemente).
- Los archivos con menos de 100 líneas utilizan denominadores suavizados para no penalizar desproporcionadamente commits reducidos.

## Ponderaciones por Categoría

1. **Seguridad y Vulnerabilidades (Multiplicador 1.5x)**: Fugas de credenciales, inyecciones SQL, llamadas inseguras.
2. **Antipatrones de AI Slop (Multiplicador 1.2x)**: Verificaciones redundantes de nulos, fallbacks innecesarios, comentarios repetitivos.
3. **Arquitectura y Fronteras (Multiplicador 1.0x)**: Importaciones circulares, referencias ilegales entre módulos.
4. **Calidad de Código y Complejidad (Multiplicador 0.9x)**: Complejidad ciclomática excesiva, ramas de código muerto.
5. **Formato y Estilo (Multiplicador 0.6x)**: Sangrado y discrepancias en espaciado.
