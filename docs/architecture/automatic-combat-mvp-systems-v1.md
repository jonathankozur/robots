# COM-001 — Fichas de sistema y escenario

Revisión: **1.0.0 aprobada para implementación**. Fecha: **15 de octubre de 2026**. Base: main e533ca31c57b756b61fb0953d28572c70b327ec5. Responsable humano: Jonathan Kozur. Ejecutor de todos los lotes, en secuencia: Codex.

Estas fichas concretan el [diseño aprobado en sus decisiones](automatic-combat-mvp-design-v1.md). Se leen junto con los [contratos completos](automatic-combat-mvp-contracts-v1.md), que fijan payloads, rutas, fases, identidad, causalidad, vigencia, duplicados y errores. Esas reglas se heredan en todas las fichas siguientes. El alcance aprobado por archivo y las verificaciones están en el [plan 1.0](../workflow/automatic-combat-mvp.md). Estado de reserva: **lotes implementados en secuencia y en revisión local**.

## Reglas comunes de las fichas

Cada fábrica acepta (identity: Payload, context?: ActorContext) y devuelve Actor. context aporta exclusivamente el systemId asignado por el host; el default es el ID de la ficha. La receta adapta explícitamente los tres argumentos de Participant.create. Cada instancia conserva datos propios, Publisher y únicamente los Message vigentes que necesita como causas. No recibe Runtime, Session, controlador, reloj, renderer, otro actor ni contenedor de dependencias.

Todas las inicializaciones/activaciones son únicas y verifican identidad APP, sesión y raíz causal. Las vistas recibidas son copias inmutables; los estados derivados son locales. Antes de las fuentes requeridas se espera; una revisión contradictoria después de inicializarse detiene el contexto. En el cierre el host elimina loops/colas y libera la instancia. Crear otra instancia no restaura ni borra progreso persistente por implicación.

Persistencia para todas estas fichas: **no aplica en este MVP**. Solo hay un encuentro nuevo por instancia de UI, sin checkpoint a mitad, almacenamiento ni contrato de transferencia entre encuentros. Todos los datos iniciales/resultados quedan fijados en configuración/traza para evaluación; eso no es un guardado del jugador.

Dependencias de ejecución de damage, weapons, perception, decision, battle y presentation: exclusivamente @robots/system-api, @robots/protocol y @robots/values. Los nombres de los paquetes son dependencias de compilación declaradas, no permisos para importar cualquier subpath: cada actor usa solo los dominios públicos que consume. Los actores nuevos tienen tsconfig autónomo y exports explícitos; no importan src/ ni tests de otro paquete.

## damage — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Único escritor de integridad actual/máxima y estado ACTIVE/DEFEATED. Resolver impactos directos, sin armadura, escudo, reparación, efectos o RNG. |
| Fábrica | createDamageActor; paquete @robots/damage. |
| Estado propio | battleId; roster de dos participantes; revisión global de resoluciones; etapa de inicialización/activación/inicio/fin; cola de impactos; registro idempotente de 64 resultados y máximo de secuencia por atacante configurado. |
| Inicialización | InitializeDamageRoster@1 en resolution. Valida identidad, dos IDs/equipos distintos y HP positivo <= máximo; confirma APP. |
| Entradas | ApplicationContextReady@1 en input; BattleStarted@1 y BattleFinished@1 en resolution; ImpactRequested@1 en resolution. |
| Vistas recibidas | Inicio/fin de battle, con identidad y ticks efectivos. No conserva posiciones, armas ni estado de IA. |
| Salidas | DamageRosterInitialized@1 una vez tras APP; ImpactResolved@1 o ImpactRejected@1 por solicitud. Todas en resolution. |
| Loop | resolution. En el primer loop tras APP publica roster. Después del inicio toma la instantánea activa ANTES del lote, procesa solicitudes por messageId, completa todos los cálculos y publica en ese mismo orden. |
| Dependencias | damage/v1, weapons/v1 para DTO de identidad del ataque, application/v1 y battle/v1; aritmética/copia puras. |
| Fallos | Rechazos de negocio definidos en el contrato; enum/identidad/tiempo inválidos, overflow o contradicción de ciclo producen fallo técnico. Un evento de battle no puede reemplazar su HP local. |
| Evidencia requerida | C02, C07 y C11: límites, duplicados, lote letal, revisiones, ausencia/fallo y dos instancias aisladas. |

El orden de impacto solo reparte la integridad restante de un mismo objetivo; nunca invalida al atacante que estaba activo al comenzar la fase. Cada aplicación única incrementa la revisión de resoluciones, incluso si otro impacto del lote dejó cero integridad disponible. Una segunda solicitud con la misma identidad de ataque no incrementa revisión ni muta HP. No se suman todos los impactos antes de acotarlos: se evita un total intermedio inseguro.

BattleFinished marca el estado terminal únicamente después de comprobar que su roster/revisión concuerdan con el estado propio. Los rechazos tardíos y respuestas idempotentes no modifican el resultado ya alcanzado.

## weapons — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Único escritor de recarga y aceptación/rechazo de ataques. Autoridad de alcance y visión al momento de actuar. No cambia integridad. |
| Fábrica | createWeaponsActor; paquete @robots/weapons. |
| Estado propio | Configuración de una arma por robot, readyAtTick inicial 0, cola de solicitudes y registro idempotente por atacante. Etapa y causas vigentes. |
| Inicialización | InitializeWeapons@1 en action. Impacto/recarga/alcance positivos; IDs y slots únicos por robot. |
| Entradas | Activación APP en input; mundo/movimientos NAV, roster/resoluciones de daño, observaciones, inicio/fin y RequestAttack en action. |
| Vistas recibidas | Último mundo completo/revisado para ambos participantes; integridad/status públicos; última observación por atacante; participantes/etapa de batalla. Se actualizan SOLO por sus mensajes contiguos. |
| Salidas | AttackAccepted@1 y un ImpactRequested@1 por aceptación única; AttackRejected@1 en los demás casos. Todos en action. |
| Loop | action; primero termina la bandeja completa, luego evalúa solicitudes por messageId. Incluye los movimientos de ese tick aunque sus messageId sean posteriores a la intención de ataque. |
| Dependencias | weapons/v1, damage/v1, perception/v1, battle/v1, navigation/v1, application/v1 y hasLineOfSight/numeric/integers. |
| Fallos | Rechazos según contrato; mundo/roster contradictorios y overflows son fallos. Cola acotada a 256 solicitudes por fase; excederla falla explícitamente. |
| Evidencia requerida | C03, C04, C05, C07 y C11: recarga exacta, aceptación independiente del daño, movimiento de la misma fase, autorización, deduplicación y cierre. |

Una observación válida demuestra que el objetivo fue visible durante perception de ese tick. Armas verifica que observationTick coincida con su tick, que el objetivo figure en esa observación y que la solicitud conserve su causa. Luego revalida estado, distancia y línea contra las posiciones más recientes de action. No exige que la revisión de la observación sea idéntica a la posterior al movimiento.

Al aceptar calcula readyAtTick con suma segura y lo conserva ANTES de publicar aceptación/impacto. Un rechazo posterior de daño no revierte esa recarga. Repetir una solicitud aceptada devuelve AttackAccepted con duplicate=true, sin un segundo ImpactRequested. Solo fuentes autorizadas por la receta pueden producir los comandos.

## perception — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Determinar qué oponente activo percibe cada robot por distancia y obstáculos. No selecciona acciones. |
| Fábrica | createPerceptionActor; paquete @robots/perception. |
| Estado propio | Configuración sensorial y última observación calculada por robot; etapa y conjunto pequeño de causas actuales. |
| Inicialización | InitializePerception@1 en perception; exactamente un sensor por robot. |
| Entradas | APP en input; mundo/movimientos NAV, roster/resoluciones de daño e inicio/fin en perception. |
| Vistas recibidas | Terreno estático y posiciones/revisiones contiguas de ambos robots; HP/status recibidos; equipos e inicio/fin. Sin fuentes completas espera. |
| Salidas | RobotObservationPublished@1 en perception; una por robot y tick activo. Lista vacía si no hay rival visible. |
| Loop | perception; usa el estado NAV recibido hasta esa fase, sin anticipar movement del mismo tick. Aplica distancia de sensor y la utilidad compartida de línea de visión. |
| Dependencias | perception/v1, navigation/v1, damage/v1, battle/v1, application/v1 y geometría/copia puras. |
| Fallos | Vista inicial incompleta: esperar. Saltos de revisión, conjuntos de participantes contradictorios o identidad equivocada: fallo de sesión. |
| Evidencia requerida | C04, C05 y C11: rango inclusivo, paredes/bordes, invisible, estado derrotado, frescura y aislamiento. |

La observación se recalcula cada tick activo incluso cuando no hubo movimientos, para ofrecer vigencia explícita al decisor. Los robots no bloquean visión. Una posición oculta no se conserva como “última posición conocida” para IA en este MVP. La proyección de espectador sigue pudiendo mostrar ambos robots porque no alimenta a este actor.

## decision — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Elegir aproximación/ataque automáticamente según uno de dos perfiles deterministas. No valida ni confirma movimiento, daño o recarga ajenos. |
| Fábrica | createDecisionActor; paquete @robots/decision. |
| Estado propio | Perfil y slot/alcance de arma por robot; secuencias independientes de movimiento/ataque; solicitud de ataque pendiente; readyAtTick recibido de armas; explicación previa por robot y etapa. |
| Inicialización | InitializeDecision@1 en decision. Solo fixture.observe-v1 y fixture.pressure-v1; mismo slot/alcance que la vista preparada de armas. |
| Entradas | APP en input; mundo/movimientos NAV, observaciones, AttackAccepted/Rejected e inicio/fin en decision. |
| Vistas recibidas | Terreno estático; posición/revisión/cooldown SOLO del propio robot; boardRevision global; posición del rival SOLO en la observación vigente. Los payloads NAV ajenos sirven para avanzar boardRevision pero sus posiciones no se guardan ni se usan como objetivos/bloqueos ocultos. Se descarta también el Message completo del mundo inicial/actualización ajena después de extraer lo permitido; no se conserva como causa porque arrastraría esas posiciones. |
| Salidas | RequestNavigationStep@1, RequestAttack@1 y AIDecisionPublished@1 en decision. Sin entradas del jugador. |
| Loop | decision; robots ordenados por robotId. Una evaluación por robot/tick, máximo un paso y un ataque; orden por robot: movimiento, explicación MOVE, ataque, explicación ATTACK. WAIT solo cuando no emitió acciones y cambia la explicación. |
| Dependencias | decision/v1, perception/v1, weapons/v1, battle/v1, navigation/v1, application/v1 y BFS/geometría/copia/aritmética puras. |
| Fallos | Sin observación vigente: WAIT, sin buscar rivales por NAV. Rechazos de movimiento/ataque actualizan su resultado pendiente y fuerzan reconsideración con la próxima observación. Acuses contradictorios o ausentes en la fase decision siguiente a un ataque son fallo DECISION_ACK_MISSING/DECISION_ACK_INVALID. |
| Evidencia requerida | C05, C06 y C11: perfiles diferentes, camino estable, datos ocultos, ausencia, secuencias, acuse de recarga y fin sin órdenes extra. |

### Algoritmo preciso

1. Si no recibió inicio efectivo, o ya terminó, no actúa. Sin observación de ese mismo tick publica WAIT/NO_OBSERVATION al cambiar a esa explicación. Si la lista está vacía usa NO_VISIBLE_TARGET, sin perseguir posiciones antiguas.
2. El único rival visible es el objetivo. Ambos perfiles pueden atacar cuando la distancia de la observación es <= alcance del arma, readyAtTick recibido permite actuar y no hay acuse pendiente. La confirmación real pertenece a weapons.
3. observe intenta además acercarse hasta distancia 1. pressure se acerca solo si está fuera del alcance; una vez dentro no retrocede para conservar la distancia máxima ni persigue otra casilla por estética.
4. Para moverse se consideran las celdas transitables no ocupadas por un rival visible y con línea de visión hacia la posición observada. observe usa metas adyacentes; pressure prioriza la mayor distancia <= alcance que tenga ruta. Para observe se ordena por longitud de ruta, q y r de la meta; para pressure por distancia al rival descendente, longitud, q y r. Cada BFS usa el orden de vecinos público de NAV. Se envía únicamente el primer paso y se recalcula antes del siguiente.
5. El cooldown de movimiento viene del estado propio confirmado por NAV. Las secuencias de movimiento siguen NAV-001. No se usa una solicitud rechazada como posición nueva; una ocupación no visible puede producir DESTINATION_OCCUPIED y se maneja como rechazo.
6. Movimiento y ataque pueden coexistir si ambos son posibles en la observación previa. Si el movimiento entra en alcance desde fuera, el ataque espera la siguiente observación; no se adivina el resultado del paso. La aproximación no impide disparar cuando el arma ya estaba en alcance. Eso mantiene distintos los perfiles sin hacer que observe ignore su arma.
7. El acuse AttackAccepted/Rejected llega en decision del siguiente tick. Aceptación actualiza la vista de readyAtTick incluso si damage rechazó el impacto; rechazo no inventa una recarga. Las solicitudes ya respondidas/duplicadas no vuelven a abrir un pendiente. Si faltó la respuesta al terminar esa bandeja, la sesión falla en lugar de quedar esperando indefinidamente.

Si no se emite ninguna acción, la explicación se elige en este orden: NO_OBSERVATION, NO_VISIBLE_TARGET, NO_PATH, MOVEMENT_COOLDOWN, WEAPON_COOLDOWN. El estado de espera y el objetivo forman su clave de cambio. No se cachea una ruta como autorización para un paso futuro.

## battle — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Propietario de participantes, etapa, inicio, límite y resultado. Nunca escribe integridad o posición. |
| Fábrica | createBattleActor; paquete @robots/battle. |
| Estado propio | battleId/boardId, participantes, presupuesto de inicio/duración, etapa PREPARING/ACTIVE/FINISHED, startedTick, resultado único y causas vigentes. |
| Inicialización | InitializeBattle@1 en resolution; ambos equipos distintos, maxBattleTicks 1200 y startMaxTicks 10 en la receta. |
| Entradas | APP en input; NavigationWorldReady, DamageRosterInitialized e ImpactResolved en publication. |
| Vistas recibidas | Identidad/conjunto de robots del mundo inicial, roster y revisiones/resoluciones de daño contiguas. No requiere posiciones posteriores ni recarga. |
| Salidas | BattleStarted@1 y BattleFinished@1 en publication, como máximo uno de cada uno. |
| Loop | publication, después de todas las entregas de resolution. Primero verifica barrera de arranque; en ACTIVE prioriza eliminación sobre límite. |
| Dependencias | battle/v1, damage/v1, navigation/v1, application/v1 y copias/aritmética puras. |
| Fallos | Falta de fuentes al agotarse startMaxTicks: BATTLE_START_LIMIT. Estado/revisión incompatible: fallo; nunca se declara un ganador para salir de un error. |
| Evidencia requerida | C01, C07, C09 y C11: barreras, ganador, doble KO, límite exacto, eliminación en último tick y salida terminal única. |

La duración cuenta ticks combatientes, no reloj del navegador ni ticks de preparación. El primer tick es startedTick y el último es startedTick + maxBattleTicks - 1. Las resoluciones de ese último tick cuentan antes de decidir empate por tiempo. El tick adicional necesario para presentar el resultado no habilita más acciones: todos reciben BattleFinished antes de su loop.

## presentation — revisión 2.0 aprobada de proyección combatiente

| Campo | Especificación |
| --- | --- |
| Responsabilidad | Agregar una proyección coherente de espectador y un historial limitado; no es autoridad de combate ni entrada de IA. |
| Fábrica | Nueva createCombatPresentationActor en @robots/presentation; createPresentationActor v1 se conserva. |
| Estado propio | Inicialización visual, buffer del tick actual, último corte comprometido, sequence, historial de 64 hechos y causas vigentes. |
| Inicialización | InitializeCombatPresentation@1 en action; dos ensamblados, máximo cinco piezas cada uno, boardId/battleId. |
| Entradas | APP en input. En action: NavigationWorldReady/StepResolved, DamageRosterInitialized, ImpactResolved/Rejected, AttackAccepted/Rejected, AIDecisionPublished y BattleStarted/Finished. |
| Vistas recibidas | Mundo y revisiones NAV; roster/HP/status explícitos; hechos públicos de arma/IA y etapa/resultado de battle. Cada dato se guarda con su origen/tick hasta poder comprometerlo. |
| Salidas | PresentationViewPublished@2 en action; app-output la recibe en publication. |
| Loop | action del tick t: aplica únicamente hechos efectivos <= t-1; publica observedTick=t-1 cuando hay mundo/roster completos; nunca mezcla movimiento t con HP t-1. Un solo final publicado. |
| Dependencias | protocol/navigation/v1, presentation/v1 y v2, damage/v1, weapons/v1, decision/v1, battle/v1, application/v1; copias/aritmética puras. |
| Fallos | Espera inicial sin inventar tablero o HP; revisión contradictoria, resultado incompatible o buffer >256 mensajes falla explícitamente. El historial recorta hechos antiguos sin modificar traza/combate. |
| Evidencia requerida | C08, C09, C10, C11 y C12: corte temporal, terminal completo, máximo de payload, invariantes de autoridad, v1 y fuentes sintéticas conformes. |

El buffer se drena después de cada corte. Solo contiene hechos del tick actual/futuro inmediato, no un journal completo. Las revisiones de navegación/daño se verifican al comprometer, no al mezclar por orden de llegada. Los datos terminales se conservan después de detener el runner. Un estado de aplicación faulted se muestra como error externo; no se sintetiza BattleFinished.

## values — extensión de geometría 1.0 aprobada

Responsabilidad y estado: función pura hasLineOfSight, sin estado conservado ni mensajes. Firma, supercover, empate de borde/vértice y fallos están en el contrato, sección 6. Dependencias: system-api para ProtocolError y utilidades puras del propio paquete. No importa protocol, actores, renderer o runtime. Alcance aprobado: hex-grid.ts y su prueba propia nueva. Evidencia C04 con oráculo geométrico y casos explícitos, no una copia del algoritmo de producción.

## Composición, adaptador visual y pantalla — revisión 1.0 aprobada

| Campo | Especificación |
| --- | --- |
| Responsabilidad de composición | Construir vistas iniciales desde CAT-002, definir bindings y fábricas y devolver Recipe. Es ensamblado de infraestructura; se ubica en apps/game/composition.ts, fuera de los actores. |
| Receta | id automatic-combat-mvp; revision automatic-combat-mvp-v1. Participantes estables en orden: perception, decision, navigation, weapons, damage, battle, presentation. Sus fases y permisos son los del contrato. |
| Salida del host | Solo {type: PresentationViewPublished, version: 2} como observación de presentation. No se pide al colector guardar varios tipos del mismo productor; no se modifica el mapa por productor de APP. |
| Preparación | Valida todo el contenido y escenario ANTES de reemplazar contexto; cada vista contiene únicamente los parámetros de su propietario. No se importan funciones de pruebas para preparar una partida. |
| Estado de UI | Sin iniciar, preparando, activo, terminado o fallo; intención pendiente, última vista pública, último sequence recibido y recursos visuales propios. No posee HP/posiciones autoritativos ni ordena tácticas. |
| Interacción | Un botón Iniciar, DOM accesible, mouse/teclado y español; foco visible. Se bloquea de forma síncrona al primer intento y no se ofrece segunda batalla tras éxito. Una solicitud rechazada antes de crear contexto puede volver a intentarse con ID nuevo. |
| Bucle externo | Un único temporizador de 50 ms; cada vencimiento completa un tick mediante advance, sin catch-up ni saltos. El temporizador no se reentra ni depende de RAF. Se cancela al recibir la vista FINISHED, ante fallo de sesión o cierre. |
| Carga visual | Tras la primera vista READY se espera prepare del renderer antes de solicitar otro tick. La espera es del host, a límite de tick, para que la carga no oculte los primeros movimientos. El resultado lógico no depende de la duración de carga. |
| Presentación visual | Tablero/modelos PRE existentes; HUD por robot con equipo, integridad explícita y estado; historial legible; resultado ganador/empate. La unidad mostrada es dato/1000, hasta tres decimales, usando formato español. El texto se construye desde cociente entero y resto, sin redondear mediante división flotante un entero cercano a MAX_SAFE_INTEGER. |
| Feedback de ataque | Entrada nueva acceptCombat(viewV2) en presentation-three; conserva prepare/accept(v1). Lee ATTACK/DAMAGE para un destello/segmento cosmético y pulso del objetivo, sin proyectil físico, retraso de daño ni cambio de reglas. El estado derrotado se comunica por HUD. |
| Recursos y reloj visual | RAF/cadencia PRE independientes; geometría de feedback propia, vida visual corta y acotada. No se modifican materiales compartidos de los clones GLTF para no teñir ambos robots. Se omiten animaciones históricas al preparar/saltar secuencias y se deduplican por sourceMessageId. |
| Fallos visuales | Un recurso inválido puede usar el marcador PRE e informar la degradación. Un fallo técnico de WebGL/carga que impida preparar la pantalla informa fallo visual y detiene el runner externo; no lo convierte en derrota ni inicia otro contexto. Un fallo durante combate conserva última vista/datos sin inventar resultado. |
| Cierre | pagehide/cierre cancela timer y listeners, cierra host y dispose del renderer; las promesas tardías no reactivan la UI. Cada recurso se libera una vez. |
| Dependencias | La composición importa fábricas por exports públicos; la UI/controlador importa host y DTO públicos, no implementaciones de combate. presentation-three sigue dependiendo solo de protocol y Three.js. Sin librerías externas nuevas. |
| Persistencia | No aplica: sin localStorage de gameplay, transferencia de integridad ni guardado. |
| Evidencia requerida | C01, C08, C09, C10, C11 y C12, incluyendo navegador real, recursos tardíos, foco y fin. |

prepare del renderer sigue recibiendo el subconjunto visual de la vista v2, compatible por forma con su DTO existente; esto no publica un mensaje v1 ni interpreta un mensaje de versión desconocida. La nueva entrada visual hace explícita la recepción de hechos de combate. La última animación puede terminar con RAF después de que se detenga la simulación.

La preparación de la receta exige selección con solo scenarioId conocido; dos robots/equipos distintos, chasis/locomoción/IA/sensor y una arma por robot; parámetros de todas las vistas consistentes; posiciones válidas y libres; recursos/sockets visuales declarados; alcance de arma positivo; visibilidad sensorial inicial de ambos y ruta a una posición de disparo. Estas comprobaciones son puras, antes de crear contexto, sin fetch o acceso a actores. Un escenario que no cumple se rechaza por APP como INVALID_REQUEST con detalle; no se inicia para esperar al límite. Los casos de límite/ausencia se evalúan con composiciones de prueba conformes, sin exponer configuración adicional al jugador.

La preparación no necesita cambiar application-host/src/assembly.ts, controller.ts o bindings.ts: bindMessage y Recipe ya cubren el ensamblado. El servidor nuevo usa Vite en modo desarrollo, root apps/game y publicDir public, puerto local 5174. No incorpora middleware de logs, controles de depuración o formularios del laboratorio al producto.

## Escenario fijo de referencia

El contenido actual presentation-v2 contiene un robot desarmado y solo una ficha de IA observe. Por eso no basta con reutilizar la selección de esa fixture. Se propone **un paquete de datos del escenario**, con los mismos esquemas CAT-002 y recursos PRE; no un sistema nuevo ni nuevos behaviorIds.

| Dato | Configuración implementada |
| --- | --- |
| Archivo de contenido | content/scenarios/combat-mvp-v1.json; bundleId bundle.combat-mvp; contentRevision combat-mvp-1. No modifica las fixtures existentes. |
| Selección | scenarioId combat-mvp-v1; única selección admitida por esta receta. |
| Semilla | 0123456789abcdef; no se consumen streams RNG en estos sistemas. |
| Tablero | board.mvp, axial 7×5; 35 hexes terrain.floor transitables, sin obstáculos en el recorrido principal. Los obstáculos se cubren por escenarios de evaluación. |
| alpha / team.alpha | robot.mvp-alpha; posición (1,2); chasis de 100000 unidades (100 puntos); locomotion.wheels CD 3; ai.observe con fixture.observe-v1; sensor.basic rango 4; weapon.pulse en weapon-a. |
| beta / team.beta | robot.mvp-beta; posición (5,2); copia declarativa de chasis con ID chassis.mvp-beta e integridad 80000 (80 puntos); locomotion.slow CD 20; ai.mvp-pressure con fixture.pressure-v1; mismo sensor/arma. |
| Arma de ambos | fixture.direct-v1; impactUnits 2500 (2,5 puntos), reloadTicks 20, rangeHexes 3. Se reutilizan los parámetros actuales de weapon.pulse. |
| Recursos | Los nueve recursos/GLB y sockets del manifest PRE actual; los componentes y el segundo chasis conservan sus referencias visuales compatibles. |
| Límite | maxBattleTicks 1200, startMaxTicks 10; initializationMaxTicks de APP 10. |

Las fichas nuevas de robot/chasis/IA son contenido, no ampliación del esquema. La energía, slots y montajes deben validar con CAT-002. Las cantidades elegidas son datos de un escenario reproducible, **no balance final**.

### Comprobación estática y resultado esperado

La distancia inicial es 4: ambos sensores ven al rival y ambos están fuera del alcance de arma 3. Hay caminos sin obstáculos. En el primer tick combatiente s, alpha avanza a (2,2) y beta a (4,2). En s+1, distancia 2, ambos atacan. Alpha continúa hasta adyacencia en s+3 por su CD 3; beta ya no necesita acercarse. No hay retirada.

Con un impacto por robot cada 20 ticks, beta cae al impacto 32: s+1+31×20 = s+621. Alpha recibe también ese último impacto simultáneo y conserva 20000 unidades. Resultado esperado: WIN/ELIMINATION para team.alpha, antes del límite. Con el bootstrap normal de la receta, s=2 y finishedTick esperado 623; la vista final se publica en action 624 y llega al host en publication 624.

En el análisis previo del 15 de octubre se construyó este contenido solo en memoria a partir de los datos PRE y se pasó por validateContentBundle: válido, con los dos robots armados. La geometría/BFS existente confirmó distancia 4 y los primeros pasos (2,2)/(4,2). Se ejecutó con Node 24.14.0 y dependencias del checkout principal en la misma base e533ca3; en esa fase todavía no se había escrito el contenido ni implementado combate. La implementación posterior está registrada al final de esta ficha.

Los tiempos, HP y ganador se derivaron estáticamente durante el diseño y ahora se comprobaron con los sistemas reales: inicio 2, final 623 y proyección final 624; Alpha conserva 20000 unidades. C10 incluye replay de la traza completa y una variante de HP igual. Una variante de prueba con HP igual verifica doble KO; otra sin eliminación dentro del presupuesto verifica límite. No se modifica el escenario productivo para ocultar un fallo de implementación.

## Escenarios de aceptación por contrato y sistema

| ID | Estímulo | Resultado observable esperado / propietario |
| --- | --- | --- |
| C01 Inicio | Un clic desde idle; segundo clic durante preparación; inicializaciones y activación. | Un contexto; UI pendiente; todos confirman; roster/mundo compatibles; un solo BattleStarted efectivo al tick siguiente. No hay órdenes antes del inicio. Host, battle, UI. |
| C02 Daño | Impacto 2500 contra HP 1000; cero; atacante/objetivo desconocido; duplicado, conflicto y secuencia olvidada. | Saturación a cero, estado explícito, revisión contigua; rechazos tipados; una sola mutación por solicitud única. damage. |
| C03 Recarga | Ataque listo en t, intento antes de t+reload y en el límite; impacto rechazado tarde; duplicar aceptación. | readyAtTick exacto desde weapons; rechazo temprano no consume otra recarga; aceptación duplicada no duplica impacto; daño rechazado no revierte la recarga. weapons/decision. |
| C04 Visión | Rango inclusivo; fuera de rango; pared intermedia; contacto de borde/vértice; extremos invertidos; endpoints; obstáculos fuera del rayo. | Visibilidad simétrica y conservadora, casos geométricos explícitos; percepción y armas usan el mismo helper. values/perception/weapons. |
| C05 Vigencia | Observación del tick anterior, objetivo oculto y movimientos de la misma action; evento con salto de revisión. | Espera/rechazo normal de dato obsoleto; revalidación con mundo actual; el salto contradictorio falla. IA no accede a posición oculta. |
| C06 Políticas | Misma observación para observe y pressure; camino con empate; arma lista mientras se acerca; acuse faltante. | Aproximación distinta, orden y primer paso estables, MOVE+ATTACK permitido y observable; ninguna orden tras fin; falta de acuse falla explícitamente. decision. |
| C07 Simultaneidad | Dos impactos letales el mismo tick en ambos órdenes de emisión; eliminación en el tick límite. | DRAW por doble KO en ambos órdenes; no prioridad implícita para sobrevivir; eliminación prevalece sobre límite. damage/battle. |
| C08 Vista | Movimiento, daño y fin de un mismo tick; historial >64; duplicados; consumidor que salta vistas. | Vista con corte t-1 íntegro; eventos acotados, sin duplicar daño/feedback; HP/resultados explícitos; snapshot suficiente para ponerse al día. presentation/UI. |
| C09 Final | Victoria, doble KO, límite exacto, intento de avanzar luego del fin y error técnico. | Un final; resultado conservado y runner detenido solo tras vista terminal; error sin ganador; sin botón de segunda batalla. battle/runner/UI. |
| C10 Recorrido | Escenario fijo con ambas IA y semilla, a 30/60 FPS y con demoras/pausas del host; replay del horizonte terminado. | Ambos se mueven/atacan; team.alpha gana con 20000 unidades de integridad (20 puntos) al tick esperado; misma traza lógica y resultado en el runtime soportado; v1 sigue reproduciéndose por su receta. |
| C11 Aislamiento/fallos | Actores con IDs renombrados; instancias paralelas; consumidor sin productor permitido; identidad/causa/enum inválidos; fuente obligatoria ausente hasta límite. | Sin imports/estado compartido ajeno; espera sin inventar; fallo explícito cuando corresponde; configuración/permiso incorrecto no se acepta; ninguna sesión reactivada por tarea tardía. |
| C12 UI y límites | Payloads máximos, inicio duplicado, carga tardía, WebGL perdido, teclado, viewport angosto y cierre. | Sin exceder presupuestos ni ampliar runtime; UI legible y accesible; feedback acotado, datos finales conservados, sin timer/listeners/recursos activos tras cierre. |

Evidencia requerida: pruebas conductuales en Node 24 sin build, typecheck --noEmit, controles de dependencias/aislamiento y recorrido real en navegador de escritorio. No se extrapola a Electron, móviles reales ni determinismo entre runtimes. La tabla define los criterios; su estado y evidencia ejecutada están en el reporte del plan.


## Entrega de esta revisión

Las siete fábricas/participantes se componen en apps/game/composition.ts, con sus mensajes y fases explícitos. Los cinco paquetes nuevos tienen configuración autónoma y solo system-api/protocol/values. Presentación conserva su fábrica v1 y publica v2 mediante una nueva fábrica. La lógica de simulación no recibe reloj, DOM, renderer ni instancias de vecinos.

C01–C12 y las limitaciones de entorno están documentados en el [reporte de entrega local](../workflow/automatic-combat-mvp.md#reporte-de-entrega-local--15-de-octubre-de-2026). Los apartados sobre construcción en memoria describen el análisis previo; el contenido ya está escrito en content/scenarios/combat-mvp-v1.json y el recorrido real fue ejecutado. No se ejecutaron builds ni se integró en main.
