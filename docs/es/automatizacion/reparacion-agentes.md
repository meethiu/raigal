---
description: "Ejecute sesiones de reparación automatizadas en git worktrees con agentes de IA locales sin riesgo para su rama principal."
icon: robot
---

# Reparación Automatizada con Agentes

Cuando el análisis estático identifica problemas que requieren refactorización arquitectónica o modificaciones semánticas, `raigal agent` traslada la tarea a su herramienta local de IA en un **git worktree completamente aislado**.

## La Garantía del Worktree

Raigal nunca permite que un agente autónomo realice modificaciones masivas directamente sobre su rama de trabajo activa:

1. `raigal agent` genera un Git worktree temporal (`.git/raigal-worktrees/<session-id>`).
2. El proveedor del agente (Claude Code, Cursor u OpenCode) se inicia con el contexto diagnóstico exacto y los requisitos de cada regla.
3. El agente edita el código y ejecuta las pruebas de verificación dentro del worktree.
4. Tras comprobar los cambios, usted revisa el diff y ejecuta `raigal agent apply <session-id>` para fusionar las mejoras.

## Uso

```bash
# Previsualizar qué abordará la sesión de reparación
raigal agent plan .

# Iniciar la sesión interactiva de reparación
raigal agent .

# Consultar sesiones de reparación activas y recientes
raigal agent sessions .

# Examinar los cambios introducidos por una sesión
raigal agent show <session-id>

# Aplicar las modificaciones aprobadas a la rama activa
raigal agent apply <session-id>
```
