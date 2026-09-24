---
description: "Ejecute sesiones de reparación automatizadas en git worktrees con agentes de IA locales sin riesgo para su rama principal."
icon: robot
---

# Reparación Automatizada con Agentes

Cuando el análisis estático identifica problemas que requieren refactorización arquitectónica o modificaciones semánticas, `raigal agent` traslada la tarea a su herramienta local de IA en un **git worktree completamente aislado**.

## La Garantía del Worktree

Raigal nunca permite que un agente autónomo realice modificaciones masivas directamente sobre su rama de trabajo activa:

1. **Aislamiento Total:** `raigal agent` genera un Git worktree temporal (`.git/raigal-worktrees/<session-id>`).
2. **Entrega de Contexto:** El proveedor del agente (Claude Code, OpenCode o Codex) se inicia con el contexto diagnóstico exacto y los requisitos de cada regla.
3. **Ejecución y Verificación:** El agente edita el código y ejecuta las pruebas de verificación dentro del worktree.
4. **Publicación o Fusión:** Tras comprobar los cambios, puede revisar el diff y ejecutar `raigal agent apply <session-id>` para fusionar localmente, o permitir que Raigal cree una rama y abra un Pull Request automáticamente mediante `--pr`.

## Proveedores Compatibles

Raigal se integra de forma transparente con los principales agentes locales de desarrollo:

| Proveedor | Invocación | Comando de Configuración |
|---|---|---|
| **Claude Code** | `claude` | `raigal agent connect claude` |
| **OpenCode** | `opencode` | `raigal agent connect opencode` |
| **Codex** | `codex` | `raigal agent connect codex` |
| **Detección Automática** | Selección automática | `raigal agent use auto` |

Consulte la disponibilidad de proveedores en su equipo en cualquier momento:
```bash
raigal agent providers
```

## Flujos de Trabajo

### 1. Sesión de Reparación Interactiva Local

Pruebe y valide cambios localmente antes de generar commits en git:

```bash
# Previsualizar qué abordará la sesión de reparación
raigal agent plan .

# Iniciar la sesión interactiva de reparación
raigal agent --provider opencode .

# Consultar sesiones de reparación activas y recientes
raigal agent sessions .

# Examinar los cambios introducidos y diagnósticos de una sesión
raigal agent show <session-id>

# Aplicar las modificaciones aprobadas a la rama activa
raigal agent apply <session-id>
```

### 2. Creación Autónoma de Pull Requests (`--pr`)

Para remediaciones completamente autónomas, utilice `--pr`. Raigal realizará las siguientes acciones:
1. Ejecuta arreglos deterministas seguros y transfiere los problemas restantes al agente.
2. Verifica que las pruebas pasen y que la puntuación de calidad alcance `--target-score` (por defecto: 90).
3. Confirma los cambios en una rama aislada (`raigal/repair-...`).
4. Publica la rama en el repositorio remoto y abre un Pull Request en GitHub.
5. Transmite la telemetría a Raigal Cloud, registrando una tarjeta en la columna **Agent Remediations** del Tablero Kanban.

```bash
raigal agent --provider claude --pr --target-score 95
```

### 3. Sincronización del Ciclo de Vida (`report-pr-closed`)

Cuando un Pull Request de reparación es revisado y fusionado (o cerrado) en GitHub, el Tablero Kanban de Raigal Cloud puede actualizarse automáticamente mediante un flujo en GitHub Actions:

```yaml
# .github/workflows/raigal-pr-closed.yml
name: Ciclo de Vida de PRs Raigal

on:
  pull_request:
    types: [closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Reportar Cierre de PR a Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL }}
        run: |
          npx @methiu/raigal report-pr-closed --pr ${{ github.event.pull_request.number }} ${{ github.event.pull_request.merged && '--merged' || '' }}
```

{% hint style="success" %}
**Tablero Kanban:** En Raigal Cloud, abrir un PR mediante `raigal agent --pr` crea una tarjeta en la columna **Agent Remediations**. Al fusionarse el PR, `report-pr-closed` transiciona la tarjeta a estado **Merged**, registrando la mejora de puntuación en la telemetría de su organización.
{% endhint %}
