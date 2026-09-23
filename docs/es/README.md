---
description: "Raigal es la plataforma unificada de calidad de código y detección de 'AI slop' para equipos de ingeniería y agentes de programación."
icon: shield-check
layout:
  width: default
  tableOfContents:
    visible: true
  pagination:
    visible: true
---

# Bienvenido a Raigal

Raigal es una plataforma de calidad de código y motor CLI de nivel empresarial diseñada para detectar los patrones defectuosos, redundantes o frágiles que introducen las herramientas de generación de código por Inteligencia Artificial. Unifica formateo, linting, control de complejidad, auditoría de seguridad y detección especializada de "AI slop" tras un único comando, calculando una puntuación accionable de 0 a 100.

{% hint style="success" %}
**Rápido y Determinista:** Raigal analiza miles de archivos en milisegundos mediante motores nativos de alto rendimiento y ofrece flujos de reparación autónomos.
{% endhint %}

## ¿Por qué Raigal?

Las herramientas de IA generativa (Claude, Cursor, Copilot, ChatGPT) producen código con enorme rapidez, pero con frecuencia introducen:
- **Comentarios triviales y relleno:** Repetición literal de nombres de funciones o variables.
- **Alucinaciones defensivas:** Verificaciones nulas redundantes e innecesarias.
- **Antipatrones de fallo silencioso:** Bloques `catch` vacíos o promesas sin captura de errores.
- **Deriva arquitectónica:** Violación de capas de dependencias y referencias circulares.
- **Evasiones de tipado:** Uso indiscriminado de `as any` o falta de validaciones en tiempo de ejecución.

Raigal protege su base de código en el hook local del desarrollador, en la revisión de Pull Requests y a lo largo de su pipeline de CI/CD.

## Capacidades Principales

<table data-view="cards">
  <thead>
    <tr>
      <th>Capacidad</th>
      <th>Descripción</th>
      <th>Enlace</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Puntuación de 0 a 100</strong></td>
      <td>Cálculo ponderado por densidad de código, calibrado para repositorios de alta escala.</td>
      <td><a href="conceptos-clave/puntuacion.md">Conocer Puntuación</a></td>
    </tr>
    <tr>
      <td><strong>13+ Reglas contra AI Slop</strong></td>
      <td>Análisis sintáctico AST y patrones deterministas para eliminar código basura.</td>
      <td><a href="conceptos-clave/reglas.md">Explorar Reglas</a></td>
    </tr>
    <tr>
      <td><strong>Hooks en Tiempo Real</strong></td>
      <td>Intercepción inmediata de ediciones para Claude Code, Cursor y OpenCode.</td>
      <td><a href="referencia-cli/hooks.md">Configurar Hooks</a></td>
    </tr>
    <tr>
      <td><strong>Plataforma Cloud y Licenciamiento</strong></td>
      <td>Panel de control, autenticación Clerk y verificación criptográfica Ed25519 offline.</td>
      <td><a href="plataforma-cloud/arquitectura.md">Arquitectura Cloud</a></td>
    </tr>
  </tbody>
</table>

## Próximos Pasos

{% stepper %}
{% step %}
### Instalar el CLI
Instale Raigal mediante npm o ejecútelo de forma instantánea usando `npx`.
[Guía de Instalación](primer-contacto/instalacion.md)
{% endstep %}

{% step %}
### Ejecutar el primer escaneo
Ejecute `raigal scan .` para obtener una puntuación inmediata y el desglose de hallazgos.
[Inicio Rápido](primer-contacto/inicio-rapido.md)
{% endstep %}

{% step %}
### Integrar en CI/CD y Cloud
Añada la puerta de calidad a GitHub Actions o su sistema de CI preferido.
[Configuración de CI/CD](automatizacion/ci-cd.md)
{% endstep %}
{% endstepper %}
