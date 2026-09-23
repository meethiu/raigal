---
description: "Guía de integración de Raigal en GitHub Actions, GitLab CI y pipelines automatizados de despliegue."
icon: route
---

# Pipelines de CI/CD y GitHub Actions

Asegure la calidad del código y bloquee el AI slop directamente en la puerta del Pull Request.

## GitHub Actions

Cree el archivo `.github/workflows/raigal.yml`:

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
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="tip" %}
**GitHub OIDC:** Si su organización utiliza Raigal Enterprise, configurar `permissions: id-token: write` permite a Raigal intercambiar tokens con GitHub en tiempo real, ¡sin necesidad de gestionar claves API estáticas!
{% endhint %}

## GitLab CI

En `.gitlab-ci.yml`:

```yaml
raigal_gate:
  stage: test
  image: node:22
  variables:
    RAIGAL_TOKEN: $RAIGAL_TOKEN
  script:
    - npx @methiu/raigal ci --human
```

## Anotaciones en Pull Requests y SARIF

Para reflejar los hallazgos directamente en la pestaña **Security** de GitHub:

```bash
npx @methiu/raigal scan --sarif > results.sarif
```

Cargue los resultados mediante la acción estándar de GitHub (`github/codeql-action/upload-sarif@v3`).
