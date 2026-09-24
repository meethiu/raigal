---
description: "Guía paso a paso para administradores de plataforma y bienvenida de organizaciones de clientes."
icon: building
---

# Configuración de Primer Cliente

Esta guía describe el proceso completo para configurar Raigal para un cliente corporativo o equipo empresarial desde cero.

## Resumen de Responsabilidades

| Tarea | Responsable | Notas |
|---|---|---|
| **Crear Organización y Licencias** | Administrador de Plataforma | Se gestiona en la plataforma Raigal Cloud |
| **Obtener API Key (`rgl_live_...`)** | Administrador de Organización | Disponible en la vista de **Settings** |
| **Configurar `RAIGAL_API_URL`** | Administrador / DevOps | Apunta a su instancia dedicada de Raigal Cloud |
| **Invitar al Equipo** | Administrador de Organización | Vía Clerk OAuth / Invitación en Settings |
| **Inicio de Sesión en CLI** | Desarrolladores del Cliente | Ejecutan `raigal login` en su terminal |
| **Filtro de Calidad en CI/CD** | DevOps / Administradores de Repo | Configuran `RAIGAL_TOKEN` y `RAIGAL_API_URL` en secrets |

## Navegación de la Plataforma y Ajustes

El panel web de Raigal Cloud ofrece una interfaz optimizada:

- **Overview:** El Tablero Kanban de Remediación en 4 columnas (Medium Priority, High Risk, Pull Requests CI Gates, Agent Remediations).
- **Activity:** Flujo en tiempo real de análisis de repositorios, sesiones de agentes y evolución de notas.
- **Settings:** Configuración de la organización, credenciales y opciones de cuenta.
- **Docs:** Enlace directo a la documentación oficial completa en GitBook.
- **Paleta de Comandos ⌘K:** Búsqueda rápida de repositorios, cambio de ramas y navegación instantánea.

### El Panel de Settings (Ajustes)

En la sección **Settings**, los administradores pueden configurar sus integraciones:

1. **Token API de Raigal:**
   - Muestra el token activo de la organización (`rgl_live_...`).
   - Dispone de selector de enmascaramiento seguro (`••••••••` vs texto legible).
   - El botón de copia garantiza copiar siempre el valor real y no la máscara de puntos.
2. **URL de la API de Raigal:**
   - Muestra el endpoint activo del backend (ej: `https://app.raigal.dev`).
   - Copia en un clic para pegar en pipelines de CI/CD.
3. **Instrucciones para la Línea de Comandos:**
   - Proporciona comandos listos para exportar variables de entorno en la terminal:
     ```bash
     export RAIGAL_TOKEN="rgl_live_..."
     export RAIGAL_API_URL="https://app.raigal.dev"
     ```
4. **Perfil de Usuario y Ajustes de Cuenta (Clerk):**
   - Botón directo para abrir el modal de Clerk y actualizar correo, contraseña, autenticación multifactor (MFA) y datos de organización.

## Configuración del Desarrollador en el Cliente

### 1. Autenticación Local en CLI
Cada desarrollador inicia sesión interactivamente en su navegador:

```bash
npx @methiu/raigal login
```

Esto inicia un flujo OAuth. Una vez autenticado, las credenciales y un token de concesión Ed25519 se almacenan localmente en `~/.raigal/credentials.json` (con permisos `0600`), permitiendo escaneos offline de hasta 72 horas.

Para entornos sin interfaz gráfica o dotfiles automatizados:
```bash
echo "rgl_live_..." | npx @methiu/raigal login --with-token
```

Verifique el estado de la sesión en cualquier momento:
```bash
npx @methiu/raigal whoami
```

### 2. Instalación de Hooks para Agentes de IA
Para interceptar y prevenir de forma automática la entrada de AI slop mientras los desarrolladores programan con Claude Code, Cursor u OpenCode:

```bash
npx @methiu/raigal hook install
```
