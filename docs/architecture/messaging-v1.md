# Bus y scheduler v1

Revisión documental: **1.3.0**. BUS-001 autoriza el núcleo; BUS-002 autoriza control de ejecución y debug con archivo en el arnés; IND-001 separa definiciones públicas de bindings y admite consumidores sin productores. Implementación con fixtures verificada en Node y Chrome; la integración se rige por COL-001 en [decisiones](../decisions.md), y el gameplay sigue pendiente. Las reglas comunes están en [AGENTS.md](../../AGENTS.md). Ver [decisiones](../decisions.md), [API ejecutable](core-api-v1.md), [paquetes independientes](system-independence-v1.md) y [evidencia](../workflow/debug-harness-plan.md).

## Responsabilidades e interfaz conceptual

El bus pertenece a una sesión. Registra receptores, valida admisión y rutas declaradas, encola entregas y registra trazas. El scheduler controla ticks, fases y ejecución. Los sistemas aplican reglas de negocio a su propio estado.

Operaciones conceptuales, sin imponer sintaxis o biblioteca:

| Operación | Efecto y condición |
| --- | --- |
| Registrar receptor | Asocia un sistema, contrato y fase de recepción; devuelve una inscripción para darlo de baja. Solo durante preparación o cierre de sesión. |
| Dar de baja receptor | Cancela la inscripción y sus entregas pendientes. Durante el cierre; nunca altera silenciosamente una sesión activa. |
| Enviar comando | Valida contrato, productor y único responsable; encola una entrega. |
| Publicar evento | Valida contrato y productor; encola una entrega para cada inscripción declarada. |
| Avanzar tick | El scheduler ejecuta las fases y loops en el orden configurado. Ningún sistema lo invoca para reentrar en la simulación. |
| Cerrar sesión | Detiene loops, invalida inscripciones y descarta las colas de esa sesión con registro explícito de cierre. |

Los rechazos normales de negocio se comunican mediante resultados tipados. No se ejecutan reglas de ataque, movimiento o progresión dentro del bus.

## Contrato de mensaje

Cada combinación de nombre y versión tiene una ficha con clase (comando/evento), productores autorizados, responsable o consumidores, campos, restricciones, fases de emisión y de recepción por consumidor, rechazos y ejemplos. Usar la [ficha de mensaje](../workflow/templates.md#ficha-de-mensaje).

- Un comando tiene exactamente un sistema responsable y una inscripción para ese contrato. Cero o varios responsables es un error de configuración.
- Un evento puede tener cero o varios consumidores explícitos. La ausencia de consumidores no lo convierte en un comando ni permite ejecutar una acción implícita.
- Una definición pública no autoriza productores concretos: el host declara esos permisos en cada composición. Puede declarar cero productores para un mensaje conocido; los consumidores esperan y nadie puede emitirlo. Un comando sigue exigiendo su responsable único instalado. Para añadir un productor se prepara una nueva composición; no se modifica una sesión activa.
- No se aceptan productores, versiones o destinos fuera del catálogo de la sesión.
- La carga contiene únicamente datos inmutables y serializables conceptualmente: valores e identificadores. No contiene objetos del motor, conexiones, closures, callbacks ni referencias al estado mutable del productor.
- La implementación debe impedir que emisor o receptores modifiquen el mensaje admitido. La estrategia concreta de representación se elegirá con el lenguaje.
- Cada consumidor recibe como máximo una entrega local por publicación e inscripción. Esto no es una garantía de entrega de red ni de transacción de base de datos.

### Cabecera lógica

| Campo | Semántica |
| --- | --- |
| `messageId` | Secuencia monotónica asignada por el bus a cada publicación admitida; no UUID aleatorio de simulación. |
| `sessionId` | Identificador de contexto, capturado al preparar o reproducir la sesión. |
| `type`, `contractVersion` | Nombre estable y versión exacta del contrato admitido. |
| `sourceSystemId` | Productor registrado; las entradas externas usan un adaptador registrado. |
| `emittedTick`, `emittedPhase` | Momento lógico de publicación. |
| `correlationId` | Identificador que conserva la relación con la operación raíz; un origen nuevo inicia su propia correlación. |
| `causationIds` | Lista ordenada de mensajes que originaron directamente esta salida; puede estar vacía para una acción autónoma del loop. |

Cada entrega añade receptor, tick y fase de destino en su registro de ruta. No reescribe la cabecera original. Un mismo evento puede llegar a distintos receptores en distintos momentos lógicos.

La traza incluye admisión de entradas, publicación, rutas, consumo, rechazo y fallo; registra revisión del juego, catálogo/configuración y semilla. Una traza incompleta debe identificarse como tal y no utilizarse como prueba de reproducibilidad completa. Guardar trazas no convierte al bus en propietario del estado del juego ni obliga a persistir todos los eventos en la base de datos.

## Fases y algoritmo de entrega

| Orden | Identificador estable | Fase |
| --- | --- | --- |
| 0 | `input` | Entrada |
| 1 | `perception` | Percepción |
| 2 | `decision` | Decisiones |
| 3 | `movement` | Movimiento |
| 4 | `action` | Acciones |
| 5 | `resolution` | Resolución |
| 6 | `publication` | Publicación |

Para cada fase del tick `t`:

1. Congelar la bandeja de entregas asignadas a `(t, fase)`.
2. Consumir esas entregas en orden ascendente por `messageId` y, en un fan-out, por identificador estable del receptor.
3. Ejecutar una vez los loops asignados a la fase, según el orden explícito de sistemas configurado para la sesión.
4. Cerrar la fase y avanzar a la siguiente.

Durante un tick, una publicación para una fase estrictamente posterior se programa en ese mismo tick. Una publicación para la fase actual o una anterior se programa en el siguiente tick. Se aplica también si el receptor todavía no ejecutó su loop: no se agrega trabajo a una bandeja congelada.

Las entradas externas se admiten únicamente al comienzo de `input`, antes de congelar su bandeja; se registra su tick y orden de admisión. Esta admisión es una operación del límite externo, no una publicación desde un handler de Entrada. Una entrada admitida en el corte del tick `t` se programa para la fase declarada del mismo tick, incluida Entrada. Su cabecera identifica la admisión al comienzo de `input`; la traza distingue esa operación de una publicación durante la fase. Las que llegan después del corte esperan al próximo tick. Una salida publicada por un handler o loop de Entrada para otro receptor de Entrada sigue la regla general y llega en el tick siguiente. Reproducir una sesión usa la secuencia admitida registrada, no tiempos de llegada de red o I/O.

La primera implementación de simulación será secuencial. El trabajo paralelo de desarrolladores no autoriza paralelizar handlers o loops. Incorporar concurrencia real requiere otra decisión y pruebas de determinismo.

### Control de ejecución aprobado en BUS-002

El controlador puede avanzar por operación, fase o tick. Una operación abre la fase (incluyendo corte externo y congelado), consume una entrega completa, ejecuta un loop completo o cierra la fase. La pausa conserva cursor, bandeja congelada y presupuesto; no reordena trabajo ni interrumpe instrucciones dentro de callbacks. Terminar el tick desde cualquier pausa utiliza exactamente el mismo orden y traza que una ejecución completa. El ingreso externo durante una pausa después del corte espera al siguiente tick.

Una sesión pausada sigue activa, con rutas y catálogo fijos. No se exporta un replay de un tick parcial. El controlador puede cerrar fuera de callbacks y abortar el parcial con registro de descartes, sin confirmarlo. Los sistemas mantienen exclusivamente sus puertos de send/emit: no reciben capacidades de avance, inspección ni cierre.

El modo debug conserva un journal secuencial de manifiesto y traza completa, incluso al truncarse el diagnóstico acotado. Un adaptador ajeno al núcleo lo drena entre operaciones y escribe a archivo. Un error de archivo se informa como fallo del diagnóstico externo y detiene la ejecución automática del arnés; no cambia las reglas ni resultados de simulación. Ver los límites de memoria, confirmación y reproducción en la API.

### Ejemplo completo: la fase anterior importa

| Momento | Acción |
| --- | --- |
| Tick 119, Movimiento | Navegación publica `RobotMovido` con posición anterior y nueva. |
| Tick 120, Percepción | Percepción recibe el evento y publica `ObservacionDisponible`, con robots visibles y datos necesarios para decidir. |
| Tick 120, Decisiones | IA recibe la observación y envía `SolicitarAtaque` con atacante y objetivo. |
| Tick 120, Movimiento | Nuevos cambios de posición pueden actualizar la vista de armas en la fase Acciones. La observación anterior no garantiza que el ataque siga siendo válido. |
| Tick 120, Acciones | Armas procesa todas sus entradas, valida el ataque y envía `AplicarImpacto` a daño, o comunica rechazo. |
| Tick 120, Resolución | Daño resuelve el impacto sobre su propio estado y publica `AtaqueResuelto`. |
| Tick 120, Publicación | Ciclo de batalla recibe el resultado y actualiza el estado global del encuentro. |

Un `RobotMovido` emitido en Movimiento del tick 120 llega a Percepción del tick 121. No puede retroceder a una fase ya ejecutada. Un evento emitido en Publicación para otro consumidor de Publicación también llega en el siguiente tick.

Los nombres y cargas de este ejemplo son contratos de referencia, no mecánicas de combate cerradas. Los consumidores deben validar sus decisiones contra los datos vigentes de su responsabilidad; una intención de IA puede ser rechazada.

## Determinismo

La unidad de avance es el tick lógico. El entorno soportado declara versión de juego y runtime, fases/orden/catálogos, frecuencia, aritmética, RNG y semilla. [ENV-001](deterministic-environment-v1.md) resuelve el perfil de infraestructura: 20 ticks/s, enteros escalados y streams RNG por propietario/propósito. Las fórmulas y sistemas de combate requieren contratos posteriores.

Para esa combinación, la misma configuración inicial y entradas admitidas deben producir la misma traza lógica y resultado. ENV-001 comprueba primitivas y fixture en Node 24.14.0/Chrome 153.0.8010.54; no promete gameplay entre plataformas ni importación de replay entre runtimes. La ausencia de environment conserva las fixtures anteriores sin certificar ese perfil ni inferirlo silenciosamente.

No utilizar delta del frame, hora del sistema, UUID aleatorios, orden no especificado de colecciones ni aleatoriedad global implícita para decidir la simulación. Las decisiones aleatorias usan el mecanismo determinista aprobado, con estado y consumo reproducibles. La presentación interpreta estados y eventos; acelerar, pausar o interpolar imágenes no cambia ticks ya ejecutados.

Las vistas locales no son autoridad. Su contrato define cuándo están inicializadas, qué revisiones/ticks son válidos y qué ocurre si faltan datos. Nunca sustituir una vista inválida por lecturas directas de otro sistema.

## Ciclo de vida y fallos

- Preparación: validar catálogo, productores, responsables únicos de comandos, fases y orden. No iniciar una sesión inválida.
- Activa: mantener fijas las inscripciones y orden. Cada instancia y sus colas pertenecen a una sola sesión.
- Fallida: detener el scheduler ante payload/version/ruta inválidos, excepción inesperada o capacidad de cola excedida. Registrar contexto causal. No continuar saltando handlers ni reintentar comandos de simulación automáticamente.
- Cerrada: detener productores y consumidores, invalidar inscripciones y registrar descartes de cierre. Entradas tardías con el identificador de la sesión cerrada no se admiten.

El presupuesto de colas es un parámetro positivo de la configuración aprobada; su valor debe concretarse con el prototipo y quedar en la evidencia de cada ejecución. Un exceso falla de forma visible, no elimina mensajes arbitrariamente.

Una acción imposible según las reglas del juego es un rechazo de negocio con motivo tipado y correlación, no una excepción del bus. Una sesión fallida no declara válidos resultados de un tick parcialmente ejecutado ni genera un checkpoint a partir de ese estado. La recuperación usa el último checkpoint confirmado; no se promete rollback del tick fallido.

Las pruebas están descritas en [aceptación](../workflow/acceptance.md), con correspondencia a los archivos ejecutables del núcleo. La implementación aplica copia/congelación profunda, orden lexicográfico estable de IDs, capacidades explícitas, causalidad por referencias admitidas y replay de entradas. Los contratos y pruebas de gameplay siguen pendientes.
