---
name: robots-plan-change
description: Preparar un plan breve para un cambio en Robots antes de implementar. Usar al delimitar un sistema, alcance editable, contratos, criterios de aceptación y aprobación humana.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# Planificar un cambio

## Referencias

Leer [AGENTS.md](../../../AGENTS.md), las [decisiones](../../../docs/decisions.md) y la [colaboración](../../../docs/workflow/collaboration.md). Usar la [ficha de encargo y el plan breve](../../../docs/workflow/templates.md). Consultar solo las fichas de sistemas y contratos relevantes.

## Procedimiento

1. Recuperar el encargo autorizado. Identificar responsable humano, sistema, referencia base, versión de contratos, archivos editables y criterios de aceptación. Distinguir requisitos aprobados de propuestas del GDD.
2. Examinar el estado actual y los contratos necesarios. Verificar si el alcance coincide con otra intervención reservada. Una rama separada no resuelve una superposición de archivos.
3. Delimitar estado propio, vistas recibidas, fases del loop y mensajes públicos afectados. Si el cambio necesita contratos nuevos o modifica semántica, aplicar también `robots-evolve-contract`.
4. Presentar un plan breve: objetivo, archivos, exclusiones, impacto, alternativas con sus costos cuando correspondan, criterios observables y verificaciones permitidas. No convertirlo en tareas de Trello o issues sin indicación.
5. Registrar la aprobación y el alcance exacto en una fuente compartida. Esperar aprobación antes de implementar. Si la instrucción ya aprueba explícitamente ese plan y alcance, conservar esa referencia sin solicitarla otra vez.

## Comandos de consulta

Cuando exista Git, ejecutar desde el checkout asignado para identificar el estado y la base local:

```sh
git status --short
git log -1 --oneline
```

## Resultado y detención

Entregar la ficha y el plan con estado explícito: propuesto o aprobado. Señalar requisitos pendientes y evidencia consultada. Si falta información indispensable, formular una pregunta concreta y detener el trabajo hasta recibir respuesta. Planificar no habilita implementación ni elimina los requisitos de habilitación del desarrollo.
