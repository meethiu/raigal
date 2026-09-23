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
| `raigal fix [dir]` | Aplica correcciones automáticas deterministas |
| `raigal ci [dir]` | Puerta de calidad con códigos de salida por umbral |
| `raigal hook` | Gestiona hooks en tiempo real para agentes de IA |
| `raigal agent` | Sesiones de reparación en worktree con Claude/Cursor/OpenCode |
| `raigal whoami` | Muestra las credenciales activas y contexto de organización |
| `raigal login` | Inicio de sesión interactivo en navegador con Clerk |
| `raigal logout` | Elimina las credenciales locales y concesiones |
| `raigal doctor` | Comprueba binarios del sistema, herramientas y motores |
| `raigal rules` | Muestra el catálogo de reglas y pesos de puntuación |

## Referencia de Comandos

### `raigal scan`

Evalúa el directorio indicado y muestra el desglose de calidad.

```bash
raigal scan [opciones] [ruta]
```

**Opciones:**
- `--changes`: Analiza únicamente los archivos modificados respecto a git `HEAD`.
- `--base <ref>`: Compara el diff contra una referencia específica (ej: `origin/main`).
- `--staged`: Analiza únicamente los archivos en el stage de git (ideal para pre-commit).
- `--json`: Emite el árbol completo de diagnósticos en formato JSON.
- `--sarif`: Genera diagnósticos en estándar OASIS SARIF 2.1.0.
- `--fail-on <nivel>`: Finaliza con código de error 1 según el nivel: `none`, `error`, o `warning`.

### `raigal ci`

Diseñado expresamente para la validación de Pull Requests en entornos de CI.

```bash
raigal ci [opciones] [ruta]
```

- Bloquea el PR si la puntuación global no alcanza el umbral establecido (por defecto: 80).
- Admite `--human` para generar resúmenes visuales en los registros de CI.

### `raigal fix`

Aplica correcciones deterministas y seguras sin riesgo de introducir alucinaciones lógicas.

```bash
raigal fix --safe .
```

- `--safe`: Aplica únicamente cambios con garantía de preservación semántica.
- `--dry-run`: Previsualiza las modificaciones sin escribir en disco.
- `-p, --prompt`: Convierte los problemas no resueltos en un prompt listo para un modelo de lenguaje.
