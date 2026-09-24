---
description: "Referencia completa de comandos y banderas de la interfaz de línea de comandos de Raigal."
icon: terminal
---

# Comandos y Banderas CLI

Raigal proporciona una interfaz de línea de comandos intuitiva tanto para el trabajo diario del desarrollador como para pipelines de integración continua.

## Índice de Comandos

| Comando | Acción |
|---|---|
| `raigal [dir]` | Menú interactivo en terminal o escaneo predeterminado |
| `raigal scan [dir]` | Ejecuta el escaneo de calidad y devuelve la puntuación |
| `raigal fix [dir]` | Aplica correcciones automáticas deterministas o crea prompts para agentes |
| `raigal ci [dir]` | Puerta de calidad con códigos de salida por umbral en CI/CD |
| `raigal agent [dir]` | Sesiones de reparación en worktrees aislados (Claude, Cursor, OpenCode) |
| `raigal hook` | Gestiona hooks en tiempo real para agentes de IA |
| `raigal report-pr-closed` | Sincroniza el ciclo de vida (cierre/fusión) de Pull Requests con Raigal Cloud |
| `raigal telemetry` | Inspecciona eventos de telemetría registrados y estado del outbox |
| `raigal login` | Inicio de sesión interactivo vía navegador OAuth o token API |
| `raigal logout` | Elimina credenciales locales y concesiones offline en caché |
| `raigal whoami` | Muestra credenciales activas, usuario, organización y repositorios permitidos |
| `raigal doctor` | Comprueba binarios del sistema, herramientas y motores |
| `raigal rules` | Muestra el catálogo de reglas y pesos de puntuación |
| `raigal init` | Crea el archivo de configuración y flujo opcional para CI |

## Referencia de Comandos

### `raigal scan`

Evalúa el directorio indicado y muestra el desglose de calidad.

```bash
raigal scan [opciones] [ruta]
```

**Opciones:**
- `--changes`: Analiza únicamente los archivos modificados respecto a git `HEAD`.
- `--staged`: Analiza únicamente los archivos en el stage de git (ideal para pre-commit).
- `--base <ref>`: Compara el diff contra una referencia específica (ej: `origin/main`).
- `-d, --verbose`: Muestra el desglose detallado de archivos por cada regla.
- `--json`: Emite el árbol completo de diagnósticos en formato JSON.
- `--sarif`: Genera diagnósticos en estándar OASIS SARIF 2.1.0.
- `--format <formato>`: Define explícitamente el formato de salida (`json` o `sarif`).
- `--fail-on <nivel>`: Finaliza con código de error 1 según el nivel: `none`, `error`, o `warning`.

### `raigal ci`

Diseñado expresamente para la validación de Pull Requests en pipelines de CI/CD.

```bash
raigal ci [opciones] [ruta]
```

- Bloquea el PR si la puntuación global no alcanza el umbral establecido (por defecto: 80).
- Admite `--human` para generar resúmenes visuales legibles en los registros de CI.
- `--changes`: Valida únicamente los archivos modificados respecto a `--base` (o `HEAD`).
- `--staged`: Valida únicamente archivos en stage.
- `--base <ref>`: Referencia base para el diff de `--changes` (ej: `origin/main`).
- `--sarif`: Exporta resultados en SARIF 2.1.0 para anotaciones automáticas en GitHub Code Scanning.

### `raigal fix`

Aplica correcciones deterministas y seguras sin riesgo de introducir alucinaciones lógicas.

```bash
raigal fix [opciones] [ruta]
```

- `--safe`: Aplica únicamente cambios con garantía de preservación semántica (importaciones, eliminación de comentarios triviales, formateadores seguros).
- `-f, --force`: Ejecuta correcciones intensivas (auditorías de dependencias y alineación de frameworks).
- `--dry-run`: Previsualiza las modificaciones sin escribir en disco.
- `-p, --prompt`: Convierte los problemas restantes en un prompt contextualizado para su agente de IA.
- `--changes` / `--staged`: Limita las correcciones a archivos modificados o en stage.
- `--base <ref>`: Referencia base para `--changes`.

### `raigal agent`

Ejecuta sesiones de reparación autónomas mediante herramientas de IA locales en un git worktree aislado.

```bash
raigal agent [opciones] [ruta]
```

**Banderas Principales:**
- `--provider <proveedor>`: Proveedor a invocar (`auto`, `codex`, `claude`, `opencode`).
- `--target-score <n>`: Umbral de puntuación objetivo hacia el cual converger (por defecto: 90).
- `--max-turns <n>`: Número máximo de turnos del agente por intento de reparación (por defecto: 4).
- `--limit <n>`: Número máximo de hallazgos entregados al agente (por defecto: 8).
- `--in-place`: Edita directamente en el árbol de trabajo actual en lugar de aislar en worktree.
- `--apply`: Aplica el diff aceptado al árbol original al finalizar.
- `-y, --yes`: Omite solicitudes interactivas de confirmación para `--apply`.
- `--dry-run`: Imprime el proveedor seleccionado y el plan de ejecución sin realizar cambios.
- `--background`: Inicia la ejecución del agente en segundo plano y retorna de inmediato.
- `--no-fix`: Omite la fase de arreglos deterministas seguros antes de invocar al agente.
- `--commit`: Realiza un commit con el diff verificado en una rama de reparación.
- `--pr`: Publica la rama y abre automáticamente un Pull Request en GitHub.
- `--branch <nombre>`: Nombre personalizado para la rama en `--commit` o `--pr`.
- `--base <rama>`: Rama base de destino para `--pr`.
- `--title <titulo>`: Título del Pull Request para `--pr`.
- `--commit-message <mensaje>`: Mensaje de commit personalizado.
- `--ready`: Abre un PR listo para revisión en lugar de un borrador (draft).
- `--cleanup`: Elimina el worktree generado incluso si queda algún diff residual.

**Subcomandos de Agente:**
- `raigal agent plan [dir]`: Previsualiza proveedor, worktree, hallazgos y acciones sin editar archivos.
- `raigal agent connect [proveedor]`: Conecta con un proveedor local mediante su propia autenticación CLI.
- `raigal agent providers`: Lista proveedores de agentes detectados localmente y su estado.
- `raigal agent use [proveedor]`: Configura o muestra el proveedor por defecto para este repositorio.
- `raigal agent sessions [dir]`: Lista sesiones de reparación activas y pasadas.
- `raigal agent show <session-id>`: Inspecciona diff y metadatos de una sesión en particular.
- `raigal agent apply <session-id>`: Fusiona las mejoras de una sesión a su rama de trabajo.
- `raigal agent monitor [dir]`: Supervisa cambios en git y repara automáticamente cuando baja la puntuación.

### `raigal report-pr-closed`

Reporta el cierre o fusión de un Pull Request a Raigal Cloud para mantener sincronizado el Tablero Kanban.

```bash
raigal report-pr-closed --pr <numero> [--merged]
```

- `--pr <numero>`: Número del Pull Request (obtenido automáticamente de `GITHUB_EVENT_PATH` en GitHub Actions).
- `--merged`: Indicador de si el Pull Request fue fusionado en la rama principal.

### `raigal login` y `raigal logout`

Gestiona las credenciales de Raigal Cloud y la autenticación mediante concesiones offline.

```bash
# Inicio de sesión interactivo vía navegador OAuth
raigal login

# Inicio de sesión automatizado vía token recibido en stdin
echo "rgl_live_..." | raigal login --with-token

# Limpiar credenciales locales y caché offline
raigal logout
```

### `raigal whoami`

Muestra el usuario autenticado, organización, plan contratado y repositorios de GitHub con acceso autorizado.

```bash
raigal whoami
```

### `raigal telemetry`

Inspecciona las cargas de telemetría registradas y el estado de la cola de salida (outbox).

```bash
raigal telemetry --show
raigal telemetry --show --json
```

### `raigal doctor`

Verifica el entorno del sistema, formateadores, linters y binarios de agentes de programación.

```bash
raigal doctor
```
