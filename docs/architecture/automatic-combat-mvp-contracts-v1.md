# COM-001 — Contratos completos del MVP

Revisión: **1.0.0 aprobada para implementación**. Fecha: **15 de octubre de 2026**. Responsable humano: Jonathan Kozur. Ejecutor de la implementación e integración futura: Codex.

Las decisiones de comportamiento del [diseño](automatic-combat-mvp-design-v1.md) están aprobadas. Este documento concreta los mensajes y las utilidades públicas; **el paquete 1.0 fue aprobado conjuntamente el 15 de octubre de 2026** e implementado en la rama del encargo. Encargos y reservas: [plan 1.0](../workflow/automatic-combat-mvp.md). Propiedad del estado y algoritmos: [fichas de sistema](automatic-combat-mvp-systems-v1.md).

## 1. Convenciones normativas de todas las fichas

Cada apartado de mensaje se completa con estas reglas comunes y con la fila de rutas de la sección 3. Todos los campos de los esquemas son obligatorios salvo el sufijo ?. Los objetos rechazan campos desconocidos. Las cargas son copias inmutables, JSON, sin funciones ni referencias de implementación. La notación de esquema es abreviada: ...AttackRef expande los cinco campos de esa fila y [0..N] indica un límite de colección; no es código TypeScript compilable.

| Tipo o regla | Definición exacta |
| --- | --- |
| Id | String ASCII que cumple [a-zA-Z0-9._-]{1,64}; robot, equipo, tablero, slot y battleId. |
| ContextId | String no vacío de hasta 128 caracteres; coincide con sessionId y con la identidad APP del encuentro. battleId es un ID de escenario, no reemplaza esa identidad. |
| CatalogId | String ASCII con prefijo de familia, hasta 128 caracteres; conserva las reglas de CAT-002. |
| Códigos cerrados | Status, stage, outcome, reason, actionKind, behaviorId y reasonCode solo admiten los valores enumerados en su ficha; los códigos textuales tienen máximo 64 caracteres. |
| U / P | Entero seguro de 0 a Number.MAX_SAFE_INTEGER / de 1 a ese máximo. |
| Hex | Objeto {q: U, r: U}; dentro del tablero cuando representa una posición. No se amplía la geometría de NAV. |
| Status | ACTIVE o DEFEATED. ACTIVE exige integridad positiva; DEFEATED exige integridad cero. |
| Combatant | {robotId: Id, teamId: Id, integrityUnits: U, maxIntegrityUnits: P, status: Status}; integrityUnits <= maxIntegrityUnits. |
| AttackRef | {battleId: Id, attackerRobotId: Id, weaponSlotId: Id, targetRobotId: Id, requestSequence: P}. La secuencia es por robot emisor y contexto; hay una única arma por robot. |
| Roster | Exactamente dos Combatant, IDs de robot y equipo diferentes, ordenados por robotId mediante comparación de cadenas por unidades de código, sin localeCompare. |
| Cantidades | Integridad e impacto en unidades enteras ENV-001; 1000 unidades representan 1 punto mostrado. No hay fórmulas, probabilidades ni redondeos adicionales. |
| Colecciones | Robots/armas/sensores/perfiles: exactamente 2; visibles por robot: 0–1; montajes visuales por robot: máximo 5; historial de UI: máximo 64; movimientos en una vista: máximo 2. |
| Validación | FieldRule del bus comprueba forma y límites. Sus tipos actuales no expresan enums, longitudes mínimas ni relaciones entre campos: validadores puros del subpath público comprueban esas invariantes y se ejecutan en productor/consumidor. No se amplía system-api ni el runtime. |
| Fallo de contrato | Enum desconocido, identidad contradictoria, revisión imposible, combinación de campos inválida o causa ajena al encuentro: ProtocolError y sesión detenida. No se transforma en rechazo de negocio ni en empate. |
| Ausencia | Antes de la vista inicial requerida se espera; no se inventan datos. La receta productiva exige todos los proveedores y las barreras descritas abajo. Un salto en un flujo ya inicializado es fallo, no una ausencia normal. |
| Cabecera | BUS-001/002, sin cambios. Un sourceMessageId dentro de una proyección referencia un hecho recibido; no duplica la identidad del mensaje que contiene la proyección. |

Códigos técnicos nuevos: COM_PAYLOAD_INVALID para invariantes de esquema que no expresa FieldRule; COM_IDENTITY_INVALID para sesión/intento/raíz incorrectos; COM_VIEW_CONFLICT para revisiones o datos contradictorios; COM_LIFECYCLE_INVALID para inicialización/activación/publicación única repetida; COM_CAPACITY_EXCEEDED para colas/buffers locales agotados. Se conservan los errores NUMERIC_* de las utilidades existentes. BATTLE_START_LIMIT, DECISION_ACK_MISSING, DECISION_ACK_INVALID y HEX_LOS_INVALID se detallan en sus fichas. Estos errores detienen la sesión; no son resultados normales de combate.

Los subpaths nuevos serán damage/v1, weapons/v1, perception/v1, decision/v1, battle/v1 y presentation/v2 en @robots/protocol. Cada uno exporta DTO, campos iniciales, definiciones de sus mensajes y validadores puros de contrato. Las definiciones solo contienen type/version/kind/fields; los permisos concretos pertenecen a la composición. No se crea un modelo agregado del juego en el índice del protocolo.

AttackRef pertenece al contrato público weapons/v1; damage/v1 puede reutilizar sus campos sin depender del actor de armas. Combatant pertenece a damage/v1; battle/v1 y presentation/v2 pueden reutilizarlo. No hay imports circulares entre subpaths.

## 2. Inicialización, raíz causal y vigencia

APP-001 se conserva. BeginApplicationContext y los seis comandos siguientes se construyen con initializationDefinition; la receta aporta INITIAL_FIELDS. Las definiciones de inicialización no se agregan por segunda vez a recipe.contracts, porque assemble ya las registra.

Todos llevan la identidad APP exacta {contextId, attemptId, bundleId, contentRevision} y una propiedad view con estos campos:

| Comando v1; responsable | Campos exactos de view | Recepción / confirmación |
| --- | --- | --- |
| InitializeDamageRoster; damage | {battleId: Id, robots: [{robotId: Id, teamId: Id, integrityUnits: P, maxIntegrityUnits: P}]} | resolution; ApplicationParticipantInitialized@1 en resolution. Dos robots, HP <= máximo; el escenario nuevo usa HP máximo. |
| InitializeWeapons; weapons | {battleId: Id, boardId: Id, weapons: [{robotId: Id, weaponSlotId: Id, impactUnits: P, reloadTicks: P, rangeHexes: P}]} | action; confirmación en action. Una entrada por robot. |
| InitializePerception; perception | {battleId: Id, boardId: Id, sensors: [{robotId: Id, rangeHexes: U}]} | perception; confirmación en perception. |
| InitializeDecision; decision | {battleId: Id, boardId: Id, robots: [{robotId: Id, behaviorId: string, weaponSlotId: Id, rangeHexes: P}]} | decision; confirmación en decision. behaviorId es fixture.observe-v1 o fixture.pressure-v1. |
| InitializeBattle; battle | {battleId: Id, boardId: Id, participants: [{robotId: Id, teamId: Id}], maxBattleTicks: P, startMaxTicks: P} | resolution; confirmación en resolution. El loop de battle sigue siendo publication. |
| InitializeCombatPresentation; presentation | {battleId: Id, boardId: Id, assemblies: Assembly[2]} | action; confirmación en action. Assembly conserva la forma PRE-001, con hasta 5 partes y montajes únicos. |

El productor de todos es app-coordinator en input. El único responsable es el indicado por el binding; los IDs de la tabla son los elegidos por la receta, no constantes ocultas en las fábricas. InitializeNavigationBoard@1 conserva BOARD_FIELDS y su recepción en movement.

Estas seis fichas son comandos: solicitan preparar estado propio, no empezar la pelea. Su vigencia es el intento APP indicado; nunca se reutilizan en otro contexto. La confirmación conserva como causa el comando recibido. Un rechazo semántico de configuración emite ApplicationParticipantRejected@1 con reason del propietario, antes de activar el actor. Identidad incorrecta, segunda inicialización o activación contradictoria son fallos de protocolo. El host reúne confirmaciones o rechazos mediante su contrato actual.

Los reason de configuración son, respectivamente: DAMAGE_CONFIG_INVALID, WEAPONS_CONFIG_INVALID, PERCEPTION_CONFIG_INVALID, DECISION_CONFIG_INVALID, BATTLE_CONFIG_INVALID y PRESENTATION_CONFIG_INVALID. No se alteran los enums ni el esquema genérico APP: estos son valores emitidos por los participantes nuevos.

Ejemplo común: Begin se admite en input del tick 0; las inicializaciones llegan a fases posteriores del mismo tick, incluidas InitializeBattle en resolution. Las confirmaciones llegan a publication 0 y el coordinador emite ApplicationContextReady@1. Todos los actores reciben la activación en input 1. Una copia para otro attemptId se rechaza sin producir roster, movimiento o combate. Escenarios de aceptación: C01 y C11.

### Una raíz causal por encuentro

El bus existente rechaza combinar mensajes con correlationId diferentes (packages/runtime/src/messaging/bus.ts). Por ello:

1. BeginApplicationContext es la única raíz del encuentro. Confirmaciones, ApplicationContextReady y NavigationWorldReady conservan esa raíz.
2. DamageRosterInitialized usa como causa la activación APP guardada. BattleStarted usa activación, mundo inicial y roster, todos de la misma raíz.
3. Cada observación conserva BattleStarted y las últimas causas recibidas que fundamentan su vista, eliminando duplicados por messageId. Solicitudes y explicaciones de IA conservan la observación vigente; un movimiento puede incluir la última confirmación de posición propia de esa misma raíz.
4. Armas conserva RequestAttack como causa tanto de AttackAccepted como de ImpactRequested. Son dos salidas hermanas; no se intenta construir un Message a partir del ID numérico devuelto por emit.
5. Cada resultado de daño conserva su ImpactRequested. BattleFinished conserva las causas recibidas que fundamentaron el arranque y los últimos hechos de daño usados para el resultado; al límite conserva las causas recibidas del arranque y el último estado de daño disponible. El puerto devuelve el ID de una emisión, no un Message admitido: no se reconstruye un Message de BattleStarted para usarlo como causa ni se añade una ruta hacia el propio productor.
6. La proyección conserva las causas recibidas que aplica en ese corte; en un tick sin cambios conserva como causa el último mensaje de batalla aplicado o el roster inicial. No usa causes: [] para estos loops.

Se conservan objetos Message admitidos únicamente para el pequeño conjunto de causas vigentes; no se guarda la traza completa en cada actor. Una fuente sintética de evaluación debe respetar esa misma raíz o probar explícitamente el fallo. No se cambia la regla de correlación del bus para permitir esta composición.

### Vistas recibidas

El mundo inicial NAV tiene boardRevision 0; cada movimiento aceptado y no duplicado incrementa esa revisión y la del robot según NAV-001. Los receptores aplican todos los resultados confirmados en orden; un rechazo no actualiza el mundo. Un salto o contradicción detiene el contexto.

DamageRosterInitialized tiene damageRevision 0. Cada ImpactResolved no duplicado incrementa exactamente una vez la revisión global de resoluciones de daño; ImpactRejected no la incrementa. El receptor exige siguiente revisión y compatibilidad de máximo/status. Los duplicados se ignoran antes de comprobar continuidad.

Las revisiones y los últimos valores se conservan hasta fin/cierre del contexto. No caducan por reloj real ni por un tick sin cambios. Una observación sí caduca al terminar su observedTick y debe renovarse antes de otra decisión/ataque.

## 3. Matriz completa de producción y consumo

Las siguientes rutas son las de la receta del juego. Todos los nombres nuevos de esta tabla son v1 salvo PresentationViewPublished@2. t es el tick de emisión. Los comandos tienen un único responsable; el resto son eventos.

| Mensaje | Productor / fase | Consumidores / fase de recepción y tick |
| --- | --- | --- |
| NavigationWorldReady@1, existente | navigation / input | perception: perception t; decision: decision t; weapons: action t; battle: publication t; presentation: action t. |
| RequestNavigationStep@1, existente, comando | decision / decision | navigation: movement t, responsable único. Sin permiso para app-bootstrap. |
| NavigationStepResolved@1, existente | navigation / movement | perception: perception t+1; decision: decision t+1; weapons: action t; presentation: action t. |
| DamageRosterInitialized | damage / resolution | perception: perception t+1; weapons: action t+1; battle: publication t; presentation: action t+1. |
| RobotObservationPublished | perception / perception | decision: decision t; weapons: action t. La UI no usa esta observación para decidir. |
| RequestAttack, comando | decision / decision | weapons: action t, responsable único. Sin permiso para app-bootstrap. |
| AttackAccepted | weapons / action | decision: decision t+1; presentation: action t+1. |
| AttackRejected | weapons / action | decision: decision t+1; presentation: action t+1. |
| AIDecisionPublished | decision / decision | presentation: action t. |
| ImpactRequested, comando | weapons / action | damage: resolution t, responsable único. |
| ImpactResolved | damage / resolution | battle: publication t; perception: perception t+1; weapons: action t+1; presentation: action t+1. |
| ImpactRejected | damage / resolution | presentation: action t+1. No cambia estado de arma ni batalla. |
| BattleStarted | battle / publication | perception: perception t+1; decision: decision t+1; weapons: action t+1; damage: resolution t+1; presentation: action t+1. |
| BattleFinished | battle / publication | perception: perception t+1; decision: decision t+1; weapons: action t+1; damage: resolution t+1; presentation: action t+1. |
| PresentationViewPublished@2 | presentation / action | app-output: publication t; el adaptador lee snapshot después de completar el tick. |

Las suscripciones comunes APP son las de assemble: inicialización a la fase del participante y ApplicationContextReady a input. No hay suscripción de UI a comandos combatientes ni acceso a publishers de los actores desde el navegador. Todos los handlers terminan de actualizar vistas/encolar solicitudes antes de evaluar reglas en su loop.

## 4. Fichas de mensajes de combate

### DamageRosterInitialized@1

Evento de damage que informa el estado defensivo inicial tras APP. Payload:

~~~typescript
{ battleId: Id, effectiveTick: U, damageRevision: 0, robots: Roster }
~~~

Se emite una sola vez en el primer loop resolution después de la activación APP; effectiveTick es ese tick. Sus causas y consumidores son los de las secciones 2–3. battle espera este roster y el mundo antes de declarar inicio; el resto no infiere HP del catálogo. Robots ausentes/equipos incompatibles son fallo. Un segundo roster, incluso idéntico, viola la publicación única y produce COM_LIFECYCLE_INVALID. Es un contrato nuevo, sin migración de datos previos.

Ejemplo: activación en input 1, roster en resolution 1, battle lo recibe en publication 1 y perception en perception 2. Evidencia prevista: C01, C02 y C11.

### RobotObservationPublished@1

Evento de perception con un snapshot explícito por observador, calculado antes del movimiento de ese tick:

~~~typescript
{
  battleId: Id, boardId: Id, robotId: Id, observedTick: U,
  worldTick: U, boardRevision: U, damageRevision: U,
  self: { position: Hex, robotRevision: U, status: Status },
  visibleRobots: [{
    robotId: Id, teamId: Id, position: Hex, robotRevision: U,
    status: "ACTIVE", distanceHexes: P
  }]
}
~~~

worldTick es el último effectiveTick de navegación recibido, no una promesa de que hubo un movimiento en el tick anterior. observedTick es el tick actual de perception; su observación solo habilita comandos durante ese mismo tick. Lista vacía significa que no hay oponente activo visible; no significa posición cero. Con sensor/mundo/roster ausentes no se publica observación. Durante batalla activa y con fuentes válidas se publica para ambos robots en cada tick; después del final no se publica.

La visibilidad exige distancia <= sensor.rangeHexes y hasLineOfSight. No hay memoria de objetivos ocultos, detección probabilística ni bloqueo por robots. decision descarta posiciones ajenas recibidas por NAV; solo usa esta observación para elegir un rival. weapons conserva la última observación por atacante para comprobar que el objetivo era visible y después revalida su geometría actual.

Ejemplo: worldTick 10, observedTick 12 y sin movimientos en 11 son válidos. Usarla para una orden en tick 13 genera STALE_OBSERVATION. Una pared intermedia produce visibleRobots vacío. Evidencia: C04 y C05.

### RequestAttack@1

Comando de decision dirigido únicamente a weapons. Solicita atacar con el arma inicializada:

~~~typescript
{ ...AttackRef, observationTick: U }
~~~

La causa incluye la observación correspondiente. observationTick debe ser el tick de la evaluación; el objetivo debe figurar en esa observación vigente y ser del bando opuesto. La solicitud no garantiza impacto ni daño. Como máximo se emite una por robot/tick; puede coexistir con un RequestNavigationStep del mismo robot. weapons encola el comando y evalúa luego de recibir también los movimientos de esa fase.

Cada solicitud nueva produce exactamente AttackAccepted o AttackRejected. Al aceptar se emite además un ImpactRequested. El registro idempotente se indexa por robot emisor y contexto, conserva 64 cuerpos/resultados y un máximo de secuencia: repetir cuerpo/secuencia devuelve el resultado con duplicate=true sin volver a consumir recarga ni pedir impacto; cambiar el cuerpo da REQUEST_CONFLICT; una secuencia olvidada da REQUEST_EXPIRED. IDs no configurados se rechazan sin crear claves ilimitadas en el registro. Hay dos flujos configurados.

Ejemplo: solicitud en decision 20 y movimiento del objetivo en movement 20 se evalúan con la posición confirmada en action 20; puede dar OUT_OF_RANGE aunque la observación inicial estuviera en alcance. Evidencia: C03 y C05.

### AttackAccepted@1

Evento nuevo de weapons que confirma aceptación, NO daño aplicado:

~~~typescript
{ ...AttackRef, observationTick: U, acceptedTick: U, readyAtTick: P, duplicate: boolean }
~~~

acceptedTick coincide con action de aceptación; readyAtTick = acceptedTick + reloadTicks mediante aritmética segura. decision usa este dato del propietario para su vista de recarga, incluso si el impacto se rechaza después. presentation puede explicar el ataque sin tratar el comando de impacto como evento público. El evento conserva RequestAttack como causa. Un duplicado conserva los ticks originales y no dispara otro efecto visual.

Este mensaje completa la propuesta anterior: evita que IA/UI deduzcan la aceptación a partir de daño posterior o envíen órdenes durante toda la recarga. Alternativa evaluada: intentar en cada tick y mostrar WEAPON_NOT_READY; es más simple pero genera rechazos repetidos y no informa aceptación por sí misma. Se aprobó e implementó la confirmación explícita.

Ejemplo: aceptación en 20, reloadTicks 20, readyAtTick 40; un ImpactRejected en resolution 20 no cambia 40. Evidencia: C03, C05 y C08.

### AttackRejected@1

Evento de weapons, resultado normal sin impacto nuevo ni consumo nuevo de recarga:

~~~typescript
{ ...AttackRef, resolvedTick: U, reasonCode: string, duplicate: boolean }
~~~

Motivos estables: BATTLE_NOT_STARTED, BATTLE_FINISHED, ATTACKER_UNKNOWN, TARGET_UNKNOWN, WEAPON_UNKNOWN, SELF_TARGET, FRIENDLY_TARGET, ATTACKER_DEFEATED, TARGET_DEFEATED, VIEW_NOT_READY, STALE_OBSERVATION, TARGET_NOT_VISIBLE, OUT_OF_RANGE, LINE_BLOCKED, WEAPON_NOT_READY, REQUEST_CONFLICT, REQUEST_EXPIRED. Se evalúan en ese orden, salvo que la consulta de idempotencia válida precede a la reevaluación. La vigencia de observación se comprueba antes de geometría; todas las posiciones y HP recibidos se aplican antes del loop.

Cada rechazo conserva su solicitud como causa. Un duplicado del mismo rechazo conserva resolvedTick. No se presenta como daño. Ejemplo: tick 39 frente a readyAtTick 40 da WEAPON_NOT_READY; tick 40 permite aceptar si el resto es válido. Evidencia: C03 y C05.

### AIDecisionPublished@1

Evento explicativo de decision; no es un comando ni un estado de daño:

~~~typescript
{
  battleId: Id, robotId: Id, decisionTick: U,
  actionKind: "MOVE" | "ATTACK" | "WAIT", reasonCode: string,
  observationTick?: U, targetRobotId?: Id, requestSequence?: P
}
~~~

MOVE/ATTACK requieren observación vigente, objetivo y secuencia de su comando correspondiente. MOVE usa APPROACH_ADJACENT o APPROACH_WEAPON_RANGE; ATTACK usa TARGET_IN_RANGE. WAIT omite requestSequence; admite NO_OBSERVATION, NO_VISIBLE_TARGET, NO_PATH, MOVEMENT_COOLDOWN o WEAPON_COOLDOWN. NO_OBSERVATION omite observationTick y objetivo; NO_VISIBLE_TARGET conserva observationTick pero omite objetivo. Las otras esperas conservan ambos. En ausencia de observación la causa es BattleStarted; en las demás, la observación.

Un robot puede publicar MOVE y ATTACK, en ese orden, en una misma evaluación si ambas acciones son posibles. WAIT solo se publica si no envió ninguna acción y cambió su explicación respecto de la anterior; no llena el historial cada tick durante la misma recarga. Los comandos se emiten antes de sus explicaciones, de modo que las secuencias ya existen. No se publica después del final.

Ejemplo: observe avanza hacia adyacencia y también ataca si su observación ya estaba en alcance y su arma lista; pressure deja de acercarse al estar en alcance. Evidencia: C06 y C08.

### ImpactRequested@1

Comando cuyo único responsable es damage; productor weapons:

~~~typescript
{ ...AttackRef, acceptedTick: U, impactUnits: U }
~~~

Se emite en la misma action que AttackAccepted y llega a resolution de ese tick. Para una solicitud nueva, acceptedTick coincide con el tick/cabecera de emisión. Una repetición idempotente reconocida conserva los ticks y resultado originales, antes de reevaluar su vigencia. impactUnits usa el valor del arma validada; cero está permitido estructuralmente para expresar NON_POSITIVE_IMPACT como rechazo de negocio. Negativos, decimales o identidad temporal falsa son violaciones de contrato.

damage no revalida línea de visión, alcance ni recarga: son propiedad de armas. Valida estado de batalla y los participantes al COMIENZO de resolution, conserva una instantánea de quién estaba activo y resuelve el lote. Cada solicitud única genera ImpactResolved o ImpactRejected. El registro por atacante conserva 64 resultados y máximo de secuencia, igual que el de armas; un duplicado no aplica daño dos veces.

Ejemplo: ambos atacantes activos al inicio de resolution 50 envían impactos letales. Ambos son válidos aunque el primer cálculo deje derrotado al otro. Un robot ya derrotado al inicio de esa fase genera ATTACKER_DEFEATED. Evidencia: C02 y C07.

### ImpactResolved@1

Evento de damage con el resultado de una solicitud aceptada por su propietario:

~~~typescript
{
  ...AttackRef, acceptedTick: U, resolvedTick: U,
  requestedImpactUnits: P, appliedImpactUnits: U,
  integrityUnits: U, maxIntegrityUnits: P, targetStatus: Status,
  damageRevision: P, duplicate: boolean
}
~~~

Se ordenan las solicitudes únicas por messageId; se evalúa elegibilidad contra la instantánea inicial, se calcula daño acotado por la integridad restante de cada objetivo y se completa todo el lote antes de publicar resultados en ese orden. Los resultados expresan el estado posterior a cada aplicación y su revisión global. appliedImpactUnits puede ser cero si otro impacto del mismo lote agotó la integridad del objetivo; no supera la integridad que quedaba ni el impacto solicitado. No se suman cantidades sin comprobar desbordamiento. Un duplicado conserva valores, tick y revisión originales.

battle recibe todas las resoluciones de esa fase antes de su loop y solo entonces decide el resultado. Los otros consumidores aplican revisiones contiguas; no recalculan HP restando daño. La causa es el ImpactRequested específico. Ejemplo: HP 1000 e impacto 2500 producen appliedImpactUnits 1000, integrityUnits 0 y DEFEATED. Evidencia: C02, C07 y C08.

### ImpactRejected@1

Evento de damage; no cambia integridad ni su revisión:

~~~typescript
{ ...AttackRef, acceptedTick: U, resolvedTick: U, reasonCode: string, duplicate: boolean }
~~~

Motivos: NOT_READY, BATTLE_FINISHED, ATTACKER_UNKNOWN, TARGET_UNKNOWN, SELF_TARGET, FRIENDLY_TARGET, ATTACKER_DEFEATED, TARGET_DEFEATED, NON_POSITIVE_IMPACT, REQUEST_CONFLICT, REQUEST_EXPIRED. La idempotencia válida se resuelve antes de reevaluar; el resto sigue ese orden. Se refiere a los estados al comienzo de resolution. Conserva su comando como causa.

Un rechazo no deshace la recarga ya consumida por armas. La UI lo explica sin fabricar daño. Ejemplo: objetivo derrotado desde resolution 49, nuevo impacto en 50: TARGET_DEFEATED; el impacto simultáneo de 49 no se rechaza por el orden técnico. Evidencia: C02, C03 y C07.

### BattleStarted@1

Evento único de battle, luego de activación APP y recepción de mundo/roster compatibles:

~~~typescript
{
  battleId: Id, startedTick: U, maxBattleTicks: P,
  participants: [{robotId: Id, teamId: Id}]
}
~~~

Exactamente dos participantes con los mismos IDs que mundo/roster. startedTick = tick de emisión + 1, primer tick habilitado para decisiones, armas y daño. maxBattleTicks es 1200 en el escenario productivo; pruebas de límite pueden configurar valores menores. No se cuenta preparación dentro de esos 1200 ticks. El último tick combatiente permitido es startedTick + maxBattleTicks - 1.

battle espera como máximo startMaxTicks loops de publication desde la activación APP, contando ese tick. Si falta mundo/roster al agotarse, falla BATTLE_START_LIMIT, sin emitir resultado. Se propone startMaxTicks 10 en la receta. Antes del inicio los combatientes esperan; no se envían órdenes por su cuenta.

Ejemplo normal: APP se activa en input 1; mundo/roster llegan a publication 1; se emite inicio con startedTick 2 y se consume en las fases del tick 2. Evidencia: C01 y C11.

### BattleFinished@1

Evento único y terminal de battle:

~~~typescript
{
  battleId: Id, finishedTick: U, outcome: "WIN" | "DRAW",
  winnerTeamId?: Id, reason: "ELIMINATION" | "TIME_LIMIT",
  damageRevision: U, robots: Roster
}
~~~

Prioridad de evaluación después de todas las resoluciones del tick: (1) cero activos: DRAW/ELIMINATION; (2) uno activo: WIN/ELIMINATION y su equipo; (3) dos activos en el último tick permitido: DRAW/TIME_LIMIT. En DRAW winnerTeamId se omite; nunca se rellena con null ni con un bando arbitrario. robots y damageRevision coinciden con los últimos hechos de damage recibidos. Una eliminación en el tick límite tiene prioridad sobre TIME_LIMIT.

finishedTick es el de la evaluación, no el de la entrega futura. Antes de startedTick no se finaliza. Se mantiene estado terminal; una segunda finalización o hechos nuevos no duplicados que pretendan cambiarlo son fallo. BattleFinished llega al resto en el tick siguiente antes de sus loops; no necesitan órdenes externas de parada. Un fallo de sesión nunca produce este evento.

Ejemplo: ambos pasan a DEFEATED en resolution 50; publication 50 emite DRAW/ELIMINATION, no una victoria intermedia. Evidencia: C07, C09 y C11.

## 5. PresentationViewPublished@2

Evento de presentation que agrega datos de otros propietarios sin adquirir autoridad sobre ellos:

~~~typescript
{
  contextId: ContextId, battleId: Id, boardId: Id,
  sequence: P, observedTick: U,
  world: WorldV1, assemblies: Assembly[2],
  movements: (NavigationResultV1 & {sourceMessageId: P})[0..2],
  damageRevision: U, combatants: Roster,
  stage: "READY" | "ACTIVE" | "FINISHED",
  started?: BattleStartedV1, result?: BattleFinishedV1,
  events: RecentEvent[0..64]
}
~~~

world conserva el shape de NAV-001 y su límite 12×12, pero aquí tiene exactamente dos robots. assemblies usa PRE-001 con dos ensamblados y máximo cinco partes. movements contiene solo los aceptados, no duplicados, comprometidos desde la vista anterior; no es historial acumulativo. combatants/resultado informan HP explícito; la UI no resta cantidades ni convierte valores ausentes en cero.

READY omite started/result. ACTIVE exige started y omite result. FINISHED exige ambos; el roster final y la revisión coinciden exactamente con result. Contexto, tablero y robots coinciden en todas las secciones. Todas las posiciones, hechos e inicio/fin aplicados son efectivos a observedTick o antes.

### Corte coherente por tick

Se conserva la emisión en action. En el tick de emisión t se comprometen únicamente hechos con tick efectivo <= t-1; observedTick = t-1. El actor guarda por separado los hechos del tick t recibidos antes de su loop. No publica si todavía no tiene mundo y roster completos para ese corte.

El tick efectivo es effectiveTick para mundo/roster, resolvedTick para movimiento/daño/rechazo, acceptedTick para aceptación, decisionTick para explicaciones, startedTick para inicio y finishedTick para final. Los hechos elegibles se aplican en orden (tick efectivo, messageId); no se cambia el orden de entrega del bus. Al cerrar el corte se valida continuidad de revisiones, conjunto de robots y coherencia de resultado, y se publica una sola vista con sequence incrementada. Durante el encuentro se publica cada corte, aun sin cambios, para informar avance del límite. La vista terminal se publica una vez y permanece.

Así, movimiento en movement 20, daño en resolution 20 y fin en publication 20 se comprometen juntos en action 21 con observedTick 20. El host debe completar publication 21 y detener el avance al leer FINISHED; detenerse antes al ver BattleFinished perdería esa vista final.

La demora fija de un tick agrega 50 ms nominales de observación y evita que la UI combine datos de ticks diferentes. Alternativa evaluada: cambiar fases y agregar barreras de publicación; aumenta contratos y coordinación sin necesidad para este MVP.

### Historial acotado

RecentEvent tiene campos comunes {kind, tick: U, sourceMessageId: P, robotId: Id} y SOLO los campos de su variante:

| kind | Campos adicionales exactos | Origen |
| --- | --- | --- |
| MOVE | from: Hex, to: Hex | NavigationStepResolved aceptado/no duplicado. |
| ATTACK | targetRobotId: Id, weaponSlotId: Id | AttackAccepted no duplicado. |
| DAMAGE | targetRobotId: Id, weaponSlotId: Id, amountUnits: U, integrityUnits: U | ImpactResolved no duplicado; robotId es atacante. |
| ATTACK_REJECTED | targetRobotId: Id, weaponSlotId: Id, reasonCode: string hasta 64 | AttackRejected no duplicado. |
| IMPACT_REJECTED | targetRobotId: Id, weaponSlotId: Id, reasonCode: string hasta 64 | ImpactRejected no duplicado. |
| DECISION | actionKind: MOVE/ATTACK/WAIT, reasonCode: string hasta 64, targetRobotId?: Id | AIDecisionPublished; objetivo presente solo cuando lo tiene la explicación. |

Se ordena por (tick, sourceMessageId), se conservan los 64 más recientes y se descartan los más antiguos SOLO de esta vista. La traza de simulación sigue su política independiente. Cada fuente se agrega una vez; repeticiones idempotentes no reinician feedback visual. reasonCode y actionKind deben pertenecer a los enums de origen. Un receptor atrasado usa el snapshot completo; no tiene que reconstruirlo desde el historial.

Límites del paquete: 65.536 bytes por payload y profundidad 32, sin ampliarlos. Se hizo un cálculo estático conservador de serialización: mundo de 144 tiles con IDs de catálogo de 128 caracteres, dos robots, dos ensamblados de cinco piezas, dos movimientos, roster, inicio/final completos y 64 filas de la variante más larga del historial. Usando enteros seguros máximos y hasta seis bytes JSON por cada unidad de ContextId, la cota calculada es 60.857 bytes para la vista y 34.828 bytes para Begin con las siete vistas iniciales. Se sobredimensionaron incluso strings/valores mutuamente incompatibles; no es una partida ejecutada ni sustituye la prueba de límites sobre los esquemas reales.

La implementación deberá comprobar el peor caso válido de estas colecciones y del Begin combinado; si excede, la verificación falla y se revisa el diseño, no se eleva el presupuesto silenciosamente. Evidencia prevista: C08 y C12.

## 6. Utilidad pública hasLineOfSight

Firma implementada en @robots/values/hex-grid:

~~~typescript
hasLineOfSight(grid: Grid, from: Hex, to: Hex): boolean
~~~

Es pura y simétrica. Valida Grid mediante validateGrid; exige extremos dentro del tablero y coordenadas enteras. Un extremo inválido produce HEX_LOS_INVALID. Ignora como obstáculos las celdas de ambos extremos; from == to devuelve true. Armas rechaza por separado atacar al mismo robot. Solo passable=false intermedio bloquea; robots no bloquean y no se agrega opaque a CAT-002.

El supercover incluye CUALQUIER hex intermedio cerrado que el segmento entre centros toque, incluso solo por borde o vértice. En empate se consideran ambos lados: si cualquiera bloquea, no hay visión. No se usa epsilon, azar ni redondeo de punto flotante.

Algoritmo acotado implementado: transformar cada centro axial a X=2q+r, Z=3r. El hex del centro (Xc,Zc) es la intersección de |X-Xc|<=1, |(X-Xc)+(Z-Zc)|<=2 y |(Z-Zc)-(X-Xc)|<=2. Para cada una de las hasta 144 celdas intermedias no pasables, recortar el segmento contra esos seis semiplanos con intervalos racionales cerrados. Comparar fracciones mediante productos enteros comprobados. Los extremos están limitados al Grid 12×12, por lo que todos los cálculos permanecen pequeños; checkedAdd/Subtract/Multiply impiden aceptar resultados inseguros. Una intersección incluso puntual bloquea. No se enumeran hexes de una cuadrícula infinita ni se requiere una librería nueva.

Ejemplos normativos: (0,0)→(2,0) bloquea con pared (1,0); (0,0)→(1,1) toca las dos celdas (1,0) y (0,1), cualquiera bloquea; invertir los extremos conserva resultado; pared fuera del segmento no bloquea; extremos contiguos tienen visión. Evidencia: C04.

## 7. Compatibilidad, productores y consumidores revisados

| Elemento comprobado en la base e533ca3 | Tratamiento y evidencia exigida |
| --- | --- |
| protocol/presentation/v1.ts y navigation/v1.ts | Sin cambios de forma, versiones, fases ni significado. Los DTO base se reutilizan por imports públicos. Regresiones actuales deben seguir pasando. |
| presentation/src/actor.ts y su fábrica v1 | Se conservan. Nueva fábrica createCombatPresentationActor en archivo propio; la receta elige una versión explícita. No se emiten v1 y v2 con el mismo productor en la receta del juego. |
| application-host/src/assembly.ts | Ya registra type/version desde outputTypes y conserva un último payload por productor. Se usa únicamente PresentationViewPublished@2 como salida de presentation. No requiere cambios en assembly, controller o contratos APP. |
| application-host/src/bindings.ts | bindMessage permite ligar las definiciones nuevas desde la composición; bindPresentationContracts sigue siendo solo v1. No se amplía su significado ni se modifica el host genérico. |
| tests/core/presentation-fixture.ts, tests/browser/presentation-panel.ts y pruebas PRE | Continúan con actor/vista v1 y sus bindings existentes. No se convierte ni modifica el laboratorio. |
| presentation-three/src/renderer.ts y motion.ts | Conservan prepare/accept del DTO visual v1. Una entrada nueva explícita acceptCombat para v2 reutiliza sus campos visuales y añade feedback cosmético; no hay fallback de versiones del bus. Ver ficha visual. |
| tests/packages/composition.test.ts, coupling.test.ts e isolated.test.ts | Mantener cobertura de versiones e IDs renombrados; añadir escenarios COM por separado. Extender la copia aislada para comprobar los cinco actores nuevos sin instalar ninguno de sus vecinos y con el cierre system-api/protocol/values. No sustituir aserciones de aislamiento por permisos entre sistemas. |
| scripts/package-boundaries.ts | Registrar cinco paquetes nuevos con el MISMO conjunto permitido que NAV/PRE: system-api, protocol, values. Extender controles negativos; nunca autorizar imports entre actores. |
| tests/packages/architecture.test.ts | El inventario pasa de 9 a 14 paquetes y comprueba los manifiestos nuevos. No se eliminan prohibiciones, detección de ciclos, imports ocultos ni casos negativos. |
| tests/core/presentation-architecture.test.ts | Añadir únicamente los subpaths públicos COM y application/v1 usados por la nueva proyección. Mantener todos los vetos de reloj, I/O, async, runtime y vecinos, y ampliar ejemplos negativos. Los cinco actores nuevos reciben las mismas prohibiciones en una prueba COM de arquitectura. |
| CAT-002 y recursos PRE | Nuevo paquete de contenido válido de escenario, con los mismos campos/behaviorIds/recursos existentes. No cambia parser, versión de contenido, GLB, Blender ni manifest de recursos. |
| replay | Receta nueva automatic-combat-mvp-v1, revisión propia y manifiesto con los contratos/configuración fijos. No se cargan replays de laboratorio como combate ni se convierten grabaciones antiguas. Cada receta v1 anterior conserva su propia reproducción. |
| persistencia y red | Sin formatos ni adaptadores nuevos. No hay segunda batalla ni exportación de mensajes internos como protocolo remoto. |

Orden de migración: definir subpaths neutros y sus pruebas; implementar actores y utilidad; agregar proyección v2 y adaptador visual; montar receta nueva con permisos explícitos; conectar app; verificar composición nueva y regresiones v1 antes de entrega. Ningún paso intermedio se integra en main con consumidores incompletos. No se autoriza publicación, push, PR o merge en este encargo.

La revisión técnica inicial fue estática: productores/consumidores, admisión, fases, correlación y cota de tamaño. La etapa de implementación añadió pruebas ejecutables, integración y navegador, documentadas abajo y en el reporte.


## 8. Evidencia de implementación

Definiciones y validadores públicos implementados en los subpaths aprobados. La composición mantiene BUS/APP/NAV/PRE v1. Las pruebas de rutas comprueban fases diferidas y una raíz común. El escenario real y replay completo se ejecutaron; ver [reporte](../workflow/automatic-combat-mvp.md#reporte-de-entrega-local--15-de-octubre-de-2026).

La cota anterior de 60857 bytes es conservadora. La prueba sobre DTO/FieldRule ejecutables carga colecciones máximas con enteros seguros y contexto escapado: proyección 57852 bytes y Begin de siete vistas 33363 bytes, bajo el límite existente. La proyección se admite y consume en una Session real sin ampliar presupuesto. El historial, las relaciones entre participantes, el orden canónico del roster y la pertenencia de movimientos al tablero se validan.

La revisión estática descrita en la sección anterior corresponde a la etapa previa de diseño. La evidencia ejecutable y las limitaciones actuales están en el reporte; no hay migración remota ni cambios al runtime.
