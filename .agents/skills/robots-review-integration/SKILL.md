---
name: robots-review-integration
description: Revisar una integración de Robots frente a la base actual, detectar conflictos y recomendar soluciones para que el responsable humano decida y autorice el merge.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.1.0"
---

# Revisar e integrar un cambio

## Referencias

Leer [AGENTS.md](../../../AGENTS.md), [colaboración](../../../docs/workflow/collaboration.md), plan aprobado, versiones de contratos y reporte de verificación. Consultar los contratos y consumidores afectados.

## Procedimiento

1. Identificar rama, checkout, referencia inicial y destino vigente. Obtener la referencia actual del remoto y revisar el diff completo contra ella. Si no existe Git, declarar esa limitación.
2. Confirmar alcance y autorización. Examinar commits, archivos y cambios heredados de la base; separar el trabajo relacionado del ajeno y reportar ambos.
3. Revisar compatibilidad con contratos, productores, consumidores y cambios ya integrados. Comprobar el plan de migración cuando una ruptura lo requiera; no integrar piezas que dejen inválida la base.
4. Revisar conflictos de merge y el estado del PR. Por cada conflicto, indicar archivos y semántica afectada, alternativas viables, costes y recomendación. No escoger qué trabajo de una persona descartar.
5. Contrastar evidencias mediante `robots-verify-change`. Indicar pruebas y checks configurados que sí se ejecutaron, pendientes, fallos y riesgos. No ejecutar builds prohibidos ni presentar verificaciones inexistentes como exitosas.
6. Consultar la protección real del destino. Un PR puede enlazar issue, tarjeta o plan como contexto, pero ninguno es requisito universal para crearlo. Un segundo aprobador tampoco es requisito de este flujo; no modificar protecciones remotas sin autorización explícita.
7. Informar la revisión antes de integrar y recomendar una solución. Si el conflicto o riesgo exige elegir un comportamiento o conservar uno entre cambios incompatibles, formular la pregunta concreta y detenerse hasta que el responsable humano elija. Aplicar esa decisión, revalidar y actualizar el PR.
8. Crear o actualizar el PR solo si el usuario lo pidió. Integrar solo tras autorización explícita del responsable humano, cuando el PR sea integrable, los checks requeridos por el repositorio pasen y no queden decisiones/conversaciones pendientes. El autor puede fusionar su propio PR; no esperar una aprobación separada de otro desarrollador.
9. Confirmar que el remoto reporta el PR integrado y que el commit resultante está en la rama destino. Informar la estrategia de merge y cualquier limitación.

## Comandos de consulta

Cuando exista Git, ejecutar desde el checkout asignado para identificar rama, commit y estado local:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
```

Seleccionar después la comparación completa contra la referencia de destino verificada; estos comandos por sí solos no revisan el diff de un PR.

## Resultado y detención

Reportar base, commits, archivos, contratos, evidencias, conflictos, alternativas y recomendación. Si cambia el diff tras la revisión, reevaluar los puntos afectados. Una elección humana pendiente requiere detener solo la parte que depende de ella; continuar el trabajo independiente. No inferir autorización de merge si el usuario no la expresó.
