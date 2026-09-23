---
description: "Cómo instalar Raigal CLI mediante npm, npx o binarios independientes en macOS, Linux y Windows."
icon: download
---

# Instalación

Raigal puede ejecutarse instantáneamente sin instalación permanente, o instalarse de forma global o local por repositorio.

## Requisitos

- **Node.js**: Versión 20.12 o superior (Node 22 LTS recomendado).
- **Gestores de Paquetes**: Compatible con `npm`, `pnpm`, `yarn` y `bun`.
- **Sistemas Operativos**: macOS, Linux y Windows (PowerShell y cmd.exe).

## Ejecución Rápida (`npx`)

La forma más veloz de ejecutar Raigal sin alterar su entorno global:

```bash
npx @methiu/raigal scan .
```

## Instalación Global

Para disponer del comando `raigal` en cualquier terminal:

{% tabs %}
{% tab title="npm" %}
```bash
npm install -g @methiu/raigal
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add -g @methiu/raigal
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn global add @methiu/raigal
```
{% endtab %}
{% endtabs %}

Verifique la instalación:

```bash
raigal version
# Salida: @methiu/raigal v1.0.0 (o versión activa)
```

## Dependencia en Proyecto

Para estandarizar Raigal en el equipo de desarrollo:

```bash
pnpm add -D @methiu/raigal
```

Añada un script en su archivo `package.json`:

```json
{
  "scripts": {
    "scan": "raigal scan .",
    "gate": "raigal ci ."
  }
}
```
