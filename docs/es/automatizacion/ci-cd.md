---
description: "Guía de integración de Raigal en GitHub Actions, GitLab CI y pipelines automatizados de despliegue."
icon: route
---

# Pipelines de CI/CD y GitHub Actions

Asegure la calidad del código, bloquee el AI slop directamente en la puerta del Pull Request y transmita la telemetría en tiempo real al Tablero Kanban de Raigal Cloud.

## Variables de Entorno

Al ejecutar en pipelines de CI, configure las siguientes variables:

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `RAIGAL_TOKEN` | Sí* | API Key de la organización (`rgl_live_...`) | `rgl_live_8f3a9b...` |
| `RAIGAL_API_URL` | Opcional | Endpoint personalizado de Raigal Cloud (por defecto apunta a cloud estándar) | `https://app.raigal.dev` |

*\* Nota: Al usar GitHub Actions con `id-token: write` en planes corporativos, los tokens estáticos son opcionales ya que Raigal admite OIDC directo sin secretos.*

## GitHub Actions

### 1. Puerta de Calidad en Pull Requests

Cree el archivo `.github/workflows/raigal.yml` para validar PRs y reportar estado al Tablero Kanban:

```yaml
name: Puerta de Calidad Raigal

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  gate:
    name: Filtro de Calidad y AI Slop
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # ¡Permite autenticación OIDC directa sin secretos estáticos!

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Requerido para comparar el diff del PR
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Ejecutar Puerta de Calidad Raigal
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="tip" %}
**Autenticación OIDC de GitHub:** Al configurar `permissions: id-token: write`, el runner genera un token OIDC de corta duración. Raigal intercambia este token de forma segura vía `X-GitHub-OIDC`, eliminando la necesidad de almacenar o rotar secretos estáticos en el repositorio.
{% endhint %}

### 2. Sincronización de Cierre y Fusión de PRs

{% hint style="info" %}
**¿Utiliza la GitHub App?** Si ha instalado la **GitHub App de Raigal**, este paso **no es necesario**. La App recibe directamente los webhooks de cierre y fusión de GitHub y actualiza su tablero de forma automática. Consulte la guía de [Puerta de Enlace de Pull Requests](pull-requests.md) para más detalles.
{% endhint %}

Para entornos de GitHub Actions autónomos sin la GitHub App, puede sincronizar el estado al cerrar o fusionar PRs:

```yaml
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

      - name: Sincronizar PR con Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal report-pr-closed --pr ${{ github.event.pull_request.number }} ${{ github.event.pull_request.merged && '--merged' || '' }}
```

## GitLab CI

En `.gitlab-ci.yml`:

```yaml
raigal_gate:
  stage: test
  image: node:22
  variables:
    RAIGAL_TOKEN: $RAIGAL_TOKEN
    RAIGAL_API_URL: $RAIGAL_API_URL
  script:
    - npx @methiu/raigal ci --human
```

## Anotaciones en Pull Requests y SARIF

Para reflejar los hallazgos directamente en la pestaña **Security** de GitHub y anotaciones en las líneas de código:

```bash
npx @methiu/raigal scan --sarif > results.sarif
```

Cargue los resultados mediante la acción estándar de GitHub (`github/codeql-action/upload-sarif@v3`).
