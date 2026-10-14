# Laboratorio del bus y scheduler

Herramienta local de desarrollo y prueba manual. Ejecuta el núcleo real, catálogo, ciclo de aplicación y Navegación con fixtures independientes y estado propio. No contiene el juego completo ni modelos 3D.

## Iniciar

Desde la raíz del checkout, con Node.js 24 y las dependencias instaladas:

```powershell
npm run browser:harness
```

Abrir http://127.0.0.1:5173/. El servidor usa Vite en desarrollo; transforma TypeScript al servirlo y no ejecuta un build de producción. Ctrl+C detiene el servidor. Los archivos se escriben en debug-logs/ de este checkout, no en el directorio del navegador.

## Primera prueba manual

1. Elegir «Cadena causal con dos destinos», dejar Debug activado y pulsar Iniciar.
2. Pulsar Fase para recorrer input, perception, decision y movement. La entrada genera Request en decision y queda pendiente para action.
3. Pulsar Paso: abre action y congela su bandeja. Otro Paso ejecuta un handler completo. La interfaz muestra la próxima operación, las colas y el tick parcial. Esperar no ejecuta ninguna operación.
4. Inspeccionar Request y Result: cabecera, payload, productor, correlación y causas. Result llega a observer-a en resolution del tick 0 y a observer-b en perception del tick 1.
5. Preparar una entrada manual después del corte de input. Terminar el tick y comprobar que sigue pendiente; avanzar otro tick para verla admitida.
6. Entre ticks completos, exportar replay y usar Reproducir y comparar. Deben coincidir manifiesto, traza y estado final de los propietarios nuevos.
7. Descargar JSONL o abrir la ruta indicada. El primer registro es el manifiesto; siguen publicaciones, rutas, consumos, loops, fases, rechazos y cierre, con secuencia continua.

Paso ejecuta una unidad: apertura de fase, handler, loop o cierre de fase. Fase termina la fase actual; Tick termina el tick actual, aunque esté parcialmente ejecutado. Ejecutar N ticks repite pasos con una demora visual configurable. Pausar deja el cursor donde está; no interrumpe instrucciones dentro de un callback síncrono. Cerrar descarta entregas pendientes y no confirma un tick parcial. Reiniciar crea una sesión nueva.

## Diez grupos de funcionalidades

| Grupo | Controles y observación |
| --- | --- |
| 1. Escenarios y sistemas | Presets, nombre, identidad, orden estable, fase de loop y estado inicial por propietario. |
| 2. Contratos y permisos | Tipo, versión, comando/evento, responsable, productores/fases y esquema JSON. |
| 3. Rutas y fan-out | Suscripciones, fases de destino, múltiples consumidores y eventos sin consumidores. |
| 4. Comportamiento y cadenas | Reglas declarativas al recibir o ejecutar loop, condiciones y cambios de estado propio. |
| 5. Entradas | Entradas programadas por tick y formulario manual; observar el corte y rechazo de sessionId incorrecto. |
| 6. Control de ejecución | Paso, fase, tick, ejecución automática, velocidad, pausa real, reinicio y cierre parcial. |
| 7. Visualización e inspección | Siete fases, timeline, colas pendientes/congeladas, mensajes, causas, estados y diagnóstico. |
| 8. Fallos y presupuestos | Presets de permisos/datos/causas/callbacks inválidos, capacidades, IDs, ticks y traza truncada. |
| 9. Replay y aislamiento | Exportar/importar grabación, reproducir con nuevos propietarios, primera divergencia y segunda sesión independiente. |
| 10. Evidencia y persistencia local | Guardar escenarios en localStorage, importar/exportar JSON, filtros, informe, JSONL y recuperación de escritura. |

El catálogo incluye cadenas, matriz de 49 combinaciones de fases, ciclo finito, datos anidados, versiones, fan-out y fallos deliberados. Cada preset indica resultado esperado o código de fallo; una sesión fallida es el resultado correcto para esos casos.

## Construir un escenario

En Configuración editar Sistemas, Contratos, Suscripciones, Reglas, Entradas programadas y Sesión y límites. Validar configura y cierra una sesión de comprobación sin ejecutar ticks. La configuración de una sesión iniciada está bloqueada; cerrar o reiniciar permite editar. JSON completo sirve para escenarios complejos y se valida antes de aplicarlo.

Las reglas son datos, no JavaScript. Acciones disponibles: send, emit, remember, set, increment, clear y fault. Las condiciones consultan claves del estado propio con exists, equals o lt. Los templates admiten $input.payload.campo, $state.campo, $tick y $phase. Por ejemplo, un receptor conserva su entrada con remember; su loop envía un comando con causes: "remembered" y luego limpia ese estado. Para el formato completo, exportar uno de los presets.

fault selecciona fixtures cerrados que provocan violaciones conocidas: reentrada, excepción, async, mutación, causas inválidas y valores no JSON. Estos fixtures prueban defensas del núcleo; no son un patrón para implementar sistemas reales. No se admite eval ni código importado.

Guardar escenario conserva su definición en este navegador. Exportar escenario permite trasladarla a otro. Exportar replay incluye definición, entradas admitidas y evidencia esperada; al importarlo se reconstruye la sesión sin entradas vivas. La comparación exige trazas completas y ticks terminados. Exportar informe captura diagnóstico, traza y estados actuales sin convertir un tick parcial en una grabación válida.

## Logs y límites de observación

Debug se elige antes de iniciar. El núcleo produce un journal independiente de la traza acotada; el controlador lo drena después de cada acción. El servidor asigna nombres session-<uuid>.jsonl y acepta lotes de hasta 2 MiB/10000 registros. Los reintentos confirmados no duplican líneas.

Un error de escritura detiene la ejecución automática, muestra el motivo y conserva registros pendientes. Reintentar escritura continúa el envío; Descargar pendientes permite conservarlos aparte. Cerrar el navegador con registros pendientes no garantiza guardarlos. La instrumentación conserva temporalmente datos en memoria: está destinada a pruebas locales, sin benchmark de cargas de producción.

Los filtros y el deslizador histórico solo cambian la evidencia visible: no retroceden el estado real de los sistemas. Una traza truncada impide comparación completa; el archivo debug conserva los registros drenados aunque la traza haya llegado a su capacidad. No usar los estados inspeccionados para que un sistema consulte a otro.

## Entorno determinista (ENV-001)

1. Abrir la pestaña **Entorno determinista**. Es una fixture independiente del editor de escenarios del bus.
2. Mantener semilla `0123456789abcdef`, sorteos extra de Beta en 0 y pulsar **Crear / reiniciar**. Se congela la configuración hasta cerrar la sesión.
3. Usar **Paso**, **Fase** y **Tick**. Alpha sortea en decision, manda LabCalculate a Beta en action y Beta publica LabResult a Observador en publication. Expandir registros para ver payload, rutas y causas.
4. **Ejecutar N ticks** con 6 termina seis ticks desde el cursor actual. **Pausar** conserva el parcial; esperar no cambia estados ni extrae azar. Cambiar el ritmo visual solo cambia cuánto espera el controlador.
5. Desde una sesión nueva, completar 6 ticks: resultados Alpha 8322, 4625, 6261, 2887, 1851, 6097; total de Beta 40847 unidades. **Repetir y comparar** reconstruye propietarios nuevos con la misma configuración y mezcla paso/fase/tick. Debe indicar **Coinciden** sin avanzar la sesión observada.
6. Cerrar, configurar 3 sorteos extra de Beta, crear y completar 6 ticks: Alpha conserva sus resultados y estados; Beta cambia consumo y resultados. Cerrar y cambiar la semilla produce otras secuencias.
7. Debug crea un JSONL propio del entorno, indicado dentro de la pestaña. Reiniciar confirma el cierre anterior antes de cambiar de archivo. Un fallo detiene avance automático y habilita reintento; el núcleo mantiene su cursor. Cerrar navegador no garantiza drenar pendientes.
8. **Exportar evidencia** solo funciona entre ticks completos de sesión sana. El reporte incluye configuración, traza y estado inmutables, con runtime separado. La pestaña oculta los controles del escenario anterior; al volver a **Simulación**, vuelven sus controles y su sesión independiente.

### Comparar con Node

Desde la raíz de ESTE checkout:

```powershell
node tests/core/export-environment-reference.ts
```

Genera `debug-logs/node-environment-reference.json` para la semilla predeterminada y 6 ticks. Para otra semilla: `node tests/core/export-environment-reference.ts 0000000000000000`.

Crear una sesión del panel con esa semilla, 0 sorteos extra y completar exactamente 6 ticks. En **Comparar referencia Node**, cargar ese JSON. Debe mostrar **Node y navegador coinciden**; se comparan los mismos datos lógicos completos y se informa el runtime de referencia. Diferente semilla, horizonte, estado, configuración o traza da una diferencia explícita. No se trata de importar un replay multiplataforma.

Vectores independientes: `python tests/core/reference-vectors.py` regenera el JSON de referencia mediante enteros Python. No es necesario para usar el panel; los tests Node usan los vectores ya conservados. Sin builds ni dependencias nuevas.

## Catálogo de contenido (CAT-002)

1. Abrir la pestaña **Catálogo de contenido**. El editor comienza con `content/fixtures/basic-v2.json`; **Cargar ejemplo** restaura esa versión si la modificaste.
2. Pegar o editar JSON y pulsar **Validar paquete**, o importar un archivo de hasta 1 MiB. Los rechazos muestran código, ruta y explicación. Un paquete inválido nunca inicia una sesión.
3. Un paquete puede ser válido aunque no permita ejecutar la fixture. Elige un robot con chasis, locomoción y arma definidos y un terreno existente; los requisitos de la demostración se explican junto a los selectores. Por ejemplo, `robot.unarmed` sigue siendo válido para el catálogo, pero no satisface esta fixture.
4. Pulsa **Iniciar fixture** y avanza con **Paso**, **Fase** o **Tick**. Observa la traza, el manifiesto con el snapshot de contenido y las vistas separadas que reciben navegación y combate. Los datos aparecen al consumirse sus mensajes; avanzar un solo paso puede no alcanzar aún a ambos receptores.
5. La sesión fija el paquete elegido y bloquea edición/importación mientras está activa. **Cerrar sesión** conserva la traza y las vistas para inspección; valida otro JSON para preparar una ejecución nueva.

La pestaña de Catálogo prueba validación y dos consumidores ficticios. Usa CAT-002, schemaVersion2 y moveCooldownTicks. El movimiento real se prueba en la pestaña Tablero y navegación.


## Tablero y navegación (NAV-001)

Esta pestaña usa Navegación real, geometría axial/BFS y dos participantes ficticios de decisión/observación. Es una herramienta de desarrollo independiente: no incorpora IA ni combate completos.

1. Abrir **Tablero y navegación**, elegir **Velocidades distintas** y **Preparar encuentro**. El ejemplo empieza en un tablero 7x7; el editor aplica al siguiente encuentro.
2. Avanzar dos **Tick**: encuentro Disponible. A pasa de (0,2) a (1,2), CD3, próximo tick4; B pasa de (6,4) a (5,4), CD20, próximo tick21. El primer paso estuvo disponible sin esperar un CD inicial.
3. Observar posición/CD/revisión junto al tablero. La vista del observador y la del agente llegan en fases distintas. El agente recibe los resultados en decision del tick siguiente; el observador, en action del mismo tick.
4. Avanzar hasta los ticks4 y21: cada robot vuelve a moverse cuando corresponde. Pausar o cambiar el ritmo visual no cambia ese límite lógico.
5. Recorrer los otros siete presets: competencia por destino, orden invertido, duplicado exacto, cooldown, sin camino, casilla que se libera e intercambio bloqueado. En competencia solo gana la primera solicitud válida; invertir orden invierte ganador. En cooldown, aprobación en2, rechazo en3 y nueva aprobación en5.
6. Seleccionar un robot y pulsar una casilla para completar q/r. **Solicitar un paso** prepara un mensaje de fixture; Navegación puede rechazarlo por CD, ocupación, origen antiguo, pared o falta de vecindad. El rechazo no mueve ni reinicia CD.
7. **Cambiar objetivo de prueba** cambia el comportamiento de prueba mediante mensajes. **Repetir configuración** no duplica el paso. Las solicitudes crudas tienen prioridad sobre autopiloto para el mismo robot/tick.
8. **Paso**, **Fase**, **Tick**, **Ejecutar N ticks** y **Ejecutar continuo** permiten ver el flujo. **Pausar** conserva el cursor parcial. Preparar otro encuentro durante un tick parcial se rechaza; completar el tick antes de reemplazar.
9. Editar robots con posiciones superpuestas e intentar preparar: rechazo antes de cerrar el encuentro previo. Restaurar el preset y preparar: instancias nuevas. **Entrada antigua** prueba el rechazo del contexto cerrado.
10. Entre ticks completos, **Reproducir y comparar** verifica traza/vistas idénticas; **Comparar segunda sesión** comprueba aislamiento. **Exportar replay** conserva escenario, catálogo y entradas admitidas. Importarlo reconstruye la sesión sin entradas vivas. Comparación manual hasta5000 ticks, con traza completa.
11. Exportar/importar escenario conserva la definición del próximo encuentro, distinta del replay. Editores JSON estrictos; contenido CAT-002 v2 con moveCooldownTicks, mínimo1. No hay conversión automática de versiones anteriores.
12. **Debug a archivo** crea JSONL por contexto. Ver ruta, confirmados/pendientes y detalle de mensajes/colas/causas. Si la escritura falla, se pausa la ejecución automática; **Reintentar log** conserva secuencia sin duplicar registros.
13. **Cerrar** finaliza el encuentro. **Nuevo controlador** solo está habilitado sin encuentro activo y reinicia el registro acotado de solicitudes; no reinicia silenciosamente una simulación viva.

La búsqueda se reconsidera antes del siguiente paso usando la vista recibida. Sin camino, espera un cambio de revisión/objetivo para evitar repetir una búsqueda idéntica cada tick. Navegación vuelve a validar su ocupación vigente.

Límites de infraestructura: 12x12 y16 entidades, sujetos a bytes y colas. Tablero fijo por encuentro, una unidad terrestre por casilla, sin vuelo, reservas, intercambios atómicos, terreno ponderado ni modelos3D. El driver visual depende del render/escritura; CD depende solo de ticks. Evidencia real y límites en [entrega NAV-001](../../docs/workflow/board-navigation-v1.md).

## Verificación de las entregas

npm test ejecuta pruebas del núcleo, escenarios y escritura JSONL; npm run typecheck comprueba tipos sin emisión. La entrega BUS-002 incluye comprobación manual automatizada en Chrome de pausa, entradas tardías, replay, aislamiento, formularios, importación, fallo/reintento de logs y vista móvil. Evidencia y límites en docs/workflow/debug-harness-plan.md.

## Ciclo de aplicación (APP-001)

1. Abrir **Ciclo de aplicación** y pulsar **Preparar encuentro**. Ver dos confirmaciones pendientes y estado Inicializando. Primer Tick: se reciben confirmaciones, pero la disponibilidad todavía viaja por el bus. Segundo Tick: Disponible, navegación y combate muestran sus propias vistas.
2. Pulsar **Enviar operación (+1)** y luego Tick: solo aumenta el contador ficticio de navegación. Esperar sin pulsar controles no produce avance.
3. Pulsar Paso y luego Preparar encuentro: TICK_IN_PROGRESS rechaza el reemplazo sin terminar la pausa. Completar con Tick y preparar de nuevo: cambia contextId, se cierra el anterior y las instancias nuevas comienzan independientes.
4. Cambiar Robot a robot.missing o robot.unarmed y preparar: rechazo, manteniendo el encuentro anterior. Volver a robot.scout. Repetir solicitud no duplica una sesión; una petición competidora durante inicialización produce BUSY.
5. Tras reemplazar, Entrada tardía usa el ID anterior y se rechaza sin alterar la nueva vista.
6. Marcar Fallar limpieza de recursos y cerrar: Fallido, recursos pendientes, nuevo encuentro bloqueado. Desmarcar y cerrar otra vez: limpieza completa. La limpieza no se reintenta automáticamente.
7. Cerrar y pulsar Nuevo controlador para cambiar Escenario. Confirmación ausente, con límite de 3 ticks, produce INITIALIZATION_LIMIT al recibir el rechazo en el tick siguiente. Rechazo de propietario produce PARTICIPANT_REJECTED. Contradicción y excepción detienen la sesión; duplicado exacto deja Disponible.
8. Marcar Usar partes restauradas de prueba y preparar: contador 7 e integridad 70000. Solo son datos ficticios aportados al arranque; no hay guardado ni captura de progreso.
9. Entre ticks, Reproducir y comparar reconstruye propietarios independientes y verifica traza/vistas exactas. Exportar replay conserva el encuentro, no una expedición completa. La comparación manual del panel se limita a 5000 ticks.
10. Debug a archivo crea un JSONL por contexto bajo debug-logs/. Se drena fuera de callbacks después de cada operación; un fallo de escritura conserva el lote pendiente. Reintentar log vuelve a escribir idempotentemente. Descargar debug permite revisar los registros locales. Exportar reporte incluye ciclo de vida y diagnóstico, que no deben confundirse con el replay del encuentro.

El editor aplica al próximo encuentro. Para iniciar otro con diferente escenario de fallo, cerrar/limpiar antes de recrear el controlador. El panel usa las APIs públicas de APP-001, no accede a estado privado de participantes.
# Presentación 3D — PRE-001

Abrir http://127.0.0.1:5173/, pestaña **Presentación 3D**, y pulsar **Preparar escena 3D**. El ejemplo contiene un robot con ruedas/arma y otro con orugas/sin arma. Las piezas son GLB creados en Blender; la leyenda identifica cada forma y color.

1. **Tick** muestra la última posición confirmada. **Paso/Fase** permite observar que la proyección llega en publicación; el minimapa y la vista 3D pertenecen a la misma sesión.
2. Elegir **Suavizado confirmado**, ejecutar continuo y pulsar **Pausar**. La posición dibujada puede estar entre dos casillas, pero el reloj visual queda congelado. **Exacto** sincroniza con la casilla oficial.
3. Cambiar **FPS render** entre 15/30/60 o calidad. No debe avanzar el tick. Los números de recursos/FPS/poses aparecen en el inspector; objetivo medido en el equipo de referencia, no garantía universal.
4. Activar **Sockets, rutas y casillas lógicas**. El aro muestra la posición oficial; los puntos muestran montajes y las líneas son rutas de la IA ficticia. Cámara: arrastrar/rueda; **Restablecer cámara** vuelve al tablero completo.
5. Probar los nueve escenarios, ejecutar N ticks y **Comparar replay**. El resultado debe indicar traza/vistas iguales. Solicitudes manuales son fixtures, no órdenes del jugador del juego.
6. **Fallo visual** se aplica al preparar: archivo, socket o carga demorada. Debe aparecer un marcador/diagnóstico; al cerrar durante carga no debe reaparecer un canvas.
7. **Perder contexto gráfico**, **Restaurar contexto** y **Reconstruir vista** conserva la sesión lógica y reinicia solo los recursos gráficos. La pérdida pausa la ejecución externa.
8. **Segunda sesión y escena** crea otra vista sin avanzar la original. **Cerrar encuentro** limpia ambas.
9. Desplegar **Escenario y catálogo del próximo encuentro** para editar antes de iniciar. En el catálogo, el slot drive usa locomotion.wheels o locomotion.slow (orugas); agregar/quitar arma requiere una configuración CAT-002 válida. Preparar valida antes de sustituir el encuentro sano.
10. Exportar/importar escenario o replay. El sobre 3D lleva su manifest visual y exige coincidencia de recursos/digests; el formato de replay del núcleo no cambió. Debug JSONL conserva pendientes ante fallo de escritura y permite reintento; el reporte incluye pendientes para recuperación local.

Fuentes/contratos y evidencia: [PRE-001](../../docs/workflow/presentation-3d-v1.md). Generador: scripts/assets/generate-presentation.py; escena fuente: assets/blender/presentation-prototype-v1.blend; GLB: public/assets/presentation. Regenerar con Blender 5.1 y --background --python desde la raíz del checkout; actualizar revisión/digests al cambiar el kit. Producción de assets no ejecuta un build de software.
