---
description: "Modelo de seguridad, almacenamiento de credenciales, resolución de RAIGAL_TOKEN y firmas offline Ed25519."
icon: lock
---

# Modelo de Seguridad y Credenciales

Raigal está diseñado con principios de Zero-Trust, verificación criptográfica fuera de línea y máxima higiene de secretos.

## Almacenamiento de Credenciales

En entornos locales de desarrollador, las credenciales y concesiones se guardan en el directorio del usuario:

- **Ruta:** `~/.raigal/credentials.json`
- **Permisos de Archivo:** `0600` (lectura/escritura exclusiva para el usuario del sistema; acceso bloqueado a grupos y otros).
- **Estructura:**
  ```json
  {
    "token": "rgl_sess_...",
    "org": { "id": "org_123", "name": "Acme Corp" },
    "user": { "id": "user_456", "email": "dev@acme.com" },
    "created_at": "2026-09-23T12:00:00.000Z"
  }
  ```

## Configuración de `RAIGAL_TOKEN` y `RAIGAL_API_URL`

En pipelines de integración continua, contenedores Docker o entornos automatizados, configure la autenticación y el punto de enlace mediante variables de entorno:

- `RAIGAL_TOKEN`: API Token activo de su organización (`rgl_live_...`). Tiene prioridad inmediata sobre el archivo local `~/.raigal/credentials.json`.
- `RAIGAL_API_URL`: (Opcional) Endpoint explícito de su backend (ej: `https://app.raigal.dev`).

{% tabs %}
{% tab title="GitHub Actions" %}
```yaml
- name: Escaneo Raigal
  env:
    RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
    RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
  run: npx @methiu/raigal scan .
```
{% endtab %}

{% tab title="Terminal (macOS/Linux)" %}
```bash
export RAIGAL_TOKEN="rgl_live_su_token_aqui"
export RAIGAL_API_URL="https://app.raigal.dev"
npx @methiu/raigal whoami
```
{% endtab %}

{% tab title="Windows PowerShell" %}
```powershell
$env:RAIGAL_TOKEN="rgl_live_su_token_aqui"
$env:RAIGAL_API_URL="https://app.raigal.dev"
npx @methiu/raigal whoami
```
{% endtab %}
{% endtabs %}

## Depuración de Secretos en Telemetría e Higiene de Datos

Raigal aplica estrictos controles de seguridad antes de que la telemetría salga de su estación de trabajo o se almacene en la nube:

1. **Depuración en Origen:** El CLI sanitiza automáticamente las cargas de telemetría, eliminando cabeceras de autorización, tokens Bearer, credenciales de AWS y patrones comunes de contraseñas antes de encolarlas.
2. **Ingestión Sin Código:** La telemetría solo transmite métricas agregadas de diagnósticos, nombres de reglas, rutas de archivo relativas y diferencias de puntuación. Su código fuente nunca se sube a Raigal Cloud.
3. **Persistencia Real y Garantía Zero-Mock:** El backend en la nube persiste los eventos directamente en tablas relacionales de PostgreSQL (`telemetry_runs`, `pull_requests`) mediante operaciones idempotentes protegidas (`ON CONFLICT`). El uso de mocks en memoria está prohibido en producción.

## Autorización OIDC de GitHub Actions Sin Secretos Estáticos

Para entornos empresariales que ejecutan GitHub Actions, Raigal elimina el riesgo de gestionar claves estáticas de larga duración:

1. Configure `permissions: id-token: write` en el trabajo del flujo de GitHub Actions.
2. El runner de GitHub emite un token JWT OIDC firmado criptográficamente que certifica la identidad del repositorio, propietario, rama y flujo.
3. Raigal envía este token en la cabecera `X-GitHub-OIDC` hacia `/api/v1/telemetry/runs`.
4. Raigal Cloud valida la firma criptográfica directamente con el proveedor OIDC de GitHub (`https://token.actions.githubusercontent.com`) y confirma que el propietario del repositorio pertenece a la suscripción autorizada de su organización antes de registrar los resultados.

## Concesiones Criptográficas Fuera de Línea (Ed25519)

Raigal **no** envía peticiones a los servidores en cada archivo analizado:

1. Al autenticarse mediante `raigal login` o con `RAIGAL_TOKEN`, el servidor firma un token JWT utilizando una clave privada Ed25519 (`RAIGAL_PRIVATE_KEY`).
2. El CLI verifica localmente dicha firma mediante la clave pública integrada (`src/cloud/keys.ts`).
3. La concesión válida se almacena en `~/.raigal/entitlement.json` por hasta 72 horas, permitiendo trabajar en aviones o entornos sin conexión.
