---
description: "Endpoints de la API de administración, provisión de organizaciones, rotación de claves y concesión de licencias."
icon: key
---

# API de Administración y Licenciamiento

Raigal Cloud proporciona una API REST de administración para el aprovisionamiento de cuentas corporativas, gestión de desarrolladores autorizados y rotación de claves.

## Cabeceras de Autenticación

Las peticiones de administración deben incluir un token de sesión de Clerk válido perteneciente a un administrador autorizado:

```http
Authorization: Bearer <token_sesion_clerk>
```

## Resumen de Endpoints

### `GET /api/admin/organizations`
Devuelve el listado paginado de todas las organizaciones empresariales activas, sus planes de suscripción y número de licencias.

### `POST /api/admin/organizations`
Aprovisiona una nueva organización de clientes.

**Cuerpo de la Petición:**
```json
{
  "name": "Cyberdyne Systems",
  "slug": "cyberdyne",
  "tier": "enterprise",
  "seats": 100
}
```

### `POST /api/admin/organizations/:orgId/keys`
Genera una nueva API Key de organización (`rgl_live_...`).

{% hint style="warning" %}
La clave API en texto plano se muestra **una única vez** en la respuesta de creación. Raigal Cloud almacena únicamente su hash criptográfico SHA-256 en PostgreSQL.
{% endhint %}

### `POST /v1/entitlement`
El endpoint central de validación de licencias llamado por el CLI durante `raigal login` o en la ejecución en CI.
- Verifica la membresía de la organización o la validez de la API key.
- Genera un token JWT firmado criptográficamente con la clave privada Ed25519 con:
  - `sub`: Identificador de la Organización
  - `tier`: Nivel de suscripción
  - `exp`: Caducidad temporal (validez de concesión por 72 horas)
  - `features`: Matriz de motores autorizados
