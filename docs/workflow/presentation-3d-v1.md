# PRE-001 — Plan de implementación 1.0

Fecha: 14 de octubre de 2026. **Plan 1.0 aprobado; ejecución autorizada mediante «aprobado. Implementalo».** Implementación local entregada para revisión en codex/presentation-3d-v1. [Diseño y contratos](../architecture/presentation-3d-v1.md), [tarjeta 05](https://trello.com/c/yvOivbe1), En desarrollo.

## Encargo y autoridad

| Campo | Valor |
| --- | --- |
| Responsable humano | Usuario solicitante. |
| Sistema | presentation: proyección propia por mensajes y adaptador gráfico externo. |
| Ejecutor/reserva | Codex; implementación entregada en rama propia. Reserva finalizada. |
| Base | main a9d8d834a9f5169d9c1b79f0a8b2023fefb52f59, PR #5 integrado. |
| Rama/checkout | codex/presentation-3d-v1; C:/Users/Jonat/.codex/worktrees/presentation-3d-v1/robots. Creada antes de editar. |
| Autorización | Respuestas numeradas del usuario y «Documentá las decisiones, crea un nuevo branch para trabajar, y arma el plan de implementacion». Habilitó la preparación; «aprobado. Implementalo» autorizó después código, dependencia, assets y laboratorio. Integración GitHub pendiente. |
| Contratos | NAV v1, CAT-002, APP-001 y núcleo 1.2 conservados. Nuevos mensajes de presentación y receta independiente aprobados e implementados según diseño 1.0. |
| Entorno | Node 24/TypeScript/Vite vigentes; Blender 5.1.0 disponible. Verificaciones ejecutadas en la entrega inferior; 198 pruebas y typecheck aprobados. |

## Objetivo y primera entrega

Mostrar en Three.js un tablero completo y robots ensamblados con GLB genéricos creados por Codex en Blender: chasis, núcleo, IA, sensor, ruedas/orugas y arma. Representar movimientos confirmados, cámara ortográfica inclinada y pausa visual real. Ofrecer pruebas manuales aisladas en el laboratorio sin introducir órdenes del jugador ni reglas de combate.

## Alcance aprobado para ejecución

| Rutas | Trabajo y límites |
| --- | --- |
| src/presentation/**, nuevas | Contratos/proyección/validación pura; actor de datos y adaptador Three.js con gestor de recursos/reloj visual. Subcarpetas data y graphics para poder prohibir Three.js/I-O/reloj en el actor. |
| src/shared/hex-grid/index.ts, solo si necesario | Conversión geométrica pura a coordenadas visuales, sin cambiar vecinos/BFS/ocupación. Alternativa preferida: utilidad pura en presentation para conservar archivo NAV. |
| assets/blender/presentation-prototype-v1.blend; scripts/assets/**; public/assets/presentation/**, nuevas | Generador Blender y fuentes GLB. Siete módulos de robot más suelo/obstáculo; materiales simples. Inspección reproducible de GLB, nombres y sockets. |
| content/presentation/prototype-v1.json; content/fixtures/presentation-v2.json, nuevas | Manifest visual versionado y fixture CAT-002 específica con referencias para todas las piezas visibles y dos locomociones. No alterar basic-v2 ni migrar formato del catálogo. |
| tests/core/presentation-*.test.ts; tests/core/presentation-fixture.ts, nuevas | Receta nueva, observador real de presentación, aislamiento/replay/contratos/presupuestos. Reutilizar participantes de navigationRecipe mediante el contrato Recipe, sin importar implementaciones de sistemas desde el actor. |
| tests/harness/presentation-*.test.ts, nuevas | Reloj/interpolación/resincronización y gestión de recursos con dobles; GLB/manifest y cierres asíncronos. |
| tests/browser/presentation-panel.ts, nueva; tests/browser/lab.ts, lab.css, README.md | Nueva pestaña y controles; preservar pestañas anteriores. Ningún import Three.js en tests/core ni lógica de simulación. |
| scripts/harness-server.ts | publicDir explícito para assets. Conservar servidor/puerto y middleware JSONL. |
| package.json y package-lock.json | Añadir three con versión exacta y @types/three si corresponde; resolver/verificar compatibilidad al implementar, sin cambiar herramientas existentes ni agregar scripts que ejecuten builds. |
| docs/architecture/presentation-3d-v1.md; docs/workflow/presentation-3d-v1.md; docs/decisions.md | Contratos definitivos y evidencia real de entrega. |

Excluidos: src/core/**, src/application/**, implementación NAV/CAT, guards/tests anteriores, bus/scheduler, gameplay de percepción/IA/armas/daño, card 06, física, vuelo, rigging complejo, shaders/postprocesado avanzados, Electron/Steam, persistencia y configuración remota. Las versiones/revisiones de la receta nueva permiten conservar las demos/replays existentes. Si un presupuesto o contrato actual impide el alcance, mostrar el impacto antes de modificarlo.

## Secuencia de trabajo y evidencia

1. **Contratos y datos, RED/GREEN.** Esquemas estrictos con límites/identidades, snapshots separados e inmutables. Pruebas de arranque, revisiones consecutivas, duplicados/rechazos, datos ajenos y publicación por fases. Implementar el actor mínimo sin Three.js, I/O o reloj. Verificar causalidad del agregado y presupuestos de payload.
2. **Receta aislada, RED/GREEN.** Añadir presentación a una receta propia usando factories nuevas y mensajes NAV existentes. Initial state fija la selección y los recursos referenciados; APP distribuye vistas mínimas y expone el output público. Pruebas de configuración inválida sin reemplazo, sesiones/cierre/replay y preservación de navigation.fixture.
3. **Kit Blender.** Escribir generador reproducible de primitivas/colores/sockets, producir .blend y GLB autocontenidos. Verificar archivos, ejes exportados, nombres únicos, finitud, escala/huella, materiales y conexión de ambas locomociones/armas. Generar/exportar modelos es producción de assets autorizable por este plan; no ejecutar builds de software.
4. **Manifest y fixture, RED/GREEN.** Validar mapeo resourceId, revisión/digest, ubicaciones locales, nombres de montaje y closure de referencias. Fixture específica CAT-002 con configuraciones contrastantes; formato productivo CAT sin cambios. Mantener ajustes de encaje dentro del asset/convención, sin excepciones por robot.
5. **Reloj visual, RED/GREEN.** Reloj inyectable externo; modo exacto/suave, transición inicial 120 ms acotada por CD, pausa real, cambio de velocidad y discontinuidades. Prueba con valores de tiempo explícitos: no depende de temporizadores reales para verificar. Ningún movimiento visual ante rechazo/duplicado; pasos parciales aún sin publication mantienen la vista publicada anterior.
6. **Recursos, RED/GREEN.** Precarga, clones independientes/recurso compartido, referencias y liberación. Probar errores, cierre durante carga, resultados de generación vieja, reintentos explícitos, context loss y reconstrucción. Marcador/diagnóstico sin cambiar la simulación; evitar handlers y loops retenidos tras cierre.
7. **Adaptador Three.js.** Añadir dependencia exacta; cámara ortográfica/ajuste completo, GLTFLoader, ensamblado por sockets, tablero punta arriba y representación del output. Materiales sencillos, límite inicial de densidad de píxeles 1.5 configurable y sin efectos costosos. Medir antes de introducir optimizaciones adicionales.
8. **Laboratorio.** Pestaña independiente; una misma sesión alimenta comparaciones 2D/3D. Mostrar leyenda de piezas, posición lógica/dibujada, tick/revisión, CD y diagnósticos. Editor previo a arranque, ambos módulos drive, exacto/suave, controles parciales/N ticks/pausa/velocidad, FPS de render, cámara/sockets, replay y pruebas de fallos. El control gráfico no modifica ni consume ticks por cuenta propia.
9. **Verificación y entrega.** Suites pertinentes, npm test, npm run typecheck (tsc --noEmit), git diff --check y pruebas reales en navegador del siguiente apartado. Registrar Blender/Node/navegador/GPU/tamaño real, recursos/tiempos y resultados. No builds; no afirmar gráficos validados mediante pruebas headless de datos solamente.

Cada lote de lógica parte de una prueba significativa RED, luego implementación mínima y refactor GREEN. Arte/documentación no requieren tests artificiales; los contratos del asset sí se inspeccionan. La disponibilidad real del modelo cargado y la legibilidad se validan visualmente.

## Aceptación manual y automatizable

| Caso | Resultado exigido |
| --- | --- |
| Ensamblado ruedas/orugas/armado/desarmado | Cada configuración visual refleja exactamente el catálogo seleccionado; piezas contrastantes y montaje correcto. Cambiar configuración requiere encuentro nuevo, sin alterar equipamiento vivo. |
| NAV CD1/10/20/40, conflictos y rechazos | Solo resultados aceptados únicos desplazan el robot; posición lógica de NAV intacta y CD independiente del suavizado. |
| FPS 15/30/60 y calidad/modo visual | Misma traza y proyección lógica con misma receta/entradas/horizonte; variar parámetros gráficos no genera entradas de gameplay. |
| Pausa a mitad del suavizado | Pose dibujada estable hasta reanudar; cámara inspeccionable. Paso manual sincroniza a la última publicación admitida. |
| Avance parcial y tandas rápidas | Distinguir publicación pendiente de estado confirmado; ponerse al día sin inventar recorrido o acumular cola de animaciones. |
| Replay y dos sesiones | Reconstrucción con propietarios nuevos, misma evidencia lógica y escenas independientes. Manifest visual acompaña escenario como metadata propia, sin cambiar ReplayRecording v1. |
| Asset/socket inválido | Marcador y razón visible, sin fingir montaje correcto; simulación permanece coherente. |
| Carga tardía/cierre/reemplazo | Resultado viejo no reaparece; ausencia de handlers/loops vivos. Después de calentamiento, 20 ciclos no acumulan recursos persistentes frente a su baseline de cache declarado. |
| WebGL perdido/restaurado | Diagnóstico, renderer inoperativo suspendido y reconstrucción visual explícita desde la última proyección; nunca reiniciar silenciosamente el combate. |
| Tablero máximo y viewport | 12x12/16 robots encuadrados; revisar al menos áreas 600x600 y 1280x720. Controles legibles y render responsive. |

Objetivo de rendimiento: 60 FPS en el equipo de referencia declarado, con medidas de render separadas del scheduler/debug/DOM y contadores de llamadas/triángulos/recursos. No garantía entre hardware ni comparación de píxeles entre GPUs. Si no alcanza, entregar medición y alternativas concretas de calidad sin modificar resultados.

## Riesgos y decisiones técnicas aprobadas con el plan

- Las descargas, transformaciones Blender/glTF y recursos GPU son nuevas fronteras: los guards deben distinguir actor de datos y adaptador autorizado, manteniendo controles actuales.
- API gráfica/versión de three y dependencia de tipos se fijarán al implementar. Nueva dependencia y cambios package/lockfile requieren aprobación de este alcance, no vienen autorizados únicamente por elegir Three.js antes.
- Valores 120 ms, paleta/dimensiones, límite de pixel ratio 1.5 y manifest/receta v1 quedaron aprobados al autorizar el plan 1.0; son parámetros de fixture, no balance final.
- Socket ausente se trata como fallo visual de validación, nunca compatibilidad de negocio aceptada por defecto. CAT valida datos; presentación valida el archivo real.
- Cambios de apariencia no modifican core replay. La receta nueva tiene su propia revisión y manifest visual versionado para reproducción de presentación; verificar por separado igualdad lógica y configuración gráfica.

El usuario aprobó el plan 1.0 y solicitó su ejecución mediante «aprobado. Implementalo». Esto habilitó código, dependencia, producción de assets y flujo de implementación de la tarjeta. La tarjeta pasó a En desarrollo al comenzar y a Revisión / pruebas al entregar. Commit/push/PR/merge quedan pendientes de una instrucción de integración.

## Evidencia de preparación

Rama/checkout y base verificados; Blender --version devuelve 5.1.0. Leídos NAV/CAT/APP, fixture/servidor y reglas aplicables. El servidor actual usa root tests/browser y carece de publicDir de raíz: ajuste identificado e incluido en el alcance. Sin ejecución de tests de PRE-001 ni exportación de modelos en esta fase. Engram no disponible; registro compartido en estos documentos y Trello.

## Entrega PRE-001 — 14/10/2026

Estado: **implementación local completada para revisión humana**, en codex/presentation-3d-v1 desde a9d8d83. Reserva de implementación finalizada. Sin commit, push, PR ni merge de esta entrega.

### Resultado

Actor presentation real con estado propio, bootstrap APP, recepción NAV/action y publicación inmutable/publication. API pública en src/presentation/index.ts. Actor/datos sin Three.js, reloj o I/O, con guard AST significativo. Nuevos contratos y receta presentation.fixture v1; productores de inicialización concretados conforme a APP existente. Contratos e implementaciones core/APP/NAV/CAT conservados; navigation.fixture y recordings anteriores no migrados.

Nueve GLB autocontenidos, .blend y generador Blender: siete módulos, suelo y obstáculo; ejes, sockets y huella inspeccionados cargando los archivos. Total GLB 69028 bytes. Fixture CAT-002 propia y manifest estricto/canónico con SHA-256 verificado antes de carga. Recursos ausentes/inválidos y sockets faltantes producen marcadores magenta y diagnóstico, sin alterar equipamiento o simulación.

Three.js 0.186.1 y @types/three 0.186.0 fijados; instalación --ignore-scripts, sin scripts de build. Cámara ortográfica ajustable, IDs sobre robots, colores/formas contrastantes, vista lógica 2D del mismo encuentro, sockets/rutas/casillas oficiales activables, exacto/suave, pausa real y control externo independiente. Cambio de equipamiento mediante JSON del próximo encuentro y definiciones de ruedas/orugas, armado/desarmado.

Reloj externo inyectable con 120 ms limitados por CD*50 ms y velocidad; sin predicción ni colas de animaciones antiguas. Precarga, clones con geometría/materiales compartidos por gestor, referencias y cancelación por generación. Agrupación de primitivas rígidas e instancias de suelo conserva sockets/escala. Cierre libera también rótulos, observadores, controles, loops y contexto gráfico.

Laboratorio en http://127.0.0.1:5173/, servido desde este checkout (sesión de servidor 52253 al verificar). Nuevo panel con nueve presets, mensajes manuales de fixture, controles parciales/N ticks/continuo, edición JSON previa, fallo de archivo/socket/carga demorada/WebGL, reconstrucción, segunda sesión/escena, importación/exportación de escenario/replay, reporte y debug JSONL con pendientes/reintento. El sobre de replay 3D añade metadata visual; ReplayRecording v1 permanece intacto.

### Evidencia TDD y verificaciones

- RED de proyección: arranque rechazado por actor provisional; GREEN con implementación por mensajes. Confirmación pública, ausencia de alias, aislamiento, duplicados/rechazos y replay comprobados.
- RED de reloj y recursos: poses/animaciones ausentes y adquisición provisional rechazada; GREEN con pausa, CD1, cambios de velocidad, leases y cierre durante carga. Un fallo de helper de prueba que usaba playback en lugar de loadReplay se corrigió; no cuenta como RED de producto.
- RED de manifest: campos/URLs/sockets inválidos aceptados; GREEN con validación estricta. Canonización protege también orden irrelevante de miembros y sockets.
- RED de agrupación: dos meshes del mismo material seguían siendo dos; GREEN conserva límites mundiales/sockets con una sola geometría agrupada.
- RED de cadencia: cantidades de frames incorrectas; GREEN con resto temporal y reanudación sin backlog para pantallas 60/90/144 Hz.
- Browser RED: pérdida/restauración/reconstrucción produjo 62 warnings de handles WebGL pertenecientes a la generación anterior. Inspeccionados onContextRestore/onGeometryDispose del three instalado; GREEN tras liberar durante context loss y reconstruir explícitamente. Prueba repetida sin warnings nuevos y con contexto/posiciones lógicas conservados.
- Browser: la notificación de tanda completada precedía a actualizar métricas después del flush, causando comparación aparente distinta al exportar/importar. Reordenado para publicar evidencia final antes del aviso; repetición con mismas posiciones. Dos intentos de automatización no abrieron el editor plegado y terminaron en timeout; no se registran como fallos de producto ni como pruebas aprobadas.
- npm test: **198/198 aprobadas**, 20 nuevas, 0 fallidas/omitidas; las 178 anteriores se conservan.
- npm run typecheck: aprobado, tsc --noEmit. Node 24.14.0, TypeScript 5.9.3; Blender 5.1.0. Formato de archivos TS nuevos mediante AST printer de TypeScript, sin emisión JS ni compilación.
- Revisión de alcance, espacios/enlaces y git diff --check; sin builds de software.

### Navegador, logs y rendimiento

- Nueve presets con 24 ticks adicionales cada uno: replay idéntico en traza y vistas, sin errores gráficos normales. Incluye FIFO, orden inverso, duplicados, CD, sin camino, casilla liberada, intercambio y 12x12/16 robots.
- Avance por siete fases: publicación visual [1,1,1,1,1,1,2]; no se muestra como publicada una posición aún pendiente de publication.
- Ejecución continua/pausa: posiciones lógicas y poses visuales estables después de pausar. Solicitud manual antes del CD rechazada sin traslado; repetición elegible aceptada; replay idéntico con las entradas manuales.
- Segundo controlador y segundo renderer simultáneos: dos escenas/gestores independientes, 9 recursos cada uno, primera sesión intacta.
- Recursos/sockets ausentes y carga demorada cerrada: diagnóstico visible, simulación sana/replay coherente; canvas no reaparece al terminar la carga vieja.
- Pérdida/restauración/reconstrucción: mismo contexto y mismas posiciones, sin warnings nuevos después de corregir la liberación. Warnings históricos de las pruebas RED permanecieron en la consola; no se ocultaron ni cuentan como ejecución GREEN.
- Exportación/importación real de replay 3D y escenario: mismas posiciones/reconstrucción; escenario recuperado después de editarlo. Configuración inválida preserva el encuentro anterior.
- Render 15/30/60 FPS medido aproximadamente 14.90/29.98/59.97 FPS, sin cambios de estado lógico. Matriz automatizada además compara traza/proyección exactas variando FPS/modo y pasos por fase.
- Chrome 155 en Windows, ANGLE/Intel UHD/D3D11, DPR 1.25. Máximo final: aproximadamente **59.8 FPS**, **146 llamadas**, **8192 triángulos**, render CPU observado **1.4 ms** (muestra puntual), 14 geometrías/17 texturas con 16 rótulos. Antes de agrupar: 544 llamadas; después 130 antes de añadir los rótulos. No extrapolar a otras GPUs/plataformas.
- **20 ciclos finales** de abrir/cerrar con rótulos: baseline estable 9 recursos/14 geometrías/3 texturas (dos robots), cero canvases retenidos y cero warnings nuevos. No acredita ausencia absoluta de fugas de heap; acredita esos contadores/casos.
- Áreas 600x600 y 1280x720 inspeccionadas con tablero completo dentro del canvas. Capturas pre-001-600.png y pre-001-final.png en visualizaciones de esta conversación.
- Debug físico, punto de control: 5 JSONL, 1286 registros, 9 publicaciones de PresentationViewPublished; secuencias contiguas sin huecos/duplicación. Se generaron más archivos después. Debug y descargas están fuera del scheduler; un cierre de navegador no garantiza preservar pendientes aún en memoria.
- Fallo de escritura inducido por respuesta HTTP503 de prueba: 163 registros conservados pendientes, sesión ready; reintento escribió exactamente 163 y dejó cero pendientes. El error HTTP de consola fue deliberado. Después de la pérdida de WebGL también se verificaron tres ticks manuales: la generación perdida no adquiere recursos y la reconstrucción usa el último mundo lógico, sin warnings nuevos.

### Límites y continuidad

Kit de diagnóstico; sin arte final, física, giro de ruedas/orugas, rigging, armas/daño reales, hangar/equipamiento vivo o UI de gameplay. Primera ruta WebGL 2 de escritorio; Electron/Steam y otros navegadores no verificados. Los rótulos largos se abrevian en escena y se muestran completos en inspección.

No se prometen píxeles idénticos entre GPUs ni FPS universales. El limitador usa reloj externo, nunca consume ticks. Comparación manual máxima 5000 ticks y exige evidencia completa según núcleo vigente; no se ampliaron presupuestos para permitir trazas incompletas. Recursos gráficos se reconstruyen explícitamente tras context loss, sin reiniciar el combate.

Pendiente: validación humana y eventual instrucción de integración. Engram no disponible; contexto conservado en esta entrega, diseño, decisiones y Trello.
