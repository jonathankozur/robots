# NAV-001 — Plan de implementación de tablero y navegación

Revisión: **1.0.0**, 13 de octubre de 2026. Estado: **plan/contrato 1.0 aprobados mediante «aprobado. implementalo»; implementación local completada para revisión humana**.

## Encargo y base

| Campo | Valor |
| --- | --- |
| Responsable humano | Usuario solicitante. |
| Sistema | navigation, geometría compartida pura y laboratorio NAV-001. |
| Tarjeta | [04 — Tablero y navegación](https://trello.com/c/koJ7Lhkb), Revisión / pruebas al entregar. |
| Base vigente | origin/main y HEAD 53f1d175b825ecd3ec7e7ea14cfc7d1cec905665, [PR #4](https://github.com/jonathankozur/robots/pull/4). |
| Rama y checkout | codex/board-navigation-v1; C:/Users/Jonat/.codex/worktrees/board-navigation-v1/robots. Ya creada antes de documentación, verificada y reutilizada; no otra rama desde código viejo. |
| Autoridad de preparación | «oka, la tarjeta ya está lista para desarrollar. Arma el plan de implementacion. Recordá crear un branch.» habilita preparación del plan/contrato. Las decisiones previas y «1. ok / 2. ok» habilitan documentar sus elecciones. |
| Contratos | Mensajería v1/API núcleo 1.2, ENV-001 v1 y APP-001 v1 conservados. CAT-001 → CAT-002 y nuevos contratos NAV v1 aprobados e implementados. |
| Reserva | Diseño/planificación NAV-001. Reserva de implementación activada por «aprobado. implementalo» y finalizada al entregar. |
| Fuente | [Decisiones de producto](../architecture/board-navigation-design.md), [contrato NAV v1](../architecture/board-navigation-v1.md), [migración CAT-002](../architecture/content-catalog-v2.md). |

La preparación quedó autorizada con la solicitud del plan. El usuario aprobó después su ejecución mediante «aprobado. implementalo», incluyendo NAV-001, CAT-002 y laboratorio, sin habilitar integración GitHub.

## Objetivo

Entregar un tablero hexagonal funcional y reproducible: pasos inmediatos aprobados por Navegación, cooldown posterior mínimo 1 tick, conflictos según primera solicitud válida del bus, rechazo sin movimiento/CD y recálculo de rutas ante ocupación dinámica. El laboratorio mostrará comportamiento y mensajes usando fixtures de decisión, no IA de gameplay.

## Alcance aprobado para ejecución

| Ruta | Cambio y límites |
| --- | --- |
| src/navigation/**, nuevo | Contratos, Actor/fábrica, estado propio, validación de bootstrap, solicitudes y resultados/CD. Sin snapshot privado para vecinos. |
| src/shared/hex-grid/**, nuevo | Coordenadas, vecinos, distancia y BFS puros; no capacidades de sistemas. |
| src/content/contracts.ts y schema.ts | Migrar schemaVersion literal a 2 y locomoción a moveCooldownTicks. Conservar reglas, presupuestos y demás familias. |
| content/fixtures/basic-v1.json → basic-v2.json; README.md | Archivo nuevo versionado, revisión lab-2, fichas schemaVersion=2 y CD explícito. Retirar el antiguo de las entradas runtime. |
| tests/core/navigation-*.test.ts y navigation-fixture.ts, nuevos | Geometría, negocio/contratos, secuencias, replay/aislamiento, límites y guard de arquitectura; recetas de tres participantes. |
| tests/core/content-fixture.ts, content-{validation,references,snapshot,fixture}.test.ts | Migración acotada de archivo/campo/versiones y valores de prueba que antes rechazaban versión 2; nuevas pruebas de incompatibilidad. Conservar todas las garantías previas. |
| tests/core/application-fixture.ts y application-{architecture,lifecycle,replay}.test.ts | Nuevo nombre de inicialización/observación y revisión de receta; actualización de tipos/datos/asserts afectadas. Mantener barrera, cierre, restauración ficticia, causalidad y controles existentes. |
| tests/browser/navigation-panel.ts, nuevo; lab.ts, lab.css, README.md | Panel independiente, controles/manual/autopiloto, vista SVG del tablero, trazas, escenarios/replay/debug. Conservar pestañas anteriores. |
| tests/browser/content-panel.ts y application-panel.ts | Cambiar import de paquete/etiquetas afectadas y mantener paneles operativos en CAT-002. No refactor global. |
| docs/architecture/board-navigation-{design,v1}.md, content-catalog-v2.md; docs/decisions.md; esta ficha | Aprobación/estado, contrato y evidencia real. |
| docs/architecture/content-catalog-v1.md y application-lifecycle-v1.md | Añadir nota puntual de migración/sustitución de fixtures, conservando la especificación histórica. |
| docs/workflow/content-catalog-v1.md | Nota puntual sobre ubicación nueva del paquete al migrar, sin reescribir su evidencia histórica. |

Fuera: src/core/**, src/application/**, otras pruebas del núcleo/ENV/BUS, package.json/lockfile/tsconfig, scripts de servidor/log y skills/AGENTS. Sin dependencias nuevas, 3D, IA real, percepción, armas, batalla, persistencia, vuelo o reglas de terreno avanzadas. Si una necesidad exige salir del alcance, exponer el impacto antes de hacerlo.

## Diseño técnico resumido

- Tablero de prueba inicial 7x7 configurable; límite de infraestructura 12x12/16 entidades, sujeto además al presupuesto de bytes vigente. Robot de instancia distinto de definición CAT.
- Geometría axial y vecinos con orden fijo; BFS por vista recibida. Solo un paso de la ruta por solicitud.
- Navegación recibe todas las solicitudes de movement, después su loop evalúa en messageId ascendente. Movimiento aprobado aplica posición, ocupación, revisiones y readyAtTick=t+CD antes de confirmar.
- No reserva ni tránsito; no hay cola de movimientos rechazados ni temporizador por robot. Cambios de ocupación previos del mismo lote afectan la evaluación posterior.
- Secuencia por productor/robot, cache acotada de últimas 64 y marca máxima: repetición exacta no repite acción; secuencia conflictiva o expirada se rechaza.
- Tres participantes APP: Navegación, agente ficticio y observador visual ficticio. El agente recibe movimientos en decision siguiente tick; el observador en action mismo tick y publica su proyección a app-output/publication.
- El tablero del laboratorio representa esa proyección por mensajes. Vista del agente y tick/revisión se muestran aparte para explicar información desactualizada.
- La receta valida CAT-002/selección/tablero antes de reemplazar encuentro y fija configuración en replay. Sin RNG vivo ni decisiones tomadas por reloj visual.

## Secuencia TDD

1. **Migración contractual RED.** Probar paquete v2 válido/CD, v1 rechazado, campo viejo rechazado incluso en v2, mezcla de versiones rechazada, cero/negativo/no entero inválido. Preparar pruebas de rechazo de replay/receta vieja antes de avanzar.
2. **CAT-002 GREEN.** Actualizar tipos/esquema y fixture versionada; migrar productores/consumidores CAT y APP juntos. Revisiones/nombres distintos; conservar el comportamiento de sus demos y controles. No tolerancia legacy.
3. **Geometría RED/GREEN.** Vecinos/distancia con casos independientes, BFS corto/already-there/no-path/desvío y desempates. Inmutabilidad, límites y datos fuente mutados después de preparar. No pruebas que solo comparen la implementación consigo misma.
4. **Arranque NAV RED/GREEN.** Fábrica nueva por contexto, identidad/estado mínimo, datos válidos y rechazo de inicializaciones inconsistentes. Confirmación APP y publicación de vista inicial al liberar barrera; no operar antes de ready.
5. **Paso y CD RED/GREEN.** Paso inmediato, liberación del origen, precisión de t+X y primer paso disponible; CD1/10/20/40; mismo robot con dos peticiones en tick. Todos los rechazos tipados e invariantes/overflow antes de mutar.
6. **Orden y secuencias RED/GREEN.** Dos peticiones al mismo destino, orden invertido, primera inválida, casilla liberada, intercambio bloqueado, vista antigua/futura, replay de duplicado/conflicto/expiración y presupuesto lleno. Un rechazo no consume CD ni invalida una sesión sana.
7. **Fixtures y vistas RED/GREEN.** Agente con objetivo, recálculo y bloqueo; observador con revisión consecutiva. Inicialización/pasos/resultados por mensajes. Configuración manual registrada con secuencias; ciclos de bloqueo sin prometer solución. No consultas de estado mutable entre participantes.
8. **Replay y aislamiento RED/GREEN.** Mismo escenario con ticks completos/mezcla de pasos/pausas/debug; reconstrucción de propietarios nuevos con misma traza y proyección; cierre/reemplazo/entrada tardía; manifest cambiado y replay viejo rechazados; dos encuentros independientes.
9. **Panel manual.** Pestaña Tablero y navegación: editor de mapa/contenido/entidades, objetivos ficticios, solicitudes crudas y presets. Avance parcial/N ticks/ejecución externa pausables; detalle de posiciones/CD/revisiones/rutas/rechazos/colas/causas; exportar/importar escenario/replay, comparar y debug JSONL.
10. **Verificación y entrega.** Ejecutar suites pertinentes y finalmente npm test, npm run typecheck (tsc --noEmit), git diff --check y recorridos reales del panel. Documentar entorno, evidencia TDD, controles manuales, pruebas de migración y límites; revisar diff contra main vigente.

Cada lote parte de una prueba significativa que falla por la conducta faltante; luego implementación mínima y refactor con pruebas verdes. No ejecutar builds, instalaciones ni comandos que los invoquen indirectamente.

## Laboratorio: recorridos y criterios de aceptación

| Recorrido | Resultado observable exigido |
| --- | --- |
| Paso disponible y CD exacto | Casilla cambia en la resolución; reloj/CD comienza después; t+X habilita próximo paso. |
| Dos solicitudes a una casilla | Primera válida aprobada, segunda rechazada; invertir orden invierte resultado. |
| Rechazo por ocupado, pared, borde, origen/revisión/CD | Posición/CD/revisiones permanecen iguales; se observa razón tipada y relación causal. |
| Recorrido largo, obstáculo móvil y vista antigua | Fixture recalcula antes del próximo paso; valida última ocupación conocida y el dueño revalida realidad. |
| Sin camino y casilla liberada | Agente espera un cambio conocido y retoma según fixture, sin búsquedas redundantes cada tick. |
| Duplicados/conflictos/secuencia expirada | Nunca se repite la mutación ni se reinicia el CD por la misma solicitud. |
| Pausa durante una fase y entrada tras corte | Cursor/posición se conservan; mensajes se admiten en su tick correcto. |
| Dos sesiones, cierre y reemplazo inválido | Sin estado compartido; entradas antiguas rechazadas; preflight inválido conserva contexto previo. |
| Replay y modos debug | Misma traza/proyección en runtime declarado; sin ingreso vivo ni escrituras reales durante comparación. |
| Debug y fallo de archivo | JSONL secuencial físico, lote pendiente preservado, reintento idempotente fuera del scheduler. |
| Catálogo y panel APP existentes | Operativos tras migración; archivos antiguos reciben diagnóstico claro, sin defaults. |
| Presupuestos extremos | Bytes/entidades/secuencias/números/colas se validan; nunca truncar una posición ni descartar acciones arbitrariamente. |

Panel: mostrar todo el tablero en su área, vista responsive; registros de mensajes y progreso legibles. Controles de desarrollo no pasan a interfaz del juego. El editor no modifica una simulación viva; aplicar escenario mediante encuentro nuevo.

Límite de comparación manual: 5000 ticks como APP existente. Trazas incompletas se indican y no acreditan igualdad; debug completo no sustituye esa advertencia. Archivo de replay incluye receta, CAT-002, datos iniciales y entradas admitidas, no guardado de campaña.

## Riesgos y compatibilidad

La prioridad por cola es reproducible y puede favorecer un orden de entidades; no se añade equidad distinta de lo aprobado. Pasos discretos requieren que render use posición nueva aunque anime el traslado. La vista de IA tiene latencia de fases intencional; comprobar resultados con datos vigentes.

Migración deliberadamente incompatible: paquete/fichas v1 y replays CAT/APP anteriores se rechazan en runtime nuevo. No basta renombrar una propiedad: cambiar catálogo del manifiesto, contratos afectados y revisiones de recetas. BUS/ENV sin CAT mantienen validez.

Se conservarán pruebas anteriores, ajustando solo fixtures/asserts acopladas al formato. No bajar presupuestos ni relajar guards para que una prueba pase. Código/snapshot hostil no tiene un sandbox nuevo; producción no evalúa JSON.

Medir conteo de búsquedas/nodos y reportar coste real fuera del tick. No prometer un presupuesto de FPS antes de medir ni extrapolar a Electron. Three.js y distribución siguen fuera.

## Estado y aprobación

El usuario confirmó Listo para desarrollar y pidió este plan. Posteriormente aprobó la propuesta técnica 1.0 y su alcance mediante «aprobado. implementalo». La implementación y las verificaciones ejecutadas se detallan abajo.

La aprobación de esta revisión habilitó sus cambios de NAV/CAT y fixtures/laboratorio, sin autorización implícita de commit/push/PR/merge. Engram no está disponible; contexto conservado en documentación compartida y Trello.

## Autorización de ejecución NAV-001
El usuario aprobó ejecutar plan/contrato 1.0 mediante «aprobado. implementalo». Reserva aplicada en codex/board-navigation-v1 para el alcance enumerado y finalizada al entregar. No habilita commit/push/PR/merge. Evidencia TDD y entrega conservadas abajo.


## Entrega NAV-001 — Evidencia ejecutada

Estado: **implementación local completada para revisión humana**, plan/contrato 1.0 autorizados mediante «aprobado. implementalo». Rama codex/board-navigation-v1 desde 53f1d17; reserva de implementación finalizada. Tarjeta: Revisión / pruebas al entregar. No commit, push, PR ni merge de NAV-001.

### Resultado y alcance

Navegación real posee posición/ocupación/CD, bootstrap validado, evaluación FIFO por messageId, revisiones, rechazos tipados y secuencias con registro acotado. Pasos inmediatos, sin reservas ni tránsito; origen libre después de aplicar y readyAtTick=t+CD. Datos y esquemas públicos se copian/congelan; interfaces no exponen estado privado.

Geometría axial/BFS puros. Receta APP con NavigationActor, agente y observador ficticios; vistas y solicitudes exclusivamente por mensajes. El observador recibe en action del mismo tick, el agente en decision siguiente. Nueva pestaña de desarrollo con ocho escenarios, SVG completo, controles parciales/N ticks/driver externo pausables, solicitudes manuales, objetivos ficticios, reportes, archivos y replay.

CAT-002 migra paquete/todas las fichas a v2 y moveCooldownTicks; basic-v2.json sustituye basic-v1.json. Productores/consumidores CAT y APP actualizados juntos, con revisiones/contratos de fixture nuevos. Datos v1/mezclados/campo viejo se rechazan. No lector legacy ni conversión silenciosa; ReplayRecording conserva formato 1.

Archivos nuevos: src/navigation/{actor,contracts,data,index}.ts; src/shared/hex-grid/index.ts; tests/core/navigation-{architecture,geometry,integration,system}.test.ts y navigation-fixture.ts; tests/browser/navigation-panel.ts; documentación NAV/CAT. Modificaciones acotadas en catálogo, colección, fixtures/pruebas CAT/APP, paneles/guía y decisiones. src/core/**, src/application/**, package.json/lockfile/tsconfig y servidor/log existente permanecen sin cambios.

### TDD y verificaciones

- RED de CAT-002: paquete v2 con CD rechazado por el validador v1; GREEN después de migración coordinada.
- RED de geometría contra funciones provisionales: vecinos, ruta y aritmética ausentes. El oráculo de una ruta empatada se corrigió para respetar el orden de vecinos aprobado; no se cambió la regla para adaptar la prueba.
- RED de movimiento: sin resultado, cooldown/FIFO/duplicación ausentes e inicialización inválida aceptada. GREEN con lógica mínima.
- RED de fixtures: no autopiloto/conflictos y preflight inválido reemplazando contexto; GREEN con recálculo y validación antes de montaje.
- RED adicionales: esquemas públicos mutables e identificadores numéricos aceptados por conversión implícita; GREEN con congelación profunda y validación explícita de tipo. CD1/10/20/40 comprobados con aprobación exactamente en t+X.
- Dos verificaciones iniciales no pudieron cargar TypeScript porque faltaba node_modules en el checkout. Se reutilizaron las dependencias fijadas del checkout APP mediante junction local; sin instalar ni alterar versiones. Este fallo de entorno no cuenta como evidencia RED.
- npm test: **175/175 aprobadas**, 0 fallidas/omitidas; 24 nuevas (23 NAV y 1 migración CAT), preservando las 151 anteriores.
- npm run typecheck: aprobado con tsc --noEmit. Node 24.14.0; TypeScript 5.9.3.
- Presupuestos máximos: 12x12/16 entidades con IDs de tablero/robot de 64 y referencias de 128; bootstrap/vistas admitidos sin ampliar límites.
- git diff --check y revisión de rutas, enlaces/espacios en documentos/archivos nuevos: sin errores. No builds.

### Navegador y archivos

Laboratorio servido desde este checkout en http://127.0.0.1:5173/. Verificado en navegador integrado; perfil/runtime conservado en el replay exportado, sin extrapolar a Electron u otros navegadores.

Se operaron los ocho presets: velocidades distintas, competencia, orden invertido, duplicados, límite exacto de CD, sin camino, casilla liberada e intercambio bloqueado. Todos produjeron su resultado previsto y replay idéntico en traza/vistas. CD de prueba: movimiento en tick2, rechazo en3, nuevo paso en5 para CD3.

Comprobados mediante UI: selección de hexágono, solicitud manual, configuración repetida sin volver a mover, cambio de objetivo, avance parcial, reemplazo rechazado en tick parcial, preflight inválido conservando encuentro, ejecución externa/pausa estable, comparación de segunda sesión, entrada antigua rechazada, cierre/nuevo controlador habilitado solo sin encuentro activo y reconstrucción del replay exportado/importado.

Archivo exportado confirmado: formatVersion=1, 38 ticks y paquete v2. Exportación de escenario confirmada con formato 1; el contenido exportado es la definición del próximo escenario, mientras el replay conserva además entradas manuales admitidas. Importación de escenario está implementada; no se afirma un recorrido adicional de ese botón en navegador.

Regresiones web: Catálogo recibe moveCooldownTicks por su comando v2 y muestra CONTENT_VERSION para paquete v1; Ciclo de aplicación inicia y reproduce con nueva fixture correctamente.

Debug JSONL físico: se verificaron secuencias contiguas, manifiesto y publicaciones en los archivos. En un punto de control: 9 archivos, 3459 registros y 222 publicaciones; luego se generaron más encuentros. Fallo de escritura inducido reversiblemente: 23 registros pendientes, diagnóstico ENOENT/HTTP400; restauración de archivos y reintento dejaron 0 pendientes, sin gaps/duplicación. El servidor/log no se modificó. El error de consola HTTP400 fue deliberado; antes de la inyección no había errores/warnings.

Captura del panel completo a ancho integrado de 600 px: nav-001-laboratorio.png en la carpeta de visualizaciones de esta conversación. El tablero y CD quedaron visibles; navegador mantenido como entrega.

### Límites y continuidad

Primera entrega de navegación, no combate completo. Agente/observador son fixtures; no IA de gameplay, percepción/armas reales, Three.js, vuelo, altura, cobertura, cambio de terreno vivo ni guardado. BFS es uniforme por unidad; coste variable de terreno requiere ampliación. No RNG vivo en esta fixture.

La prioridad por mensajes puede favorecer un orden de entidades y no garantiza resolver bloqueos. NO_PATH se reconsidera al cambiar revisión/objetivo; no hay búsqueda inútil cada tick con la misma vista. Guard de imports es evidencia estática, no sandbox contra código hostil/Proxy.

El ritmo del driver visual es nominal y puede verse limitado por render/I-O de debug; CD depende de ticks lógicos, nunca del reloj visual. Logs pendientes viven en memoria mientras no se confirme escritura; el cierre de navegador no garantiza preservarlos. Trazas incompletas se indican y no acreditan/exportan replay. Comparación manual limitada a 5000 ticks.

Pendiente: revisión humana de esta entrega y cualquier autorización posterior de integración GitHub. Engram no está disponible; evidencia conservada en documentos y Trello.
