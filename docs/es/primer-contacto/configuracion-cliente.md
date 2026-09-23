---
description: "Guía paso a paso para administradores de plataforma y bienvenida de organizaciones de clientes."
icon: building
---

# Configuración de Primer Cliente

Esta guía describe el proceso completo para configurar Raigal para un cliente corporativo o equipo empresarial desde cero.

## Resumen de Responsabilidades

| Tarea | Responsable | Notas |
|---|---|---|
| **Crear Organización y Licencias** | Administrador de Plataforma | Se realiza en el Panel de Raigal Cloud |
| **Generar API Key (`rgl_live_...`)** | Administrador de Plataforma | Se muestra una única vez; para CI/CD |
| **Invitar al Equipo** | Administrador de la Organización | Vía Clerk OAuth / Invitación por correo |
| **Inicio de Sesión en CLI** | Desarrolladores del Cliente | Ejecutan `raigal login` en su terminal |
| **Filtro de Calidad en CI/CD** | DevOps / Administradores de Repo | Configuran `RAIGAL_TOKEN` en sus secrets |

## Acciones del Administrador de Plataforma (Su Rol)

1. **Acceso al Portal Administrativo:**
   Inicie sesión en su instancia de Raigal Cloud con una cuenta configurada en `PLATFORM_ADMIN_USER_IDS`.

2. **Crear la Organización:**
   - Registre la organización (ej: `Acme Corp`).
   - Asigne el plan de suscripción: `team` o `enterprise`.
   - Configure el número de desarrolladores autorizados y licencias.

3. **Generar la API Key de CI/CD:**
   - En la sección **API Keys**, cree una clave con prefijo `rgl_live_`.
   - Transmita de forma segura esta clave al responsable de DevOps del cliente.

## Acciones del Equipo del Cliente (Su Rol)

### Configuración Local de los Desarrolladores
Cada desarrollador ejecuta en su terminal:

```bash
npx @methiu/raigal login
```

Esto abrirá el navegador para autenticarse vía Clerk. Tras el inicio de sesión, las credenciales y un token de concesión Ed25519 se almacenan localmente en `~/.raigal/credentials.json` (con permisos `0600`), permitiendo escaneos offline de hasta 72 horas.

Verifique el estado de la sesión en cualquier momento:
```bash
npx @methiu/raigal whoami
```

### Instalación de Hooks para Agentes de IA
Para prevenir de forma automática la entrada de AI slop mientras los programadores usan Claude Code, Cursor u OpenCode:

```bash
npx @methiu/raigal hook install
```
