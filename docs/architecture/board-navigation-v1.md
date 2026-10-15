# NAV-001 v1 — Contrato de tablero y navegación

Revisión: **1.0.0**, 13 de octubre de 2026. Estado: **aprobado mediante «aprobado. implementalo» e implementado; evidencia en la entrega**. Decisiones de producto aprobadas en [diseño NAV-001](board-navigation-design.md). [Encargo, alcance y secuencia](../workflow/board-navigation-v1.md).

## Propietarios y dependencias

navigation modifica terreno fijo, posiciones, ocupación, revisión global, revisión de posición por entidad, próximo tick habilitado y registro de solicitudes. Cada robot es un ID de entidad, independiente del ID de definición del catálogo; varias entidades pueden usar una misma definición.

La IA futura y navigation-agent-fixture eligen objetivos y próximos pasos utilizando sus vistas recibidas. navigation-lab-observer conserva una proyección exclusivamente visual. Navegación no consulta sus implementaciones; todos intercambian datos mediante mensajes.

API nueva: src/navigation/index.ts exportará tipos de inicialización/solicitud/resultado, fichas de contratos y una fábrica de participante que recibe identidad y Publisher, no Session. El ensamblador registra handlers/loop mediante Actor, contrato público APP-001. No exponer métodos para mutar posiciones ni un snapshot privado a sistemas vecinos.

src/shared/hex-grid/** contendrá geometría y BFS puros sobre datos explícitos. Sin instancias globales, I/O, reloj, RNG, timers ni dependencia del catálogo vivo. Usar APIs públicas y aritmética checked de src/core/index.ts. El montaje de fixtures valida CAT-002 y entrega solo parámetros necesarios.

## Geometría, datos y límites de primera entrega

Hex: q/r enteros seguros. Tablero rectangular en coordenadas axiales: 0 <= q < width, 0 <= r < height. Parámetros width/height enteros 1..12; máximo 144 casillas y 16 robots. Son límites de infraestructura para pruebas, no balance final. Preset inicial 7x7; punta arriba, tablero completo escalado al espacio del panel.

Vecinos en orden fijo: (+1,0), (+1,-1), (0,-1), (-1,0), (-1,+1), (0,+1). Distancia: max(abs(dq), abs(dr), abs(dq+dr)), con enteros/intermedios comprobados. Orientación visual no modifica vecindad.

Vista inicial de navegación: boardId, width, height, tiles y robots. Cada tile contiene q/r, terrainId, passable; exactamente una por coordenada existente. Cada robot contiene robotId, definitionId, q/r, moveCooldownTicks >=1. IDs ASCII no vacíos hasta 64 para entidad/tablero; referencias de catálogo conservan máximo 128. Unidades: ticks ENV-001.

Inicialización rechaza duplicados de ID/casilla, huecos, origen fuera de mapa/no transitable, dos entidades en una casilla, referencias inexistentes o CD inválido. Preparar valida antes de cerrar un contexto anterior; el participante vuelve a verificar sus invariantes antes de confirmar. Sin defaults que completen datos inválidos.

Estado inicial: boardRevision=0; robotRevision=0; readyAtTick=0 (primer paso disponible al habilitarse el contexto). Terreno y capacidades fijos por encuentro. El vencimiento del CD se calcula por comparación tick >= readyAtTick, sin mensajes por cada tick ni contadores mutados por reloj visual.

Navegación nueva no implementa captura/restauración de progreso. Su esquema de arranque no incluye checkpoints ni cambios de terreno en vivo. Los escenarios modifican sus datos antes de iniciar; ocupación dinámica proviene de pasos confirmados.

## Mensajes, versión 1

Identidad de arranque: contextId, attemptId, bundleId, contentRevision, según APP-001. Durante operación, sessionId del sobre fija contexto; boardId identifica el tablero. Todos los campos indicados son requeridos, salvo robotState, campo opcional del resultado.

| Mensaje | Clase y productor/emisión | Responsable o consumidores/recepción | Payload y efecto |
| --- | --- | --- | --- |
| InitializeNavigationBoard | Comando; app-coordinator/input | navigation/movement | Identidad y view de tablero. Nuevo nombre compatible con Participant inicialización v1 de APP. Confirma con ApplicationParticipantInitialized o rechaza mediante ApplicationParticipantRejected. |
| NavigationWorldReady | Evento; navigation/input al activar ApplicationContextReady | navigation-agent-fixture/decision; navigation-lab-observer/action | boardId, boardRevision=0, effectiveTick, width/height, tiles, robots con robotRevision=0 y readyAtTick=0. Base completa de las vistas, publicada una vez. |
| RequestNavigationStep | Comando; navigation-agent-fixture/decision | navigation/movement | boardId, robotId, requestSequence, from(q/r), to(q/r), expectedRobotRevision, knownBoardRevision. Solicita un único paso; no indica ruta completa ni cambia un objetivo de IA. |
| NavigationStepResolved | Evento; navigation/movement | navigation-agent-fixture/decision siguiente tick; navigation-lab-observer/action mismo tick | Resultado correlacionado, aprobado o rechazado; campos definidos debajo. |
| ConfigureNavigationFixture | Comando de laboratorio; app-bootstrap/input | navigation-agent-fixture/decision | configSequence, autoEnabled, goals y rawSteps. Cada goal: robotId, q/r; cada rawStep: dueTick más payload RequestNavigationStep. Máximo 16 goals únicos y 256 rawSteps, con secuencias y ticks no antiguos. Reemplaza configuración futura sin tocar posiciones/CD; dato registrado para replay. No orden de jugador del juego. |
| NavigationLabObserved | Evento de laboratorio; navigation-lab-observer/action | app-output/publication mismo tick | Vista copiada con boardRevision, observedTick, mapa/entidades, últimos 16 resultados y contador de resultados omitidos del diagnóstico. No contiene implementaciones ni referencias mutables. |

Inicializaciones adicionales de agente y observador usan comandos propios de APP-001 v1; cada uno recibe solamente configuración o identidad, no una segunda copia de todo el tablero en BeginApplicationContext. Confirman arranque, activan en input, y reciben NavigationWorldReady antes de usar posiciones.

Navegación guarda las solicitudes recibidas durante movement sin aplicar reglas en el primer handler. En su loop de esa fase procesa todas por messageId ascendente. El lote se vacía al terminar: un rechazo no deja una solicitud en espera dentro de Navegación. No reordenar por velocidad, robotId, antigüedad de espera ni objetivo.

Configuración del agente se resuelve en decision después de todas las entradas y antes de generar solicitudes. Su orden de entidades/autopiloto se declara explícitamente en datos del escenario; varias solicitudes de prueba conservan el orden de la lista. Rechazo llega a su vista en decision del tick siguiente, sin reentrada.

El observador aplica los mensajes en action, verifica revisiones y emite una proyección propia cuando cambia su vista. Esta observación es una salida autónoma de su loop con causes vacío; no agrega causas de movimientos pertenecientes a raíces independientes. Cada NavigationStepResolved mantiene solamente la solicitud que lo causa.

## Resultado de un paso

NavigationStepResolved requiere boardId (tablero autoritativo), requestBoardId (identidad solicitada), robotId, requestSequence, accepted(boolean), reason(texto estable), duplicate(boolean), resolvedTick, boardRevision y from/to solicitados. Único campo opcional: robotState, objeto exacto con position(q/r), robotRevision y readyAtTick. Se incluye cuando la entidad existe; se omite para ROBOT_UNKNOWN, sin inventar posiciones. Accepted exige robotState; Navegación verifica esta condición antes de emitir. FieldRule admite optional; no introducir null ni ampliar el núcleo.

Para un resultado normal, resolvedTick indica su resolución. En repetición exacta indica el tick del resultado original y duplicate=true. Las posiciones/revisiones de un resultado repetido son las originales, no una actualización actual. Observadores no aplican otra vez su cambio.

Rechazos normales, en precedencia definida: BOARD_MISMATCH; NOT_READY; ROBOT_UNKNOWN; VIEW_IN_FUTURE; STALE_POSITION (origen o expectedRobotRevision distintos); OUT_OF_BOARD; NOT_ADJACENT; TERRAIN_BLOCKED; DESTINATION_OCCUPIED; COOLDOWN_ACTIVE. Repeticiones usan antes las reglas de identidad de solicitud siguientes. Campos fuera de esquema, emisor no autorizado, overflow o invariantes internos rotos conservan fallo técnico visible.

knownBoardRevision menor a la actual no provoca rechazo por sí sola: la intención se revalida con posición, robotRevision, destino y ocupación actuales. Revisión futura es rechazo. Así un movimiento ajeno no invalida automáticamente todas las solicitudes del mismo tick.

Si la petición es válida, comprobar todas las operaciones y luego aplicar posición, ocupación, boardRevision+1, robotRevision+1 y readyAtTick=tick+CD conjuntamente, antes de publicar accepted=true/reason=MOVED. El máximo de un paso aprobado por robot/tick resulta también del CD >=1. El origen queda libre para solicitudes posteriores del mismo lote. Dos robots no intercambian atómicamente sus posiciones.

Una casilla ocupada bloquea aunque el ocupante también solicite salir; solo un paso ya aplicado la libera. Los rechazos dejan iguales posición/revisiones/CD. Una excepción posterior puede invalidar el tick completo conforme al núcleo; no prometer rollback ni checkpoint de estado parcial.

## Repeticiones y límites

requestSequence entero positivo creciente por pareja (productor, robotId). Registro conserva últimas 64 solicitudes/resultados por pareja y su mayor secuencia, hasta 32 parejas por sesión. El catálogo de productores sigue fijo; estos límites están registrados en la revisión de receta.

Repetición exacta conservada: devolver resultado con duplicate=true, sin aplicar acción ni consumir CD. Misma secuencia con distinto cuerpo: REQUEST_CONFLICT. Secuencia <= mayor observada que ya no está conservada: REQUEST_EXPIRED, nunca reejecutar. Mayor secuencia admite huecos; registrar también los rechazos definitivos. REQUEST_CAPACITY rechaza normalmente crear una pareja adicional al límite; no desalojar identidad silenciosamente.

Cada emisión duplicada tiene como causa su mensaje actual, no mezcla la raíz original. Inicialización repetida del participante falla técnicamente. ConfigureNavigationFixture usa configSequence monotónica y conserva últimas 16 configuraciones: repetición exacta no reinicia acciones pendientes; conflicto/expiración se informa en el diagnóstico propio del agente. Las solicitudes crudas tienen prioridad sobre autopiloto para el mismo robot/tick, como regla declarada de fixture. No usar una cola infinita de instrucciones.

Máximo 256 solicitudes de paso pendientes para una fase y límites de datos existentes. Exceso del presupuesto interno falla visible NAV_QUEUE_CAPACITY sin descarte. No ampliar capacidades del núcleo para ocultar un exceso. Validar presupuesto UTF-8 real de bootstrap/snapshots con IDs máximos, no solo cantidad de casillas.

## Rutas y vigencia de vistas

BFS obtiene el camino más corto en número de pasos para costes uniformes de cada unidad; vecinos en orden fijo resuelven empates. Datos: mapa transitable más ocupación conocida; excluir al propio robot de obstáculos. Resultado puro: camino, ALREADY_THERE o NO_PATH, más conteo de casillas exploradas para diagnóstico. El helper no decide esperar, perseguir ni atacar.

Objetivo ocupado no es destino transitable; la fixture informa sin camino. La IA futura podrá elegir casillas de acercamiento según sus reglas, sin introducir esas reglas en Navegación.

El agente recalcula antes de cada paso elegible, cuando cambia su objetivo o la revisión de ocupación conocida. Si no existe camino, la fixture espera una revisión nueva o cambio de objetivo, sin repetir BFS sobre los mismos datos en cada tick. Si vuelve a encontrar un paso, envía solicitud con su origen/revisión conocida. No predice posiciones futuras ni promete resolver bloqueos mutuos.

Cada movimiento aumenta revisión global una vez. Observadores aplican únicamente resultados accepted=true/duplicate=false con revisiones consecutivas y actualizan posición/CD de esa entidad; rechazos y duplicados se muestran como diagnóstico sin cambiar la vista. Un salto de revisión o contradicción de origen en esta sesión local fiable es fallo de fixture, no consulta directa a Navegación ni aplicación silenciosa. Configuración de mapa/terreno queda fijada.

## Compatibilidad y montaje

Nueva receta navigation-fixture-v1 con tres participantes: navigation, navigation-agent-fixture y navigation-lab-observer. Fábricas nuevas por encuentro, inicialización APP y barrera ready; sin modificar src/application/**. Recipe.outputTypes contiene NavigationLabObserved v1 para proyección completa tras action y NavigationAgentObserved v1 para la vista propia del agente tras decision. Ambas son observaciones autónomas de fixture; ninguna expone estado mutable de Navegación.

Datos y esquemas públicos se copian y congelan profundamente. El host conduce manualmente o con un driver visual externo. Sus timers quedan fuera de callbacks. Pausa conserva cursor; cambiar escenario requiere cerrar/preparar encuentro, con validación previa del candidato. No hay inscripciones dinámicas ni ingreso vivo en replay. Nuevo controlador en el laboratorio requiere que no exista encuentro activo; conserva los grupos de log para reintentar lotes pendientes.

CAT-002 migra paquete y todas sus fichas a schemaVersion=2 y locomoción a moveCooldownTicks. Conserva vocabularios/IDs/reglas restantes y límites; contentRevision de fixture lab-2. Renombrar basic-v1.json a basic-v2.json, actualizar referencias sin mantener lector v1.

Fixture CAT: FixtureInitializeNavigationContent version=2, revision content-fixture-v2; comando de combate conserva versión 1. Fixture APP: nueva identidad FixtureInitializeNavigationCooldown v1 y FixtureEquipmentObserved v1, revision application-fixture-v2-<mode>. Su inicialización/salidas anteriores no se reutilizan con semántica diferente. La inicialización de Participant conserva v1. Desde IND-002, las suscripciones de Actor y Recipe.outputTypes seleccionan explícitamente tipo/versión; estas salidas existentes continúan en v1.

ReplayRecording conserva formatVersion=1. El catálogo incorporado, contratos y revisión de receta/manifiesto distintos rechazan grabaciones CAT/APP v1 explícitamente; BUS/ENV sin contenido conservan comportamiento. No crear conversor automático ni actualizar un archivo importado en silencio. Código de versiones anteriores permanece recuperable desde Git, sin lectores legacy en runtime nuevo.

No modificar fases, orden del bus, Session, perfiles ENV ni API pública APP. Los consumidores reales de percepción/armas/IA todavía no existen; las futuras integraciones declararán sus fases/vistas. Esta entrega no habilita sus sistemas.

## Evidencia requerida

Pruebas RED/GREEN de geometría, invariantes, CD, conflictos FIFO, vista antigua, repetición/conflicto/expiración y límites. Replay normal/mezcla de pasos/pausas/debug y encuentros aislados con propietarios nuevos. Migración vieja rechazada antes de inicialización y todas las verificaciones CAT/APP anteriores preservadas con sus nuevas versiones.

Laboratorio: recorrer movimiento/CD, conflicto y orden invertido, bloqueo/desvío, sin camino/desbloqueo, rechazo y reconsideración, snapshots de IA y tablero visual en sus fases, cierre/entrada antigua, replay y log físico con reintento. Medir conteo de búsquedas y nodos; tiempos reales solo fuera de la simulación, sin umbrales prometidos.

Esta revisión fue aprobada para ejecución y está implementada. Pruebas y límites ejecutados constan en la ficha de entrega. Sin builds. Engram no disponible; fuentes compartidas conservan aprobación y contexto.
