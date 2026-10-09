---
name: robots-verify-change
description: Verificar un cambio de Robots frente a su plan, contratos y criterios de aceptación. Usar para comprobar aislamiento, fases, determinismo, fallos y evidencia, diferenciando lo ejecutado de lo pendiente.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# Verificar un cambio

## Referencias

Leer [AGENTS.md](../../../AGENTS.md), el plan aprobado y su alcance, los contratos afectados y los [escenarios de aceptación](../../../docs/workflow/acceptance.md). Utilizar el [reporte de entrega](../../../docs/workflow/templates.md#reporte-de-entrega).

## Procedimiento

1. Relacionar cada criterio de aceptación con evidencia necesaria: inspección, prueba ejecutable o comprobación manual. Revisar comandos y efectos antes de ejecutarlos. No ejecutar builds ni comandos que compilen indirectamente sin excepción explícita.
2. Comparar archivos modificados con el alcance autorizado y la base identificada. Revisar propiedad del estado, dependencias y contratos; registrar cualquier ampliación no aprobada.
3. Para lógica de simulación, comprobar los escenarios pertinentes: comando con un responsable, eventos a consumidores declarados, entrega por fases, ausencia de reentrada, orden estable, vistas vigentes, aislamiento de sesiones y cierre.
4. Para determinismo o adaptadores, verificar entradas registradas, ausencia de reloj real e I/O dentro del tick, trazas causales, fallos visibles y checkpoints coherentes. No prometer determinismo en entornos que no fueron definidos o comprobados.
5. Ejecutar únicamente verificaciones pertinentes, autorizadas y disponibles. Registrar comando o procedimiento, entorno, resultado y evidencia. Una prueba no ejecutada queda pendiente o bloqueada con motivo, nunca aprobada.
6. Para documentación y skills, revisar formato, enlaces, coherencia de reglas e importaciones. Distinguir comprobación estática de descubrimiento real en Codex, Claude Code y Gemini CLI; el segundo exige sesiones efectivas de cada herramienta.

## Comandos de consulta

Cuando exista Git, estos comandos identifican el estado local y errores de formato del diff sin ejecutar un build. No acreditan comportamiento del juego ni comprueban todos los commits del cambio:

```sh
git status --short
git diff --check
```

Elegir pruebas conductuales según el plan, la tecnología y los permisos vigentes.

## Resultado y detención

Entregar criterios con estado aprobado, fallido o pendiente; hallazgos con evidencia y limitaciones. No corregir fuera del alcance ni convertir una revisión en autorización de integración. Si una respuesta humana es indispensable, preguntar y detenerse hasta recibirla. La revisión de un agente no sustituye la revisión humana.
