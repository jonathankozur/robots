# Decisiones y habilitación

Revisión documental: **1.6.0**. Actualización: **13 de octubre de 2026**. Conserva la base documental del 9 de octubre.

## Base aprobada

La autorización humana de implementar el plan «Protocolo de agentes y arquitectura de mensajería v1» aprueba la creación de esta base documental. No se interpreta como aprobación de mecánicas tentativas del GDD, del bus ejecutable ni de tareas de implementación del juego.

| Decisión | Consecuencia |
| --- | --- |
| Sistemas especializados pequeños dentro del mismo proceso | Estado propio y fronteras por mensajes; sin transporte distribuido inicial. |
| Simulación determinista por ticks con fases | Reloj lógico y entrega diferida; presentación desacoplada del ritmo de simulación. |
| Datos recibidos mediante mensajes | Vistas locales limitadas, actualizadas por contratos explícitos; sin consultas directas a otro sistema. |
| Persistencia en puntos seguros entre encuentros | Snapshots coherentes y confirmados; no se reanuda una batalla a mitad. |
| GitHub público | Repositorio público `jonathankozur/robots`, con `main` protegido por PR, conversaciones resueltas e historial lineal; no exige aprobación de otro desarrollador. Ver [colaboración](workflow/collaboration.md#estado-del-repositorio). |
| Plan breve aprobado antes de implementar | Aprobación específica del alcance, sin renovarla para acciones ya autorizadas. |
| Revisión de integración | El responsable humano decide; el autor puede fusionar su PR tras revisión técnica y autorización explícita. |
| Primera entrega: documentación y skills | Sin scripts de control, motor, bus, pruebas de juego ni tareas nuevas. |

El GDD original permanece en [diseno_autobattler_robots.md](../diseno_autobattler_robots.md). Sus propuestas de cantidades, IA, componentes y progresión conservan sus estados originales.

## Requisitos pendientes

| Requisito | Evidencia necesaria para habilitarlo |
| --- | --- |
| Integración de presentación y escritorio | Tecnología aprobada en TEC-001; Vite verifica el arnés local en BUS-002. Three.js, presentación del juego y Electron siguen pendientes. |
| Aritmética, precisión, frecuencia de ticks y algoritmo aleatorio | Resuelto para infraestructura por ENV-001; fórmulas/balance de gameplay requieren sus propios contratos. |
| Integración del bus y scheduler v1 | Integrados en main por PR #1 (050f831); ENV-001 integrado por PR #2 (d402c32), base de CAT-001. |
| Controles ejecutables de gameplay | Controles locales del núcleo implementados; ampliar a productores/consumidores reales cuando existan. |
| Git y repositorio compartido | Repositorio real, rama base, colaboradores identificados y checkouts separados. |
| Checks obligatorios de GitHub | Workflows y verificaciones ejecutables que se puedan exigir a cada PR, más evidencia de su bloqueo ante fallos. |
| Base de datos | Elección humana y definición de snapshots, almacenamiento, migraciones y operaciones permitidas. |
| Multiplayer | Autoridad, sincronización, autenticación y protocolo externo. La base solo fija el límite del adaptador. |

El primer desarrollo de infraestructura, una vez elegida la tecnología, debe hacer ejecutables los contratos y escenarios del bus. Los sistemas de gameplay se habilitan después de aprobar y verificar esa infraestructura. Esto evita exigir pruebas del bus antes de permitir construir el propio bus.

La prohibición de builds permanece vigente. Si el motor exige compilar para una prueba, esa verificación queda pendiente hasta que el humano autorice explícitamente una excepción; no se la declara exitosa ni se sortea mediante otro comando.

## Registro de decisiones posteriores

Cada decisión posterior debe conservar: identificador, fecha, estado (propuesta/aprobada/sustituida), aprobación humana, contexto, alternativas y consecuencias, sistemas y contratos afectados, y referencia a la decisión que sustituye si corresponde. Una propuesta o un recuerdo del agente no es una aprobación.

### COL-001 — Flujo liviano para PR y merge

Fecha: 11 de octubre de 2026. Estado: **aprobada e implementada por solicitud explícita del usuario**. Sustituye las reglas de aprobación externa del registro inicial y las instrucciones anteriores de PR.

- Un issue de GitHub no es requisito para abrir PR; enlazar issue, tarjeta de Trello o plan es opcional.
- `main` sigue requiriendo PR. El autor puede fusionar su propio PR cuando el responsable humano lo autorice expresamente, después de una revisión técnica del diff. No se exige un segundo desarrollador aprobador.
- La revisión informa base, cambios, conflictos, opciones, riesgos y recomendación. El responsable humano elige soluciones que cambien comportamiento o determinen qué trabajo conservar. El agente aplica esa elección y vuelve a verificar; no decide por el usuario.
- Se mantienen conversaciones resueltas, historial lineal, bloqueo de force-push y protección contra borrado. Los checks se ejecutan si el repositorio los configura; actualmente no hay checks requeridos.
- La protección de GitHub se actualizó en esta intervención: `required_approving_review_count=0`, `require_last_push_approval=false`. Las aprobaciones obsoletas siguen descartándose cuando corresponda; revisión de propietario de código sigue desactivada.

Motivo: mantener trazabilidad y revisión por PR sin hacer depender un equipo pequeño de una ficha adicional o de la disponibilidad de un segundo aprobador. No se elimina la autorización humana para cambios remotos ni la decisión humana sobre conflictos.

### TEC-001 — Tecnología base y representación

Fecha: 11 de octubre de 2026. Estado: **aprobada para BUS-001**, incluida la elección tecnológica presentada antes de la autorización «ok, autorizado». Responsable humano: usuario solicitante. Reemplaza el pendiente de motor/lenguaje para esta infraestructura.

- Lenguaje: TypeScript estricto y módulos ES, con sintaxis borrable para las pruebas nativas de Node.
- Simulación: núcleo propio por ticks, independiente de bibliotecas gráficas y del reloj real.
- Presentación prevista: Three.js para modelos 3D; Vite para web; Electron para empaquetado de escritorio posterior. Ninguna integración está implementada en BUS-001. Publicar en Steam requiere un encargo posterior.
- Evaluación: Node.js 24, ejecutado en 24.14.0; TypeScript 5.9.3 fijado en el lockfile. El juego web ejecutará JavaScript en el navegador.
- Datos: copia profunda de valores JSON y congelación recursiva, con límites de bytes y profundidad. IDs: enteros positivos seguros por sesión. Orden externo: ingreso serializado, ordinal asignado a la admisión.

Alternativas consideradas: un motor completo aporta editor, herramientas y exportación integrada, con mayor dependencia del motor; el núcleo propio permite controlar las fronteras, a cambio de implementar ensamblado y herramientas. Referencias compartidas o solo readonly serían más económicas, pero no garantizan inmutabilidad en ejecución. Se elige copia/congelación; el costo de asignaciones se medirá antes de introducir pools.

Consecuencias: los sistemas consumen contratos de datos y puertos mínimos; render, red y almacenamiento requieren adaptadores. Node es el entorno verificado ahora. No se afirma determinismo entre navegador y escritorio antes de probarlos.

### BUS-001 — Habilitar y entregar el núcleo de mensajería

Fecha: 11 de octubre de 2026. Estado: **desarrollo autorizado; entregado para revisión humana**. El usuario aprobó el plan basado en la [tarjeta de revisión 0.2](https://trello.com/c/oWqxinQ9), con pruebas Node y tsc --noEmit. La aprobación habilitó este núcleo y sus fixtures; en ese momento no habilitó combate ni acciones de integración.

Alcance y evidencia están en la [ficha de entrega](workflow/bus-scheduler-implementation.md). La [API](architecture/core-api-v1.md) concreta la sintaxis y presupuestos de evaluación manteniendo las fases y reglas de mensajería v1. No hay productores o consumidores de gameplay que migrar. La extracción event-bus conserva su API y archivos originales en el checkout inicial, y no es una dependencia del núcleo.

### BUS-002 — Pausa real, journal debug y laboratorio manual

Fecha: 11 de octubre de 2026. Estado: **desarrollo autorizado; entregado para revisión humana**. Responsable humano: usuario solicitante. Aprobación explícita: «sí voy a necesitar pausa real… implementa la mejora del bus y scheduler… modo debug… archivo log… luego implementa los 10 puntos del arnés». Amplía BUS-001; en ese momento no autorizó integración, PR, push ni merge. La autorización posterior y el flujo aplicable se registran en COL-001.

Se elige un cursor único de ejecución: step ejecuta una unidad completa, stepPhase termina una fase y advanceTick termina el tick actual. Pausar conserva bandeja congelada, cursor y estado propio. El controlador deja de avanzar; no existe reloj autónomo en el núcleo. Suspender instrucciones dentro de callbacks exigiría transformar cada sistema y su contrato de ejecución; no se adopta esa alternativa.

Se elige un journal debug opcional independiente de la traza acotada. El núcleo produce datos inmutables; un adaptador local fuera de la simulación escribe JSONL secuencial. Frente a descarga únicamente en navegador, esta opción deja un archivo físico y admite reintentos, a cambio de requerir servidor local y conservar datos pendientes en memoria. El modo debug no modifica el resultado ni la traza lógica. Cerrar el navegador no garantiza persistir registros pendientes.

El laboratorio configura escenarios con datos y reglas de estado propio, sin código importado. Incluye controles parciales, entradas manuales/programadas, fases/colas/causas, fallos controlados, replay, sesiones independientes y evidencia exportable. Los casos de infracción usan fixtures explícitos; no son permisos nuevos de los sistemas.

Contratos afectados: API Session, inspección, marcadores de fase, journal y maxTicks del manifiesto. Productores/consumidores actuales: fixtures y arnés; sin gameplay que migrar. Grabaciones de manifiesto anterior se rechazan explícitamente. Las fases y el orden de entregas siguen vigentes.

Evidencia, alcance y límites: [entrega BUS-002](workflow/debug-harness-plan.md), [guía manual](../tests/browser/README.md) y [API](architecture/core-api-v1.md). Node y Chrome fueron verificados; no se extrapola a Electron ni a determinismo entre plataformas. La integración se tramita por PR contra la base actual según COL-001.

### ENV-001 — Entorno determinista y verificación de fixture

Fecha: 13 de octubre de 2026. Estado: **desarrollo autorizado; entrega local para revisión**. Responsable humano: usuario solicitante. Decisiones y plan: [tarjeta 01](https://trello.com/c/4pYHaLi7), aprobados mediante «me parece bien la recomendacion sobre las decisiones…». Ejecución autorizada mediante «implementalo. Recorda que tenes que crear un nuevo branch antes de tocar codigo».

20 ticks/s (50 ms/tick); duraciones enteras redondeadas hacia arriba; cantidades seguras escaladas a 1000 y probabilidades a 10000; daño no negativo redondeado hacia abajo al finalizar fórmulas futuras. Se rechazan entradas y productos intermedios inseguros. RNG xoshiro128** 1.1 con semilla hexadecimal explícita y streams por sistema/propósito; derivación FNV-1a64 + SplitMix64 v1. Cada propietario conserva snapshots propios, sin RNG global mutable ni dependencia del frame.

Alternativas y consecuencias en la [especificación](architecture/deterministic-environment-v1.md): frecuencia fija cuantiza tiempos; enteros escalados exigen límites; streams independientes requieren más snapshots. La elección no fija fórmulas de daño, IA, visibilidad ni rendimiento del gameplay.

SessionOptions.environment es opcional para conservar sesiones históricas sin inventar configuración. El perfil se valida y conserva en el manifiesto. ReplayRecording sigue en v1 y mantiene comparación estricta, incluido runtime. La evidencia lógica Node/Chrome es un reporte separado; no habilita importación de replay entre runtimes.

Node 24 y Chrome de escritorio son la matriz inicial. Versiones y evidencia reales en la [entrega ENV-001](workflow/deterministic-environment-v1.md). Sin builds, nuevas dependencias, gameplay, persistencia, Electron, PR ni merge en este encargo.

### CAT-001 — Catálogo de contenido y primera entrega

Fecha: 13 de octubre de 2026. Estado: **plan y ejecución aprobados; entrega local completada para revisión, integración pendiente**. Responsable humano: usuario solicitante. Referencia: [tarjeta 02](https://trello.com/c/XXyzIPpr). Aprobación explícita: seleccionó las nueve alternativas recomendadas y confirmó «Me parece bien tu recomendacion para la primera entrega». Después de documentarlas y presentar el plan 1.0, autorizó su ejecución mediante «aprobado, implementalo».

| Decisión aprobada | Alternativas consideradas y consecuencia |
| --- | --- |
| JSON validado | TypeScript ofrece tipado de autoría pero mezcla datos con código; YAML añade formato/parser. JSON conserva datos declarativos y exige validación al cargar. |
| Estructuras específicas y estrictas por familia | Una ficha universal admite campos ambiguos. Cada familia declara campos, unidades y límites; los campos desconocidos se rechazan. |
| Identificadores estables | Nombres visibles y posiciones se rompen al renombrar/reordenar. La identidad permanece; versiones de formato y revisión de contenido se distinguen. Cada sesión fija sus datos para reproducción. |
| Componentes separados | Integrarlos al chasis reduce combinaciones. Chasis, locomoción, núcleo, IA y sensor son necesarios para una configuración preparada; armas, defensa adicional y utilidad son opcionales. Los ejemplos iniciales incluyen configuraciones completas. |
| Compatibilidad por categoría, tipo de montaje y tamaño | Permitir todo elimina restricciones; enumerar cada pareja crece con el contenido. Slots y componentes declaran compatibilidades estructuradas y puntos de montaje identificables. |
| Energía y compatibilidad de slots | Peso/carga, consumo energético durante batalla y calor agregan reglas y balance. Se conservan presupuesto de equipamiento y slots; esas ampliaciones quedan fuera de la primera entrega. |
| Rareza y tecnología separadas | Una escala única confunde especialización y avance. Son dimensiones independientes, sin multiplicador universal de rareza; primeras piezas con valores fijos. Escalas finales, afijos y probabilidades se diseñarán con sus propietarios. |
| Reglas explícitas en los sistemas | Fórmulas ejecutables en datos exigirían un intérprete. El catálogo aporta parámetros con unidades del perfil ENV-001; cada propietario ejecuta sus reglas. No hay scripts ni evaluación de expresiones en contenido. |
| Identificadores de recursos y puntos de montaje | Rutas/transformaciones particulares acoplan piezas a archivos concretos. Las fichas relacionan recursos visuales y sockets con slots; presentación comprueba posteriormente recursos reales y encaje visual. |

Primera entrega aprobada: infraestructura del catálogo y colección pequeña para probar navegación y combate básico mediante fixtures. Las familias y parámetros crecen cuando se diseñan sus consumidores. Recetas, botín, efectos y balance completo no se anticipan; no se desarrollan sistemas de gameplay.

Base real: main en `d402c32e160f5176f1a5b4c6ce759b08c054455b`, [PR #2 integrado](https://github.com/jonathankozur/robots/pull/2). Rama creada antes de editar: `codex/content-catalog-v1`, checkout propio. [Plan y entrega CAT-001](workflow/content-catalog-v1.md), [contrato v1](architecture/content-catalog-v1.md): catálogo puro JSON, referencias/compatibilidad/energía, snapshots inmutables, fixtures e integración por mensajes/replay sin cambios al núcleo. Verificado con 129/129 pruebas (38 nuevas), typecheck sin emisión y demostración Node. El usuario autorizó después una pestaña independiente en el laboratorio para editar/importar JSON, validar e inspeccionar la fixture; queda documentada como herramienta de desarrollo. Los detalles y límites figuran en la entrega. El encargo no habilita push/PR/merge.

### APP-001 — Ensamblado y ciclo de aplicación

Fecha: 13 de octubre de 2026. Estado: **ocho decisiones confirmadas; plan/contrato 1.0 y entrega aprobados, integración autorizada**. Responsable humano: usuario solicitante. [Tarjeta 03](https://trello.com/c/5bvkqD4N).

El usuario confirmó: (1) estados explícitos y transiciones permitidas; (3) receta explícita con funciones que crean instancias nuevas; (4) disponibilidad después de confirmaciones; (5) validar/preparar el siguiente contexto antes de cerrar el anterior; (6) distinguir rechazo normal de fallo técnico detenido, diagnóstico conservado y recuperación explícita con instancias nuevas; (7) preparar recorrido de restauración sin almacenamiento ahora; (8) controlador externo de ejecución.

Después de explicar qué contiene una sesión y las alternativas, el usuario respondió «ok» a la propuesta de **una sesión nueva por combate, conservando progreso en sus sistemas responsables entre encuentros**. El contexto de aplicación permanece; cada encuentro crea sistemas/bus/scheduler nuevos. Renovar instancias no borra identidad ni daño persistente: esos datos se transfieren explícitamente cuando existan sus propietarios.

Alternativa de sesión global: menos transferencias, más limpieza y riesgo de mezclar encuentros; sesión por sistema: mayor separación, pero múltiples buses/relojes. La opción por combate prioriza aislamiento, cierre y replay, a cambio de contratos explícitos de entrada y resultados.

Autorización actual: documentación, plan y rama codex/application-lifecycle-v1, checkout propio desde main bf8b89b (PR #3). [Plan 1.0 y entrega](workflow/application-lifecycle-v1.md) y [contrato técnico APP-001](architecture/application-lifecycle-v1.md) aprobados para ejecución; entrega local para revisión. El «ok» confirmó la decisión 2. La autorización posterior «comenza la implementacion. Recorda mover la tarjeta a su posicion correspondiente» habilitó ejecutar el plan/contrato 1.0. Entrega: 151 pruebas aprobadas, typecheck sin emisión y recorridos de navegador documentados. Sin gameplay, persistencia ni cambios al núcleo. El responsable humano autorizó después commit, push, PR y merge mediante «hace commit, push, crea el PR y mergea».

## Estado de esta instalación

Al comenzar esta entrega, la carpeta contenía únicamente el GDD y no era un repositorio Git. Se creó `jonathankozur/robots` como repositorio público, se subió la documentación inicial a `main` y se configuraron protecciones de rama. La configuración actual y los controles aún pendientes están detallados en [colaboración](workflow/collaboration.md#estado-del-repositorio).
