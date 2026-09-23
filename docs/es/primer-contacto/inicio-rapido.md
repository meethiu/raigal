---
description: "Ejecute su primer escaneo, analice los hallazgos y aplique correcciones automáticas en 60 segundos."
icon: bolt
---

# Inicio Rápido

Comience a analizar su repositorio inmediatamente siguiendo tres sencillos pasos.

{% stepper %}
{% step %}
### Inicializar la configuración

Ejecute el asistente de inicio para generar un archivo de configuración calibrado:

```bash
raigal init .
```

Esto generará:
- `.raigal/config.yml`: Umbrales de calidad, activación de motores y rutas ignoradas.
- `.raigal/rules.yml`: Ajustes específicos de severidad para cada regla.
{% endstep %}

{% step %}
### Ejecutar el escaneo

Lance el comando de escaneo en la raíz de su proyecto:

```bash
raigal scan .
```

Raigal ejecutará en paralelo los motores de formateo, linting, calidad y AI slop, generando un informe con su puntuación de 0 a 100:

```text
╭───────────────────────────────────────────────────╮
│  Puntuación de Calidad Raigal: 94 / 100 [Healthy] │
╰───────────────────────────────────────────────────╯
Desglose por categorías:
  • AI Slop:       98/100 (1 hallazgo)
  • Lint & Format: 92/100 (3 hallazgos)
  • Seguridad:     100/100 (Limpio)
```
{% endstep %}

{% step %}
### Corregir problemas automáticamente

Aplique correcciones deterministas para formato, comentarios triviales e imports huérfanos:

```bash
raigal fix .
```

Para aquellos problemas que requieran razonamiento semántico avanzado, Raigal genera un plan de reparación aislado en un git worktree para Claude Code, Cursor u OpenCode mediante `raigal agent .`.
{% endstep %}
{% endstepper %}
