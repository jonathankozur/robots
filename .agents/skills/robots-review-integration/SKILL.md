---
name: robots-review-integration
description: Revisar la integración de un cambio de Robots antes de la revisión humana. Usar para examinar diff, base actual, contratos, migración, pruebas y protecciones, sin sustituir la aprobación de otra persona.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# Revisar integración

## Referencias

Leer [AGENTS.md](../../../AGENTS.md), [colaboración](../../../docs/workflow/collaboration.md), plan aprobado, versiones de contratos y reporte de verificación. Consultar los contratos y consumidores afectados.

## Procedimiento

1. Identificar rama, checkout, referencia inicial y referencia actual del destino. Revisar el diff completo del cambio frente a esa base. Si no existe Git, declarar esa limitación; no simular una revisión de integración con un inventario de archivos.
2. Confirmar alcance, responsable humano, aprobación del plan y reserva de archivos. Detectar cambios ajenos, conflictos y modificaciones de reglas, contratos o configuración sin autorización.
3. Examinar compatibilidad con otros cambios ya integrados y consumidores afectados. Para una ruptura, exigir migración aprobada y evidencia de que el conjunto se integra coherentemente; no aprobar piezas que dejen inválida la base.
4. Comprobar evidencias y criterios mediante `robots-verify-change`. Identificar validaciones pendientes, fallas y riesgos concretos. No ejecutar builds ni presentar verificaciones no ejecutadas como exitosas.
5. Si hay repositorio remoto, comprobar las protecciones y verificaciones reales aplicables. Su mención en documentación no demuestra que estén activas. No inventar colaboradores ni configurar recursos remotos sin autorización.
6. Entregar hallazgos con archivo, evidencia, impacto y corrección sugerida. Indicar si el cambio está preparado para revisión humana o tiene impedimentos. Solo crear un PR si esa acción fue autorizada; su integración requiere revisión de otra persona y autorización correspondiente.

## Comandos de consulta

Cuando exista Git, ejecutar desde el checkout asignado para identificar rama, commit y estado local:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
```

Seleccionar después la comparación completa contra la referencia de destino verificada; estos comandos por sí solos no revisan el diff de un PR.

## Resultado y detención

Reportar base revisada, contratos, evidencias, hallazgos y pendientes. Cambiar de rol o realizar una segunda revisión automática no aporta una aprobación humana. Si cambia el diff tras la revisión, reevaluar los puntos afectados y renovar la revisión humana cuando corresponda. Al solicitar una resolución humana, detenerse y esperar.
