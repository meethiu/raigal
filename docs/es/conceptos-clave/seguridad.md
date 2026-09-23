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

## Configuración de `RAIGAL_TOKEN`

En pipelines de integración continua, contenedores Docker o entornos automatizados, use la variable de entorno `RAIGAL_TOKEN`.

{% hint style="info" %}
`RAIGAL_TOKEN` tiene prioridad inmediata sobre el archivo local `~/.raigal/credentials.json`.
{% endhint %}

{% tabs %}
{% tab title="GitHub Actions" %}
```yaml
- name: Escaneo Raigal
  env:
    RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
  run: npx @methiu/raigal scan .
```
{% endtab %}

{% tab title="Terminal (macOS/Linux)" %}
```bash
export RAIGAL_TOKEN="rgl_live_su_token_aqui"
npx @methiu/raigal whoami
```
{% endtab %}

{% tab title="Windows PowerShell" %}
```powershell
$env:RAIGAL_TOKEN="rgl_live_su_token_aqui"
npx @methiu/raigal whoami
```
{% endtab %}
{% endtabs %}

## Concesiones Criptográficas Fuera de Línea (Ed25519)

Raigal **no** envía peticiones a los servidores en cada archivo analizado:
1. Al autenticarse mediante `raigal login` o con `RAIGAL_TOKEN`, el servidor firma un token JWT utilizando una clave privada Ed25519 (`RAIGAL_PRIVATE_KEY`).
2. El CLI verifica localmente dicha firma mediante la clave pública integrada (`src/cloud/keys.ts`).
3. La concesión válida se almacena en `~/.raigal/entitlement.json` por hasta 72 horas, permitiendo trabajar en aviones o entornos sin conexión.
