# API del núcleo v1

Revisión: 1.2.0. Encargos autorizados: [BUS-001](../workflow/bus-scheduler-implementation.md), [BUS-002](../workflow/debug-harness-plan.md) y [ENV-001](../workflow/deterministic-environment-v1.md). Esta API implementa [mensajería v1](messaging-v1.md) con fixtures; no incorpora reglas del juego.

## Componentes e interfaz

El punto de entrada del ensamblador es src/core/index.ts. Session mantiene el ciclo de vida y scheduler; Catalogue valida configuración y suscripciones; Bus administra mensajes/rutas; TraceLog conserva evidencia acotada. Cada instancia es propia de una sesión. Los sistemas reciben Publisher; no reciben Session, Bus ni implementaciones vecinas.

| Operación de Session | Uso |
| --- | --- |
| constructor(options) | Copia configuración y estado inicial declarado. Preparación; no ejecuta mensajes. |
| publisher(systemId) | Puerto congelado con send y emit ligados a ese productor. |
| subscribe(id, type, version, phase, handler) | Solo preparación. Devuelve baja idempotente. Un receptor por sistema/contrato. |
| start() | Valida configuración; fija catálogo, rutas y orden de sistemas. |
| step() | Ejecuta una operación real: apertura/corte/congelado de fase, una entrega, un loop o cierre de fase. Queda detenido después. |
| stepPhase() | Completa la fase actual y se detiene antes de abrir la siguiente. |
| advanceTick() | Completa el tick actual desde 0 o desde su cursor parcial. Solo el controlador; sin reentrada. |
| stageExternalInput(adapterId, input) | Prepara copia inmutable; admite al siguiente corte de input. Devuelve false para sesión ajena, fallida o cerrada, con registro de rechazo. |
| diagnostics(), trace() | Copias/snapshots inmutables; no contienen estado mutable de sistemas. |
| inspect() | Snapshot inmutable del cursor, entregas encoladas/congeladas y entradas externas preparadas; sin callbacks ni instancias. |
| drainDebugLog() | Retira los registros de debug pendientes, solo fuera de callbacks; no modifica la traza lógica. |
| exportReplay() | Solo sesión sana entre ticks y traza completa. Exporta manifiesto, horizonte y entradas admitidas. No es un checkpoint. |
| loadReplay(recording) | Solo preparación; copia y valida entradas. start exige manifiesto idéntico. |
| close(reason?) | Fuera de callbacks, idempotente. Puede abortar un tick parcial: registra descartes, invalida inscripciones y libera colas. No confirma ese tick. |

La baja puede realizarse durante preparación; en actividad falla la sesión si se intenta alterar suscripciones. Tras close la inscripción está invalidada y su baja devuelve false. Una sesión cerrada no se reinicia.

Handlers y loops devuelven void de forma síncrona. Cada sistema declara como máximo un loop y su fase. Un retorno distinto de undefined falla, incluido Promise. El puerto funciona únicamente durante el handler/loop de su propio productor. Una salida desde un handler toma automáticamente el mensaje entrante como causa; un loop usa raíces nuevas o referencias explícitas a mensajes recibidos mediante causes.

Unir causas de raíces distintas, repetir una causa o inventar una referencia falla. Las causas se ordenan por messageId. El bus asigna la cabecera, conserva la correlación y nunca cambia el mensaje por destino.

## Catálogo y datos

Cada contrato tiene type, version exacta, kind, producers con fases, fields y, para comandos, responsibleSystemId. Un comando exige una sola inscripción de su responsable. Los eventos admiten cero o varios consumidores. La fase de recepción está en la suscripción y forma parte del manifiesto validado.

FieldRule admite string, number, boolean, object y array, además de optional. Las cadenas tienen límites en unidades UTF-16; los números admiten min/max y enteros seguros; los arrays requieren maxLength y regla de items; los objetos exigen campos declarados. Opciones de esquema mal escritas y campos de payload desconocidos se rechazan. Unidades, vigencia y motivos de negocio corresponden a cada ficha de mensaje.

Los payloads son objetos de datos JSON: valores finitos, objetos planos y arrays densos. Se rechazan undefined, funciones, símbolos, propiedades ocultas, accessors, ciclos y prototipos especiales. La copia no ejecuta getters. Objetos y arrays anidados quedan congelados y desvinculados del origen; los sobres retenidos no se reciclan. -0 se normaliza a 0 y las claves se copian en orden estable.

Profundidad de payload: 32, contando raíz en 0 y valores hoja. El esquema y los contenedores diagnósticos usan límites internos mayores para no rechazar un payload válido al envolverlo. El catálogo tiene límite de 1 MiB y profundidad 128; los datos iniciales, 1 MiB y profundidad 32.

## Fases, orden y presupuestos

La pausa es real entre operaciones síncronas. Session no ejecuta trabajo autónomo: el controlador deja de llamar a sus métodos de avance. Un único cursor implementa paso, fase y tick; mezclar estos métodos produce exactamente la misma traza. No se interrumpen instrucciones dentro de un handler ni se cambia su síncronía. El corte externo y el congelado de la bandeja ocurren una vez al abrir input; el resto de fases congela una vez su propia bandeja. Las entregas congeladas siguen ocupando capacidad durante las pausas y hasta finalizar el handler.

Activa/pausada no es un estado nuevo del ciclo de vida. diagnostics expone nextTick, nextPhase, phase, tickInProgress, nextOperation y paused. Una entrada preparada en una pausa posterior al corte se admite al siguiente tick. No se modifican catálogo, suscripciones ni orden durante la pausa. Una exportación desde un tick parcial sano devuelve CONTEXT_INVALID sin fallar la sesión; desde un callback invalida la sesión, como antes. Un fallo sigue devolviendo REPLAY_INVALID al intentar exportar.

Fases fijas: input, perception, decision, movement, action, resolution, publication. Se consumen todas las entradas congeladas antes de cualquier loop. Las entregas se ordenan por messageId y receptor; los IDs se comparan lexicográficamente con operadores de JavaScript, sin localeCompare. Los loops siguen el array explícito de systems.

El bus agrupa rutas por tick y fase, creando bandejas bajo demanda para el tick actual/siguiente. Congelar retira una bandeja de la cola, pero sus entregas siguen ocupando capacidad hasta terminar el handler. Para q > p se entrega en el mismo tick; para q <= p, en el siguiente. La entrada externa se admite antes del congelado de input y puede llegar a input del mismo tick.

| Parámetro | Default provisional | Evaluación comprobada |
| --- | --- | --- |
| maxDeliveries | 4096 entregas | 16 en fixtures; límite exacto 2 y fallo de fan-out con 2 plazas ocupadas/reservadas. |
| maxExternalInputs | 1024 intenciones | 8 en fixtures; límite/exceso con 1. |
| maxPayloadBytes | 65536 bytes UTF-8 JSON | 1024 en fixtures; borde de 7 bytes y exceso Unicode sobre 14. |
| traceCapacity | 100000 entradas | 1000 en fixtures; truncamiento con 4 y retención de 20 en 100 ticks. |
| maxMessageId | Number.MAX_SAFE_INTEGER | Límite acelerado de 1: segundo ID falla antes de repetirse. |
| maxTicks | Number.MAX_SAFE_INTEGER | Horizonte acelerado de 1: el segundo tick falla sin repetir el primero. |

Los parámetros deben ser enteros positivos seguros. Los defaults no son cifras dimensionadas para producción; cada manifiesto conserva los presupuestos usados. Un evento sin consumidores usa ID/traza y cero plazas de entrega. Cada fan-out reserva todas sus rutas antes de mutar la cola.

La capacidad de traza es independiente: al agotarse conserva el prefijo, incrementa droppedEntries y marca complete=false. No detiene la simulación por diagnóstico truncado, pero bloquea exportReplay. No hay pools, temporizadores generales, reintentos ni descarte arbitrario por saturación.

## Debug y archivo de desarrollo

SessionOptions.debug habilita un journal opcional independiente de traceCapacity. drainDebugLog devuelve registros inmutables secuenciales: primero manifiesto al iniciar, después entradas de traza con mensaje completo, rutas, inicio/fin de consumo, fases, loops, rechazos, fallos y cierre. También conserva entradas que no caben en la traza acotada. No utiliza observers, callbacks de logging ni I/O dentro del núcleo. Debug no integra el manifiesto lógico, por lo que activarlo no cambia los resultados ni la traza.

El controlador debe drenar frecuentemente el journal: conserva en memoria todos los registros aún no retirados y no realiza descartes automáticos. El adaptador de desarrollo bajo tests/browser/log-server.ts escribe JSONL en debug-logs/ a través del servidor local iniciado por scripts/harness-server.ts. Cada operación del arnés drena y espera la escritura antes de ejecutar la siguiente operación automática. Una escritura fallida deja un buffer reintentable en el arnés, muestra el error y detiene el avance automático sin fallar la simulación. Los reintentos de un lote ya confirmado no duplican líneas; huecos o contenido conflictivo en secuencia son rechazados. El cierre del navegador no constituye una confirmación de registros todavía pendientes.

## Fallos y reproducción

Preparación → activa → cerrada, o activa → fallida → cerrada. Un contrato/contexto/capacidad inválido o excepción detiene el scheduler inmediatamente. Guardar la excepción en un catch del sistema no permite continuar la sesión. El diagnóstico conserva tick, fase, sistema/adaptador, causa y código; el último tick completo queda separado del parcial. Cerrar registra descartes; no restaura estado ni hace rollback.

Principales códigos: CONFIG_INVALID, STATE_INVALID, CONTRACT_INVALID, SOURCE_INVALID, CONTEXT_INVALID, PAYLOAD_INVALID, PAYLOAD_CAPACITY, CAUSE_INVALID, QUEUE_CAPACITY, EXTERNAL_CAPACITY, ID_EXHAUSTED, TICK_EXHAUSTED, REENTRANT, ASYNC_INVALID, CALLBACK_FAILED, REPLAY_INVALID y TRACE_INCOMPLETE.

La traza incluye manifiesto, entradas admitidas con tick/ordinal, mensajes, rutas, inicio/fin de consumo y loops, rechazos/fallo, ticks completos y cierre. Los errores inesperados tienen diagnóstico, pero solo las violaciones de protocolo añaden rechazo. No registra tiempos reales.

La revisión 1.1 añade phase_started/phase_finished a la traza y maxTicks a límites del manifiesto. Grabaciones anteriores sin ese manifiesto son rechazadas explícitamente con REPLAY_INVALID. El formato contenedor sigue siendo ReplayRecording v1; no hay migración silenciosa. Los consumidores actuales son los fixtures y el arnés, no sistemas de gameplay.

ReplayRecording v1 contiene manifiesto, completedTicks y entradas con source/input/tick/order. El estado inicial es una declaración del ensamblador: este debe reconstruir sistemas nuevos con esos datos; Session no restaura su estado privado. El manifiesto compara sesión, revisión/runtime, estado inicial, fases, catálogo, rutas, orden de sistemas y presupuestos. No contiene código de callbacks: la revisión identifica esa implementación.

Una reproducción admite únicamente entradas registradas, impide ingreso vivo y no avanza más allá del horizonte. El controlador compara traza y resultado con el original; cargar el archivo no certifica por sí solo determinismo. Las pruebas reconstruyen los fixtures y comparan ambas trazas completas.

## Entorno opcional ENV-001

`SessionOptions.environment` admite exclusivamente `SimulationEnvironment` v1: 20 ticks/s, escalas 1000/10000, perfil safe-integer-v1 y xoshiro128** 1.1 con derivación fnv1a64-splitmix64-v1. El constructor valida y copia el entorno; el manifiesto lo conserva como environment. El ensamblador declara propietarios/propósitos y entrega sus snapshots iniciales; Session no administra el RNG vivo.

El núcleo exporta helpers puros de tiempo, cálculo seguro, parser decimal, derivación, nextU32/nextInt/chance y creación/validación de entorno. Datos públicos RngSnapshot, StreamDeclaration y SimulationEnvironment permanecen libres de imports. Códigos añadidos: NUMERIC_INVALID, NUMERIC_OVERFLOW, RNG_INVALID, RNG_EXHAUSTED, ENVIRONMENT_INVALID. Semántica y límites completos en [entorno v1](deterministic-environment-v1.md).

Ausencia de environment conserva exactamente el manifiesto anterior. ReplayRecording permanece en v1 y exige manifiesto/runtime idénticos. Presencia frente a ausencia, otra semilla o streams se rechazan; perfiles no soportados fallan al validar configuración. El comparador de evidencia lógica del laboratorio separa runtime únicamente en su reporte y no altera ese loader.

Verificado ENV-001 en Node 24.14.0 y Chrome 153.0.8010.54 con vectores independientes y fixture Alpha/Beta/Observador. No extrapolar a Electron, otros navegadores o combate real.

## Límites de esta entrega

Verificado en Node.js 24.14.0 con fixtures síncronos. El núcleo no importa APIs Node, DOM, Three.js, Electron, reloj real, aleatoriedad ni I/O; TextEncoder es la API estándar usada para medir UTF-8. El control de arquitectura inspecciona AST y comprueba que el puerto público carece de capacidades de administración. Estos controles son de arquitectura en un mismo proceso, no un sandbox para código hostil.

Los callbacks siguen siendo responsables de escribir solo estado propio y evitar efectos externos. Detectar un Promise no revierte efectos que el callback ya inició; los adaptadores reales y futuros sistemas necesitan revisión y controles de importación propios.

El arnés y las pausas/replay/logs se verificaron también en Chrome 153 mediante Playwright. ENV-001 verifica equivalencia lógica de primitivas/fixture en Node y Chrome; no acredita un juego completo ni carga multiplataforma de replay. Pendientes: Electron, rendimiento y memoria del juego real, fórmulas/contratos de gameplay, DB/multiplayer, CI obligatorio e integración humana de ENV-001. Cambiar estas reglas requiere evolucionar el contrato y aprobar su impacto.
