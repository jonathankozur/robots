# Laboratorio del bus y scheduler

Herramienta local de desarrollo y prueba manual. Ejecuta el núcleo real con sistemas ficticios, cada uno con estado propio. No contiene sistemas del juego ni modelos 3D.

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

## Verificación de las entregas

npm test ejecuta pruebas del núcleo, escenarios y escritura JSONL; npm run typecheck comprueba tipos sin emisión. La entrega BUS-002 incluye comprobación manual automatizada en Chrome de pausa, entradas tardías, replay, aislamiento, formularios, importación, fallo/reintento de logs y vista móvil. Evidencia y límites en docs/workflow/debug-harness-plan.md.
