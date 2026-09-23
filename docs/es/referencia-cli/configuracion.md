---
description: "Configuración de reglas del proyecto, umbrales de puntuación y parámetros mediante .raigal/config.yml."
icon: gear
---

# Configuración

Raigal utiliza un archivo de configuración tipado situado en `.raigal/config.yml` en la raíz del repositorio.

## Configuración Mínima

```yaml
version: 1

scoring:
  threshold: 85
  fail_under: 80

engines:
  format: true
  lint: true
  quality: true
  ai_slop: true
  security: true
  architecture: true

ignore:
  - "dist/**"
  - "node_modules/**"
  - "**/*.min.js"
```

## Referencia de Parámetros

### `scoring`

- `threshold` (numérico, por defecto: 80): Puntuación objetivo recomendada para el repositorio.
- `fail_under` (numérico, por defecto: 80): Puntuación mínima exigida en CI (`raigal ci`). Cualquier valor inferior provocará un código de salida `1`.

### `engines`

Activa o desactiva módulos de diagnóstico individuales:
- `ai_slop`: Detecta patrones repetitivos, verificaciones defensivas innecesarias y comentarios obvios generados por IA.
- `security`: Detecta secretos expuestos, claves privadas y funciones vulnerables.
- `lint`: Análisis estático ultrarrápido mediante Oxlint y Ruff.
- `format`: Comprobación de formato mediante Biome, Gofmt y Ruff.
- `quality`: Detección de código muerto (Knip) y control de complejidad ciclomática.
- `architecture`: Verificación de límites entre capas e imports no permitidos.

### `telemetry`

Raigal respeta la privacidad de los desarrolladores:
```yaml
telemetry:
  enabled: false
```
*(Los eventos de telemetría son estrictamente métricas anónimas. Nunca se transmiten rutas de archivos ni fragmentos de código).*
