---
description: "Cómo configurar el modelo híbrido de GitHub App y Puerta de Calidad, aplicar protección de ramas y supervisar PRs en el tablero Kanban."
icon: git-pull-request
---

# Puerta de Enlace de Pull Requests y Kanban

Integre Raigal en el ciclo de vida de sus Pull Requests para aplicar automáticamente umbrales de calidad, detectar código deficiente generado por IA, bloquear riesgos de fusión antes de que lleguen a la rama principal y visualizar evaluaciones de PRs en tiempo real en el tablero Kanban de Raigal Cloud.

---

## Arquitectura: Modelo Híbrido GitHub App + Actions

Raigal utiliza una **Arquitectura Híbrida** empresarial que combina las ventajas de las GitHub Apps y de GitHub Actions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Ecosistema de GitHub                            │
│                                                                        │
│   1. Desarrollador abre PR / sube commit                               │
│          │                                                             │
│          ▼                                                             │
│   Webhook de GitHub ───────────────────────┐                           │
│          │                                 │                           │
│          ▼ (inicia CI)                     │ (evento pull_request)     │
│   Ejecutor GitHub Actions                  │                           │
│     • Ejecuta análisis AST y detección     ▼                           │
│     • Calcula diff y puntuación    Plano de Control Raigal Cloud       │
│     • Cero código sale del runner   (https://app.raigal.dev)           │
│          │                                 │                           │
│          ▼ (POST /v1/runs)                 │ 2. Crea Check Pendiente   │
│   Envía métricas y Head SHA                │    "Raigal Quality Gate"  │
│          │                                 ▼                           │
│          └─────────────────────────► Resuelve el Check Run             │
│                                      (Éxito / Fallo + Resumen)         │
│                                            │                           │
│                                            ▼                           │
│   Protección de Ramas Aplicada ◄───────────┘                           │
│   Tarjeta en el Tablero Kanban Actualizada al Instante                 │
└────────────────────────────────────────────────────────────────────────┘
```

### ¿Por qué Híbrido?
- **Aislamiento de Cómputo**: Su código fuente propietario permanece 100% dentro de su ejecutor de GitHub Actions. En ningún momento se clona, transfiere ni almacena código fuente en los servidores de Raigal Cloud.
- **Feedback Inmediato en Estado Pendiente**: En el instante en que se abre o actualiza un PR, la GitHub App registra automáticamente una verificación `"Raigal Quality Gate"` en estado `in_progress` en el commit head SHA y crea la tarjeta del PR en su tablero Kanban.
- **Protección de Ramas Nativa**: La verificación `"Raigal Quality Gate"` aparece directamente en la configuración de Branch Protection de su repositorio para requerirla obligatoriamente antes de fusionar.
- **Detección Automática de Fusión y Cierre**: Cuando un PR se fusiona o cierra, GitHub entrega el evento directamente al webhook de la App de Raigal, actualizando el tablero de inmediato sin necesidad de trabajos adicionales de CI ni llamadas manuales.

---

## Opción de Configuración 1: GitHub App + Actions (Recomendada)

Siga estos pasos para habilitar verificaciones nativas en GitHub, estado pendiente instantáneo y seguimiento automático de fusiones.

{% stepper %}

{% step %}
### Crear y Registrar la GitHub App
1. Vaya a la configuración de su cuenta u organización de GitHub: **Settings** > **Developer Settings** > **GitHub Apps** > **New GitHub App**.
2. Configure los siguientes campos:
   * **GitHub App name**: `Raigal Quality Gate` (o `Raigal - [Su Org]`)
   * **Homepage URL**: `https://app.raigal.dev`
   * **Webhook URL**: `https://app.raigal.dev/api/webhooks/github`
   * **Webhook secret**: Genere un secreto seguro (ej. `openssl rand -hex 20`).
3. En **Repository permissions**, configure:
   * **Checks**: `Read and write` (necesario para publicar y resolver el check run)
   * **Pull requests**: `Read and write` (necesario para detectar aperturas, sincronizaciones y cierres de PRs)
   * **Metadata**: `Read-only` (predeterminado)
4. En **Subscribe to events**, marque:
   * **Pull request**
   * **Installation** e **Installation target**
5. Haga clic en **Create GitHub App**.
6. Genere una **Private key** y descargue el archivo `.pem`. Anote el **App ID** numérico.
{% endstep %}

{% step %}
### Conectar la GitHub App con Raigal Cloud
Proporcione las credenciales de su GitHub App a su instancia de Raigal Cloud (o configúrelas en sus variables de entorno):
* `GITHUB_APP_ID`: El App ID numérico.
* `GITHUB_APP_WEBHOOK_SECRET`: El secreto del webhook configurado en GitHub.
* `GITHUB_APP_PRIVATE_KEY_B64`: Su clave privada `.pem` codificada en base64 (`cat key.pem | base64`).
{% endstep %}

{% step %}
### Instalar la App en su Repositorio
1. En la configuración de su GitHub App, haga clic en **Install App** en el menú lateral.
2. Seleccione su cuenta u organización y elija **All repositories** o seleccione repositorios específicos.
3. Pulse **Install**.
{% endstep %}

{% step %}
### Configurar el Flujo de Trabajo en GitHub Actions
Cree el archivo `.github/workflows/raigal.yml` en su repositorio:

```yaml
name: Raigal Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  gate:
    name: Code Quality & Slop Gate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Permite OIDC sin secretos estáticos

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          # CRÍTICO: fetch-depth: 0 obtiene el historial git completo
          # para que Raigal calcule diffs precisos contra la rama base.
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run Raigal Quality Gate
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="success" %}
**Cero Pasos Adicionales al Fusionar:** Dado que la GitHub App recibe eventos `pull_request.closed` vía webhook, no necesita flujos secundarios ni comandos `report-pr-closed`. Al fusionarse o cerrarse el PR, el tablero Kanban se actualiza automáticamente.
{% endhint %}
{% endstep %}

{% step %}
### Habilitar Protección de Ramas (Branch Protection)
1. En su repositorio de GitHub, vaya a **Settings** > **Branches**.
2. Añada una regla de protección para `main`.
3. Active **Require status checks to pass before merging**.
4. Busque y seleccione **Raigal Quality Gate**.
5. Guarde los cambios. A partir de este momento, ningún PR podrá fusionarse si Raigal detecta infracciones bloqueantes.
{% endstep %}

{% endstepper %}

---

## Opción de Configuración 2: GitHub Actions Autónomo (Sin App)

Si su organización no permite instalar GitHub Apps, Raigal funciona de forma autónoma mediante telemetría directa desde GitHub Actions.

{% stepper %}

{% step %}
### Configurar Secretos en GitHub
En **Settings** > **Secrets and variables** > **Actions**, añada:
* `RAIGAL_TOKEN`: Su clave de API (`rgl_live_...`) copiada desde [Raigal Cloud Settings](https://app.raigal.dev).
* `RAIGAL_API_URL`: (Opcional) `https://app.raigal.dev` si no utiliza la nube predeterminada.
{% endstep %}

{% step %}
### Añadir Flujo de CI
Añada el archivo `.github/workflows/raigal.yml` con el contenido mostrado en la Opción 1.
{% endstep %}

{% step %}
### (Opcional) Sincronizar Cierre de PRs
Sin la GitHub App, puede sincronizar el cierre de PRs con este trabajo opcional:

```yaml
name: Raigal PR Lifecycle

on:
  pull_request:
    types: [closed]

jobs:
  sync-pr-closed:
    name: Sync Closed PR Status
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Report PR Closure to Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal report-pr-closed \
            --pr ${{ github.event.pull_request.number }} \
            ${{ github.event.pull_request.merged && '--merged' || '' }}
```
{% endstep %}

{% endstepper %}

---

## Supervisión de PRs en el Tablero Kanban

Una vez configurado, acceda a [Raigal Cloud](https://app.raigal.dev) para ver las evaluaciones en vivo:

1. **Tarjetas de PRs Activas**: Cada PR evaluado aparece en la columna **PULL REQUESTS**.
   * **Passed Gate**: Destacado en verde con la puntuación obtenida (ej. `94/100`), autor, rama de origen y rama destino.
   * **Merge Blocked**: Destacado en rojo con el número de incidencias bloqueantes detectadas.
2. **Panel Desplegable de Detalles**:
   * Haga clic en cualquier tarjeta para abrir el **Pull Request Drawer**.
   * Examine los **Hallazgos Bloqueantes** con la regla violada, archivo exacto y número de línea.
   * Revise las **Estadísticas de Diff** (+adiciones, -eliminaciones, archivos alterados).
   * Visualice el **Diff Unificado** formateado al estilo terminal.
   * Botones de acción rápida: **Copy git checkout** para replicar la rama en local, u **Open on GitHub** para ir directamente a la revisión en GitHub.

---

## Gestión de PRs desde Forks Públicos

{% hint style="danger" %}
**Seguridad en Forks:** GitHub Actions restringe automáticamente el acceso a secretos (`${{ secrets.RAIGAL_TOKEN }}`) en PRs procedentes de forks externos para evitar filtración de credenciales.
{% endhint %}

Si su repositorio admite contribuciones de forks públicos, utilice **GitHub Actions OIDC**:

```yaml
permissions:
  contents: read
  id-token: write  # Requerido para OIDC sin secretos
```

Al activar `id-token: write`, el CLI de Raigal solicita un token OIDC efímero y lo incluye en la cabecera `X-GitHub-OIDC`. Raigal Cloud comprueba criptográficamente la firma con el proveedor público de GitHub (`token.actions.githubusercontent.com`) y verifica que el propietario del repositorio figure en la lista permitida de su organización, sin requerir secretos estáticos.

---

## Guía de Resolución de Problemas

| Síntoma | Causa | Solución |
| :--- | :--- | :--- |
| **Check queda en Pending indefinidamente** | El flujo de CI no se ejecutó o superó el tiempo límite | Verifique la ejecución del runner en GitHub Actions para el `head_sha`. Raigal Cloud limpia automáticamente verificaciones pendientes huérfanas tras 20 minutos. |
| **El Check Run no aparece en el PR** | Faltan permisos de Checks en la GitHub App | En los ajustes de la GitHub App, asegúrese de que **Checks: Read and write** esté activo y la App instalada en el repositorio. |
| **Error HTTP 401 en Webhooks de GitHub** | Secreto de webhook discrepante | Asegúrese de que `GITHUB_APP_WEBHOOK_SECRET` coincida exactamente con el secreto configurado en GitHub. |
| **Error HTTP 403 `owner_not_allowed` en CI** | El propietario del repo no está sincronizado en Raigal | Vaya a **Settings > Allowed Owners** en Raigal Cloud y pulse **Sync GitHub**. |
| **El diff preview muestra 0 archivos cambiados** | Checkout superficial (`fetch-depth: 1`) | Añada `fetch-depth: 0` al paso `actions/checkout@v4` para disponer del historial git necesario para comparar con la rama base. |
| **La tarjeta no se actualiza al fusionar** | Falta el evento de webhook o modo sin App | Con GitHub App, verifique que `pull_request` esté marcado en eventos. En modo sin App, añada el trabajo `report-pr-closed`. |
