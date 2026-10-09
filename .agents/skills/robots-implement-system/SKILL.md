---
name: robots-implement-system
description: Implementar lógica de un sistema de Robots con plan y alcance aprobados. Usar una vez habilitado el desarrollo para aplicar TDD, propiedad del estado, mensajería determinista y aislamiento entre sistemas.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# Implementar un sistema

## Precondiciones y referencias

Leer [AGENTS.md](../../../AGENTS.md), el encargo y su aprobación, la ficha del sistema, los contratos aplicables y las [decisiones de habilitación](../../../docs/decisions.md). Consultar [sistemas](../../../docs/architecture/systems.md), [mensajería](../../../docs/architecture/messaging-v1.md) y [límites externos](../../../docs/architecture/external-boundaries.md).

Confirmar motor, lenguaje y requisitos de la etapa autorizada. El desarrollo de infraestructura del bus y el de sistemas del juego tienen requisitos distintos en las decisiones. Usar rama y checkout separados, una reserva de alcance vigente y una base identificada.

## Procedimiento

1. Revisar cambios existentes y comandos de verificación antes de usarlos. No sobrescribir trabajo ajeno. Si una prueba compila o dispara un build, la prohibición de builds impide ejecutarla sin excepción humana explícita.
2. Para cada conducta nueva, escribir primero una prueba significativa. Ejecutarla mediante el comando autorizado y comprobar que falla por la conducta faltante; errores de entorno no acreditan esa falla.
3. Implementar lo mínimo dentro de los archivos aprobados. Mantener estado propio, vistas recibidas con vigencia definida y dependencias limitadas a contratos y utilidades puras. No acceder a instancias o estado mutable de otro sistema.
4. Respetar bandejas, fases, orden estable y datos inmutables. Mantener decisiones de juego fuera del bus. No introducir reloj real, ritmo visual, I/O bloqueante ni resultados externos sin entrada admitida.
5. Ejecutar las verificaciones permitidas y refactorizar con las pruebas aprobadas. No sustituir TDD con una afirmación de revisión visual ni ejecutar builds tras cambios.
6. Actualizar la ficha del sistema si cambió dentro del alcance aprobado. Aplicar `robots-verify-change` y entregar evidencia con el [reporte de entrega](../../../docs/workflow/templates.md#reporte-de-entrega).

## Comandos de consulta

Cuando exista Git, consultar desde el checkout asignado. El primer comando incluye archivos nuevos; el segundo lista cambios locales rastreados y no sustituye la revisión del alcance completo:

```sh
git status --short
git diff --name-only
```

El comando de pruebas se define con la tecnología elegida; inspeccionar primero si ejecuta compilación o builds.

## Resultado y detención

Reportar archivos, comportamiento, versión de contratos, pruebas ejecutadas y limitaciones. Si hace falta cambiar contratos o ampliar alcance, presentar impacto mediante `robots-evolve-contract` antes de efectuar esa parte. Si falta una precondición, aprobación o excepción para verificar, informar el impedimento; al solicitar respuesta, detenerse y esperar. No crear PR, integrar ni publicar sin autorización para esa acción.
