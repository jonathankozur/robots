# APP-001 v1 — Ensamblado y ciclo de aplicación

**Nota de fixtures NAV-001/CAT-002:** la API productiva APP-001 y su contrato v1 permanecen vigentes. La demostración consume ahora [CAT-002](content-catalog-v2.md) y `basic-v2.json`: inicialización `FixtureInitializeNavigationCooldown`, observación `FixtureEquipmentObserved` y revisión de receta `application-fixture-v2-<modo>`. Replays de la fixture anterior se rechazan como incompatibles; no cambia el formato general de replay. Ver [entrega NAV-001](../workflow/board-navigation-v1.md).

Revisión: 1.0.0, 13 de octubre de 2026. Plan y contrato autorizados mediante «comenza la implementacion». Implementación y evidencia en el [plan/entrega](../workflow/application-lifecycle-v1.md).

## Propiedad y puertos

El controlador de aplicación posee contexto actual, candidato de reemplazo, operación pendiente y recursos de infraestructura. El coordinador de arranque posee únicamente intento, identidad esperada y confirmaciones recibidas. Cada fixture posee exclusivamente su vista y operaciones propias. El adaptador de salida recibe eventos y conserva una vista inmutable para el host; el controlador no consulta snapshots privados de gameplay.

El código de producción no importa tests. Factories/handlers se registran explícitamente por código autorizado; datos JSON no eligen módulos ni ejecutan scripts. Participantes reciben Publisher y datos de configuración por mensajes, nunca Session ni implementaciones vecinas.

## Estados y operaciones del host

| Estado | Operaciones y transición |
| --- | --- |
| idle | Iniciar/restaurar fixture: preparing; cerrar: no-op idempotente. |
| preparing | Validar contenido y receta, construir y start candidato sin avanzar. Éxito: cierre previo si corresponde, luego initializing. Rechazo: volver a contexto previo/idle. Petición competidora: rechazo. |
| initializing | Paso/fase/tick conducen exclusivamente bootstrap; disponibilidad confirmada y barrera de input completada: ready. Rechazo de arranque: cierre del incompleto y faulted; excepción: faulted. Cerrar: closing. |
| ready | Paso/fase/tick y entradas permitidas. Reemplazar entre ticks: preparing. Reemplazar en tick parcial: rechazo. Cerrar: closing. Fallo técnico: faulted. |
| closing | Invalidar ingreso, close fuera de callbacks, todas las limpiezas. Completo: idle o initializing del candidato. Limpieza fallida: faulted. |
| faulted | Inspeccionar diagnóstico y cerrar/limpiar; recuperación explícita crea otro encuentro desde configuración válida después de limpiar. No continuar tick fallido. |

El controlador es externo y manual: los sistemas no leen reloj ni crean timers. No completar por iniciativa propia un tick parcial pausado. El rechazo no altera el estado privado de participantes. El estado de candidato de preflight no equivale a contexto publicado: puede estar active en Session para validar suscripciones, pero carece de avance e ingreso vivo.

## Configuración propuesta

Recipe v1: recipeId, implementationRevision, participantes/orden, contratos/fases/factories declarados por código. Request v1: requestId, identidad nueva de contexto/sesión, runtime, seed hexadecimal ENV-001, paquete CAT-001 canónico, selección de fixture y fuente inicial new/restored-fixture.

El host asigna una identidad de instancia de aplicación nueva al recrear el controlador y una generación creciente por encuentro; no reutiliza contextId dentro de esa instancia. La identidad se registra y no se genera leyendo reloj/aleatoriedad desde la simulación. Todos los campos se validan y copian. IDs de contexto/operación/participante: texto no vacío, máximo 128 unidades UTF-16. Cada intento tiene entero seguro positivo y pertenece a una generación de contexto. Participantes requeridos: lista única y ordenada, entre 1 y 32; primera receta de demostración: dos.

Propuesta de presupuesto initializationMaxTicks: entero 1..10000, default de laboratorio 10; ticks lógicos completos desde el inicio, sin reloj real. Registro de repeticiones del host: 128 operaciones completadas como máximo; al agotar, rechazo explícito de nuevas solicitudes hasta recrear el controlador, sin olvidar IDs silenciosamente. Una sola transición pendiente.

Registrar receta/revisión, fuente/formato inicial, identidad/intento, presupuesto y datos iniciales en initialState/environment/revision ya existentes. Conservar límites de payload y envoltura de Session; si exceden capacidad, rechazar candidato en preparación, sin truncar ni elevar presupuestos.

## Protocolo de inicialización, versión 1

Identidad común: contextId, attemptId, bundleId, contentRevision. Los comandos tienen un único responsable: no crear un comando genérico repartido a múltiples propietarios mediante un campo target.

| Mensaje | Tipo, productor/fase | Responsable/consumidores y recepción | Datos y semántica |
| --- | --- | --- | --- |
| BeginApplicationContext | Comando; app-bootstrap externo, input | app-coordinator, input | Identidad, requiredParticipants, presupuesto y vistas iniciales de fixture tipadas. Única raíz de arranque. |
| FixtureInitializeNavigation | Comando; app-coordinator, input | app-navigation-fixture, movement | Identidad; terrainId/passable; locomotionId/moveDurationTicks. Solo datos mínimos y unidades CAT-001. |
| FixtureInitializeCombat | Comando; app-coordinator, input | app-combat-fixture, resolution | Identidad; chassisId/integrityUnits; weaponId/impactUnits. Solo datos mínimos y unidades CAT-001. |
| ApplicationParticipantInitialized | Evento; cada fixture, su fase de recepción | app-coordinator, publication | Identidad y participantId. Confirma aceptación completa de su parte. |
| ApplicationParticipantRejected | Evento; cada fixture, su fase de recepción | app-coordinator, publication | Identidad, participantId y reason tipado. Rechazo normal del arranque. |
| ApplicationContextReady | Evento; app-coordinator, publication | app-output y participantes, input del tick siguiente | Identidad y conjunto ordenado completo de participantes confirmados. Libera la barrera para operar. |
| ApplicationInitializationRejected | Evento; app-coordinator, publication | app-output, input del tick siguiente | Identidad, reason y participantes pendientes. No habilita operaciones. |

Razones normales propuestas: PARTICIPANT_REJECTED e INITIALIZATION_LIMIT. Configuración inválida antes del arranque se comunica por puerto de control; no intentar emitir eventos desde una Session todavía no válida. Los códigos de rechazo del host distinguen INVALID_REQUEST, BUSY, REQUEST_CONFLICT, REQUEST_CAPACITY, TICK_IN_PROGRESS y WRONG_CONTEXT.

Begin debe coincidir con la identidad y el conjunto exacto de participantes de la receta validada; no puede reducir la barrera desde datos de entrada. participantId en una confirmación debe coincidir con sourceSystemId y con un participante esperado. El coordinador recibe un Begin y emite los dos comandos dentro de su handler input. Ambos mantienen la raíz entrante; las confirmaciones derivan de sus comandos. Su loop publication emite una sola decisión con causas admitidas de esa misma raíz. No reunir causas de raíces independientes ni fabricar cabeceras.

Durante tick 0 se procesan inicializaciones en movement/resolution y confirmaciones en publication; el evento de decisión de publication se entrega a input del tick 1. Todos los receptores de esa fase reciben antes de loops. Ningún propietario ejecuta operaciones de fixture antes de recibir ApplicationContextReady. El host habilita ingreso de operaciones después de completar la fase input que distribuye la decisión.

Duplicado exacto de confirmación es idempotente; identidad, participante o contenido contradictorios dentro de la sesión son un fallo técnico de protocolo, no segunda disponibilidad. Tras rechazo o ready no producir otra decisión de arranque. La falta de confirmaciones no bloquea el hilo: el coordinador cuenta ticks publication y decide al completar el horizonte configurado. Después de la decisión, no contar como timeout el tick de transporte del evento.

Vistas no se actualizan en vivo. Otro paquete/revisión requiere encuentro nuevo. Rechazar restauración ausente/incompatible, no inferir componentes ni datos. Los eventos tardíos externos llevan contexto/intento; el puente del host filtra antes de stageExternalInput y registra rechazo. El bus no enruta automáticamente mensajes entre sesiones.

## Restauración de prueba

FixtureInitialParts v1 con fixtureId/version, checkpoint de prueba/revisión común y una parte por propietario requerido. Validar forma, unicidad, revisión y correspondencia exacta con la receta; repartir vistas usando el mismo recorrido de confirmación. Las partes llegan como datos de prueba del caller, no de una base de datos.

No implementar captura ni guardado. No afirmar que ese formato es el checkpoint de inventario/expedición futuros. Tampoco reutilizar ReplayRecording como un guardado: replay reconstruye entrada inicial y vuelve a ejecutar ingresos registrados.

## Cierre y reemplazo

Validar/preparar candidato antes de destruir contexto previo. Mientras se prepara, suspender su driver sin mutar sus sistemas. Si falla preparación, limpiar candidato y restaurar disponibilidad previa. Si pasa, close previo y limpiar recursos; solamente después conducir arranque nuevo. No hay rollback tras cerrar anterior.

Cada factory de infraestructura registra recursos propios y limpieza idempotente. El host ejecuta todas las limpiezas y agrega sus fallos; no basta cerrar el bus para cancelar I/O o listeners ajenos. No publicar otro contexto si un recurso exclusivo sigue activo. El debug se drena fuera de callbacks usando adaptadores existentes; no introducir escritura de archivos en ticks.

El cierre explícito puede abortar tick parcial y conserva que no se completó. Retener evidencia como datos inmutables separados de las instancias cerradas.

## Compatibilidad y verificación

Contratos nuevos de infraestructura/fixtures, sin modificación ni reutilización semántica de los comandos CAT-001 históricos. Consumidores actuales afectados: nuevo coordinador, dos fixtures y adaptador de salida; panel consume solo su puerto público. Sistemas de gameplay todavía no reciben estas fichas como contratos definitivos.

Sin cambios a Session, fases, orden o ReplayRecording. Replay requiere receta/implementación, identidad, runtime y manifiesto idénticos, reconstruye propietarios frescos y no admite ingreso vivo. El reporte de ciclo de aplicación es evidencia aparte: replay de un encuentro no certifica una expedición completa.

Pruebas propuestas y alcance en el plan. La evidencia ejecutada y los límites constan en la entrega.

## API y concreciones implementadas

ApplicationController recibe instanceId (1..100) único asignado por el host, runtime (1..1024) y Recipe de código explícito. Métodos request, advance(step/phase/tick), stage(contextId,type,payload), close, snapshot, trace, exportReplay, loadReplay y drainDebugLog. El puerto no expone Session. Tipos públicos ApplicationSnapshot, Result, Recipe, Participant/Actor, Request y RestoredParts en src/application/index.ts.

IND-002 actualiza la API de código de montaje: `Participant.create(identity, ownResource, context)` recibe el `ActorContext` neutral y congelado de system-api, con el ID asignado por el host. Las suscripciones de Actor y `Recipe.outputTypes` declaran `{type, version}` explícitamente. Las recetas existentes migran a v1; inicializaciones y barrera APP siguen en v1, sin cambiar los contratos serializados. Ver [montaje independiente](system-independence-v1.md#versiones-e-identidad-del-actor--ind-002).

Request contiene requestId/seed/content/selection y opciones initializationMaxTicks/debug/restore; el controlador asigna contextId y attemptId crecientes. Un resultado ok es aceptación del pedido, no certificación de ready. Repetir un pedido registrado devuelve su aceptación/rechazo original incluso si ese contexto ya terminó; no lo reactiva. Pedidos transitoriamente BUSY/TICK_IN_PROGRESS no se registran como completados y pueden repetirse cuando se resuelve esa condición.

app-output es un observador registrado kind=system. El núcleo reserva kind=adapter para ingreso externo y no permite que consuma mensajes. Su vista de confirmaciones/observaciones es propia; snapshot hacia el host copia y congela datos. I/O de debug en navegador ocurre fuera del scheduler.

Las inicializaciones envuelven identidad y view. Recipe primera fixture: navegación recibe terrainId/passable/locomotionId/moveDurationTicks/count; combate recibe chassisId/integrityUnits/weaponId/impactUnits/count. count es contador de prueba no negativo, sin regla de gameplay. OperateNavigation v1 (app-bootstrap input → navegación movement) solicita delta entero seguro no negativo; FixtureObserved v1 muestra ownerId/count/amount a app-output publication. amount muestra duración de locomoción o integridad, según dueño. Estos contratos son solo de fixture.

Las confirmaciones validan identidad, participantId=sourceSystemId y correlación del Begin original, incluso después de decidir la barrera. Duplicado exacto es idempotente; conflicto de tipo/payload o raíz ajena falla técnicamente. stage valida contrato/payload antes de ingreso; una petición externa inválida no daña el encuentro sano.

El controlador monta solo en métodos síncronos y bloquea reentrada BUSY. La limpieza no acepta Promise: consume un posible rechazo para no provocar excepción sin manejar, informa CLEANUP_FAILED y conserva recurso pendiente. La validación no cancela efectos externos ya iniciados por código que incumple ese contrato.

Replay conserva formatVersion=1 y manifiesto estricto. loadReplay requiere controlador idle limpio, generación no reutilizada, formato inicial/partes/esquemas válidos y runtime/receta idénticos. Durante reproducción stage devuelve false y avanzar más allá del horizonte devuelve REPLAY_HORIZON sin dañar la sesión. No admite datos de progreso omitidos ni aplica defaults de restauración. La receta no usa streams RNG vivos en esta fixture; las futuras recetas deberán declararlos explícitamente.

El panel drena debug después de cada operación, escribe lotes JSONL por contexto en el servidor existente y retiene registros sin confirmar para reintento/descarga. El reporte del host contiene transiciones/limpieza; el journal del núcleo registra mensajes y ejecución, sin convertir errores del host en eventos simulados artificiales.
El puerto ownResource queda invalidado al terminar el montaje, incluso si una fábrica falla. Retenerlo y llamar desde callbacks produce APP_RESOURCE_CONTEXT; no agrega recursos al contexto de infraestructura durante simulación.

El host del laboratorio usa un UUID nuevo fuera de la simulación para el namespace del controlador, también tras recargar la página. No es RNG del juego; el identificador queda registrado y el replay conserva la identidad original.

La vista del observador se conserva en su propia clausura; el controlador recibe solamente el puerto observe, que devuelve una copia profunda congelada. Runtime no comparte su Set de pendientes ni diccionarios mutables entre el receptor y el controlador.

En replay, source=new recompone las vistas mediante la receta y exige igualdad con las declaradas; source=restored-fixture valida selección y correspondencia con sus partes explícitas. Esto impide que un paquete editado conserve vistas iniciales incompatibles dentro de la grabación.
