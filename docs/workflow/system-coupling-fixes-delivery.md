# IND-002 — Entrega de correcciones de acoplamiento

Fecha: 14 de octubre de 2026. Responsable humano: Jonathan Kozur. Base: `44038c9e1b5ea98d0479bf4c5ffaf9cab1b69e57`. Rama: `codex/fix-system-coupling`, en `C:/dev/robots`.

Estado: **implementación local completa, entregada para revisión; sin integrar**. [Plan aprobado](system-coupling-fixes-v1.md), [tarjeta IND-002](https://trello.com/c/P79xHzcu), [revisión que originó el encargo](../reviews/system-independence-2026-10-14.md). El responsable aprobó el plan y las interfaces mediante «aprobado» en esta conversación.

## Conducta resultante y compatibilidad

| Punto | Corrección | Evidencia |
| --- | --- | --- |
| Orden global mutable | PHASES se congela en ejecución | Intentos de invertir, sustituir y agregar fases rechazados; sesiones activas/nuevas ejecutan el orden de su manifest |
| Alias de esquemas APP | Ambas fábricas devuelven copias profundas congeladas | Modificar el objeto original no cambia la definición; llamadas diferentes no comparten esquemas mutables; hosts distintos siguen arrancando |
| Versión fijada a 1 | MessageReference y suscripciones Actor declaran tipo/versión; el host usa esas versiones | Selección independiente de v1/v2, observación v2, rechazo de versión desconocida/omitida y replay idéntico |
| Identidad fija NAV/PRE | Host entrega ActorContext congelado; las fábricas capturan el ID asignado | nav-a/pre-a y nav-b/pre-b funcionan en sesiones independientes, resuelven movimientos y conservan causalidad/replay |

Las recetas y wrappers existentes se migraron conjuntamente. `Recipe.outputTypes` pasa de strings a referencias `{type, version}`; `Participant.create` recibe el contexto como tercer argumento y conserva `ownResource` como segundo. Las fábricas NAV/PRE lo reciben como segundo argumento mediante wrappers explícitos. Sus llamadas directas mantienen los nombres predeterminados anteriores.

Cambian interfaces de código TypeScript. No cambian nombres, versiones ni payloads de NAV v1, PRE v1, APP v1, CAT v2 o BUS, ni fases, permisos, budgets, política de fallos o semántica de entrega. Las 17 referencias históricas de equivalencia permanecen sin modificaciones y pasan, incluyendo manifests, resultados, trazas causales y replay.

## Alcance modificado

- API y esquemas: `packages/system-api/src/index.ts`, `packages/protocol/src/application/v1.ts`.
- Host: `packages/application-host/src/contracts.ts`, `assembly.ts`, `bindings.ts`.
- Sistemas: `packages/navigation/src/actor.ts`, `packages/presentation/src/actor.ts`; pruebas propias de ambos paquetes.
- Consumidores y evidencia: fixtures APP/NAV/PRE en `tests/core/`, wrappers de `application-replay.test.ts`, composición en `tests/packages/composition.test.ts` y nueva `tests/packages/coupling.test.ts`.
- Documentación: arquitectura de independencia, ciclo APP y navegación, plan y esta entrega.

No se cambiaron dependencias, manifests npm, configuración, runtime, assets ni reglas de juego. Los archivos locales ajenos y el informe de revisión previo se conservaron.

## TDD y verificaciones ejecutadas

Entorno: Windows, Node **v24.14.0**, TypeScript **5.9.3** instalado en el workspace. No se ejecutó ningún build.

Evidencia RED antes de las correcciones correspondientes:

- La mutación de PHASES no arrojaba el TypeError esperado; el test restauró el array para evitar contaminar otras pruebas.
- Las fábricas APP compartían `requiredParticipants`; los cambios a los esquemas del llamador aparecían en las definiciones devueltas.
- Un actor que declaraba v2 recibió el valor de v1 (`11` en lugar de `22`). El host rechazaba las referencias explícitas de salida con `CONTRACT_INVALID`.
- Tras corregir versiones, el montaje con IDs personalizados falló con `APP_PARTICIPANT`: las confirmaciones usaban los IDs predeterminados.

Las correcciones llevaron esas pruebas a GREEN. También se comprobaron captura de identidad frente a mutación del contexto original, rechazo de dos responsables del mismo comando y conservación de las capacidades del puerto de recursos.

| Comando | Resultado final |
| --- | --- |
| `npm test` | **257/257 aprobadas**, incluida la ejecución/comprobación de tipos de los nueve paquetes aislados |
| `npm run typecheck` | Aprobado; `tsc --noEmit` en raíz, sin artefactos emitidos |
| `npm run typecheck:packages` | Aprobado para los nueve paquetes, siempre con `--noEmit` |
| `node --test tests/packages/coupling.test.ts tests/packages/composition.test.ts tests/core/migration-equivalence.test.ts` | 29/29 en la primera regresión dirigida; las pruebas posteriores también están incluidas en el resultado final de 257 |
| `git diff --check` | Aprobado |

La primera comprobación de tipos señaló dos wrappers que no pasaban el nuevo tercer argumento y anotaciones del test de PHASES/esquemas; se corrigieron y la comprobación final pasó. No se relajaron guardas de arquitectura ni se actualizaron referencias para ocultar diferencias.

## Límites, revisión e integración

- La selección multiversión cubre suscripciones de actores y observaciones del host. La inicialización/activación APP sigue en v1; la interfaz externa `stage(contextId, type, payload)` no se amplió en este encargo.
- Los comandos conservan responsable único por tipo/versión. IDs personalizados no habilitan dos navegaciones que consuman el mismo comando en una sesión.
- `snapshot().observations` conserva el último payload por productor, no un historial por tipo/versión.
- La verificación actual acredita el entorno Node. No se hizo una nueva comprobación manual de navegador ni se amplía la garantía a otros runtimes.
- No se implementó reversa de simulación. Las referencias existentes prueban replay hacia adelante.
- Revisión humana e integración pendientes. Esta autorización no incluyó commit, push, PR ni merge. La tarjeta pasa a Revisión / pruebas.
- Recuperación: las modificaciones siguen locales sobre la base indicada. Una reversión debe seleccionar únicamente este alcance y preservar el trabajo ajeno.

## Contexto para continuar

**Objetivo:** eliminar los cuatro acoplamientos de la revisión anterior. **Instrucciones:** trabajar en C:/dev/robots, rama propia, sin builds; plan explícitamente aprobado. **Descubrimientos:** readonly de TypeScript no protege valores globales en ejecución; los selectores de versión y los IDs deben llegar desde el montaje sin introducir capacidades de sistemas vecinos. **Realizado:** cuatro correcciones, migración de consumidores, evidencia RED/GREEN, 257 pruebas y tipos sin emisión aprobados. **Siguiente paso:** revisión humana y, si se autoriza, commit/push/PR/integración contra la base remota actual. **Archivos clave:** plan aprobado, esta entrega, system-api, fábricas APP, assembly/bindings y coupling.test.ts.

Engram no está disponible; este documento y la tarjeta conservan el contexto compartido. No se afirma haber guardado memoria externa.
