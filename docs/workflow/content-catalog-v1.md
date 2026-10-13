# CAT-001 — Plan de implementación del catálogo de contenido

Revisión del plan: 1.1.0. Fecha: 13 de octubre de 2026. **La entrega local de CAT-001 y la ampliación del laboratorio están implementadas para revisión.**

## Encargo y base

| Campo | Valor |
| --- | --- |
| Responsable humano | Usuario solicitante. |
| Sistema | Infraestructura de contenido, CAT-001; sin propietario de estado de gameplay. |
| Referencia | [Tarjeta 02](https://trello.com/c/XXyzIPpr), actualizada y movida a Listo para desarrollar; contenido/lista verificados por lectura posterior. |
| Aprobación | Selección de las nueve recomendaciones y primera entrega; autorización mediante «aprobado, implementalo». La pestaña manual del laboratorio fue aprobada mediante «oka, implementá eso en el laboratorio». |
| Base comprobada | main, `d402c32e160f5176f1a5b4c6ce759b08c054455b`; ENV-001 integrado por [PR #2](https://github.com/jonathankozur/robots/pull/2). |
| Rama y checkout | `codex/content-catalog-v1`; `C:/Users/Jonat/.codex/worktrees/content-catalog-v1/robots`. |
| Estado | Implementación entregada por Codex en esta rama/checkout; reserva finalizada. Integración pendiente. |
| Contratos vigentes | Mensajería v1; API del núcleo 1.2; ENV-001 v1; ReplayRecording v1. |

Decisiones normativas: [CAT-001 en decisiones](../decisions.md#cat-001--catálogo-de-contenido-y-primera-entrega). La ampliación aprobada se limita a una herramienta local de desarrollo para editar/validar JSON y observar la fixture de mensajes; no añade interfaz ni reglas del juego.

## Objetivo y entrega observable

Convertir un paquete JSON en definiciones estrictamente validadas, identificables e inmutables. Un error impide usar el paquete completo; un éxito permite entregar datos a consumidores de prueba y reproducir la sesión con exactamente el mismo contenido.

La primera colección tendrá ejemplos mínimos de chasis, núcleo, locomoción, IA, sensores, armas, terrenos y configuraciones completas de robots. Incluirá las referencias visuales y vocabularios de compatibilidad/rareza/tecnología que esos ejemplos necesiten. Cantidades y valores son fixtures, no requisitos de lanzamiento ni balance aprobado. Defensa adicional, utilidad, acciones avanzadas, enemigos/encuentros completos, recetas, botín y efectos se amplían con sus sistemas.

No se implementan movimiento, percepción, IA de juego, ataques, daño, inventario, hangar, renderer ni persistencia. Los consumidores de demostración solo prueban contratos, aislamiento y transporte de datos.

## Arquitectura y propiedad

- El núcleo de contenido recibe datos/texto; no lee archivos, hace fetch, usa reloj, extrae RNG ni importa sistemas de juego. La lectura externa ocurre antes de construir la sesión.
- El paquete validado es un snapshot JSON copiado y congelado profundamente. No se entrega una instancia de servicio con acceso al catálogo vivo ni un Map mutable compartido.
- El ensamblador selecciona el paquete y entrega las vistas inmutables mínimas mediante mensajes de inicialización. Los consumidores conservan solo sus datos necesarios.
- No hay loop de catálogo ni consultas a implementaciones vecinas durante el tick. Los cambios de archivos se aplican al crear otra sesión; no hay recarga de contenido durante un combate.
- El catálogo valida definiciones y configuraciones estáticas de ejemplo. Los helpers de compatibilidad/cálculo serán puros sobre datos explícitos; Hangar será la autoridad de equipamiento real cuando exista. No se duplican existencias ni integridad de robots.
- El `Catalogue` actual del bus registra contratos de mensajes. Este catálogo de contenido será un módulo distinto y no lo reemplaza.

## Contrato de datos v1 implementado

### Paquete, identidad y validación

Un paquete v1 contiene `schemaVersion`, `bundleId`, `contentRevision`, vocabularios referenciados y definiciones por familia. Identificadores estables con prefijo de familia; no se derivan del nombre traducible ni de la posición de una lista. No se renormalizan silenciosamente IDs. Cada familia tendrá un esquema/versiones soportadas explícitos.

Antes de implementar la primera prueba se documentaron las tablas exactas de campos y unidades en [catálogo v1](../architecture/content-catalog-v1.md), dentro del alcance de datos/fixtures aprobado. Cada campo tiene tipo, obligatoriedad y límites. No se admiten campos arbitrarios de estadísticas, propiedades ocultas, getters, funciones, expresiones, prototypes especiales ni referencias de familia equivocada. No se evalúa código contenido en JSON.

Las fases de validación serán: límite de entrada y sintaxis JSON; forma/campos/versiones; valores/unidades; unicidad de IDs; resolución de referencias; coherencia de compatibilidad/configuraciones estáticas. Los diagnósticos incluirán código, ruta, ID cuando exista y explicación; se ordenarán establemente. Se podrá informar más de un error seguro de contenido, sin publicar un resultado parcial ni continuar validaciones sobre estructuras inválidas.

Para cantidades y duraciones se usan las unidades de ENV-001: enteros seguros, cantidades escaladas, probabilidades 0..10000 cuando correspondan y ticks de 50 ms. Cada esquema declara la unidad, sin números flotantes ambiguos ni redondeo implícito. Los valores de las primeras fichas no aprueban fórmulas de combate.

### Componentes, slots y visuales

La configuración de robot de ejemplo referencia chasis, núcleo, locomoción, IA y sensor separados. Armas, defensa adicional y utilidad pueden quedar ausentes. El chasis declara slots identificados; cada montaje utiliza categoría, tipo y tamaño explícitos. Propuesta inicial: coincidencia exacta de tamaño y tipo, sin inferir que una pieza menor encaja siempre en un montaje mayor. Las excepciones futuras se declaran como compatibilidades explícitas.

Los ejemplos se comprueban contra slots y presupuesto de energía; exceso de energía rechaza la configuración estática, sin penalización implícita. No se agrega peso, calor ni consumo de energía por tick. No se fijan el número de slots de todos los chasis ni jerarquías de tamaños del juego final.

Rareza y tecnología tienen identificadores independientes. El paquete declara las opciones utilizadas por sus fixtures; no hay escala universal de poder, afijos aleatorios, desbloqueos, tablas de obtención ni multiplicadores derivados de esas etiquetas.

Las referencias visuales utilizan `resourceId` y puntos de montaje `socketId`, relacionados con slots. Se valida la coherencia de esas referencias declaradas. Los ejemplos sin assets reales utilizan recursos de prueba identificados; no se declara que un archivo existe o encaja físicamente. Esa verificación corresponde a Presentación 3D. No se incluyen código de carga de modelos ni convenciones geométricas definitivas.

### Inicialización y replay sin modificar el núcleo

Se conserva el snapshot completo y canónico del paquete pequeño en `SessionOptions.initialState.content`, incluyendo formato e identidad/revisión. El manifiesto existente ya registra `initialState` y el replay exige igualdad exacta. Así, modificar valores aun conservando la misma revisión también produce incompatibilidad; una etiqueta de versión por sí sola no se usa como prueba de identidad.

Ordenar definiciones y vocabularios por ID; conservar el orden de secuencias que tengan significado declarado. Respetar los presupuestos vigentes de 1 MiB del estado inicial y su envoltura con metadata, además de los límites de payload al distribuir vistas pequeñas. El catálogo de contratos del bus se añade posteriormente al manifiesto; el núcleo no impone allí un límite agregado de 1 MiB. Rechazar los excesos de los presupuestos existentes antes del avance; no subir límites ni truncar datos para acomodar el catálogo.

El replay usa la copia registrada, validada bajo un formato soportado, o un paquete que coincida exactamente. No migra grabaciones silenciosamente ni introduce un loader entre runtimes. Las sesiones históricas no reciben un campo de contenido nuevo por defecto.

En la fixture, un adaptador `content-bootstrap` admite inicializaciones pequeñas en input; cada propietario de prueba recibe su comando exacto en una fase declarada y registra la revisión recibida. Esos contratos son de demostración, separados de los mensajes de producción que se diseñen en la tarjeta 03. No se cambia Publisher, Session, fases, orden, debug ni ReplayRecording v1.

## Alcance aprobado para ejecución

- `src/content/**`: contratos de datos, esquemas/validadores por familia, compilación/copia del paquete, resolución de referencias y helpers puros.
- `content/fixtures/**`: paquete mínimo JSON y ejemplos válidos/incorrectos de prueba.
- `tests/core/content-*.test.ts`, `tests/core/content-fixture.ts`: validación, aislamiento, inicialización y replay de consumidores de prueba. Se integran en el script de pruebas existente.
- `docs/architecture/content-catalog-v1.md`, esta ficha y la entrada CAT-001 de `docs/decisions.md`: especificación y evidencia final.
- No editar `src/core/**`, controles previos, package.json/lockfile ni otros sistemas. No se necesitan dependencias nuevas. La pestaña del catálogo se limita al laboratorio de desarrollo; no es una interfaz del juego.
- El checkout original, `event-bus/`, las ramas anteriores y acciones remotas de GitHub quedan fuera.

## Secuencia de implementación

1. **Concretar esquemas v1 y contratos de fixture.** Escribir tablas de campos/unidades, ejemplos, límites y productores/receptores/fases de inicialización. Confirmar que el alcance compartido no tenga otra implementación activa.
2. **Parser y validación estructural con TDD.** Primero pruebas que fallen por sintaxis, campos/versiones inválidos y datos ocultos; implementar el mínimo para validarlas sin I/O ni ejecución de getters.
3. **Referencias y compatibilidad con TDD.** Probar IDs repetidos, referencias ausentes/de otra familia, slots/montajes/tamaños incompatibles, componentes obligatorios y energía excedida en ejemplos estáticos.
4. **Snapshot canónico e inmutable con TDD.** Probar copias profundas, entrada modificada después de validar, consumidores intentando alterar datos, independencia entre paquetes y equivalencia ante reordenamientos sin significado.
5. **Colección mínima de ejemplos.** Crear paquete JSON completo de prueba y diagnóstico de variantes inválidas. Documentar cada valor como demostración; no presentar balance definitivo.
6. **Integración de fixture y replay con TDD.** Distribuir vistas por mensajes; comparar ejecuciones con distintos avances; comprobar revisión y contenido exactos, rechazo de cambios y conservación de sesiones legacy.
7. **Regresión y entrega.** Ejecutar `npm test`, `npm run typecheck` (`tsc --noEmit`) y `git diff --check`. Revisar diff frente a base actual y registrar evidencias/limitaciones. No hacer builds, push, PR ni merge sin una solicitud posterior.

## Ampliación aprobada: pestaña manual del laboratorio

El usuario autorizó incorporar una sección independiente para probar CAT-001 desde el navegador. Se conserva la rama y checkout propios de CAT-001. Alcance editable: `tests/browser/content-panel.ts`, su montaje y navegación en `tests/browser/lab.ts`, estilos en `tests/browser/lab.css`, declaración del import JSON, guía manual y esta ficha/contrato. No cambia `src/content/**`, `src/core/**`, contratos, fases, dependencias ni el formato del paquete.

La pestaña carga el ejemplo, permite editar o importar un archivo JSON de hasta 1 MiB, valida mediante `parseContentJson` y muestra diagnósticos por código y ruta. Si el paquete es válido, deja elegir robot/terreno y distingue la validez del catálogo de los requisitos específicos de la demo: chasis, locomoción y arma existentes. Al iniciar la fixture, ofrece Paso/Fase/Tick, traza reciente, manifiesto inicial y vistas independientes de navegación/combate. La sesión fija su contenido; los controles de edición se bloquean hasta cerrarla. No ejecuta código contenido en el archivo.

Alternativa descartada: poner controles en Entorno determinista. Eso mezclaría dos fixtures y dos propósitos; una pestaña separada conserva una entrada clara para cada sistema. Criterios observables: paquete inválido no crea sesión y muestra errores; paquete válido se valida aunque no tenga robot apto para la demo; fixture apta recorre sus mensajes y hace visibles las dos vistas de consumidor; editar/importar está bloqueado mientras la sesión corre.

Verificación de esta ampliación: `npm test` aprobó 129/129 pruebas de core y harness; `npm run typecheck` (`tsc --noEmit`) y `git diff --check` también aprobaron. La pestaña se abrió visualmente en el navegador: se confirmó el ejemplo cargado, el estado «Paquete válido», los selectores y los controles. No se inició la fixture desde la interfaz; el flujo de paso/fase/tick, las entradas inválidas y la importación de archivos siguen pendientes de prueba manual. No se ejecutó un build.

## Criterios de aceptación

| Criterio | Evidencia prevista |
| --- | --- |
| JSON inválido, campos desconocidos, versiones no soportadas y números inseguros se rechazan | Suite de parser/esquemas con códigos y rutas de error. |
| IDs/referencias y vocabularios son coherentes | Suite de unicidad, referencias cruzadas y familia incorrecta. |
| Ejemplos completos respetan separación de componentes, slots y energía | Casos válidos y cada incompatibilidad aislada; sin estado de Hangar. |
| Un error no devuelve catálogo parcial ni inicia la fixture | Prueba de resultado atómico y barrera de arranque. |
| Datos copiados/inmutables y consumidores aislados | Mutación del original, intentos de escritura y dos sesiones independientes. |
| Orden de archivos/definiciones sin significado no cambia resultados | Comparación canónica y de trazas de fixtures. |
| Sesión identifica su contenido exacto y lo conserva | Inspección de initialState/manifiesto; cambio de archivo afecta solo otra sesión. |
| Replay coincide y rechaza cambios incluso con revisión reutilizada | Comparación de traza/resultado y rechazo con valores, ID, revisión o esquema diferentes. |
| Núcleo legado conserva comportamiento | Suites existentes verdes, sin defaults ni modificación de contratos del núcleo. |
| Recursos visuales son referencias verificables como datos | Fixtures con resourceId/socketId válidos e inválidos; carga/encaje reales explícitamente no verificados. |

La tabla conserva los criterios del plan original. La evidencia ejecutada y su correspondencia se registran en la entrega inferior. Node es el entorno verificado; no se acredita Chrome/Electron, rendimiento del juego completo ni guardados persistentes.

## Ampliaciones y decisiones posteriores

Las nueve decisiones de la primera entrega están cerradas y el plan técnico fue autorizado. Cuando lleguen los consumidores se diseñarán fórmulas/reglas de movimiento, sensores, IA, armas y daño; límites finales de estadísticas; escalas de rareza/tecnología; recetas, efectos, botín y assets reales.

No cargar familias futuras con campos libres o ejecutables para evitar versionarlas. Una ampliación incompatible necesita revisión de productores/consumidores, nueva versión y estrategia explícita para snapshots/replays. Si el paquete deja de caber en los presupuestos actuales, presentar otra propuesta antes de alterar el núcleo.

## Entrega y verificación ejecutada

Estado: **entregado localmente para revisión humana; integración GitHub pendiente**. La implementación de la revisión 1.0 fue autorizada mediante «aprobado, implementalo». Reserva de implementación finalizada. Responsable humano: usuario solicitante. Ejecutor: Codex, rama/checkout propios de CAT-001.

### Archivos y contratos

- src/content/{contracts,validation,schema,references,canonical,catalog,index}.ts: contrato tipado, límites/diagnósticos, esquemas estrictos, coherencia de referencias/equipamiento, canonización y API pura.
- tests/browser/content-panel.ts, lab.ts, lab.css, env.d.ts y README.md: pestaña manual local del catálogo y su guía de uso.
- content/fixtures/basic-v1.json y README.md: colección mínima y ejemplos inválidos documentados sin duplicar paquetes grandes.
- tests/core/content-{validation,references,snapshot,fixture,architecture}.test.ts y content-fixture.ts: 38 pruebas nuevas y ensamblado de consumidores independientes.
- docs/architecture/content-catalog-v1.md, esta ficha y docs/decisions.md: contrato, decisiones, autorización y evidencia.

Paquete/formato CAT-001 v1 y dos comandos de fixture v1 documentados. El snapshot de contenido usa el initialState ya existente. No se modificaron src/core/**, fases, colas, Publisher, ReplayRecording v1, package.json/lockfile, tsconfig ni controles anteriores. Typecheck alcanza src/content por sus importaciones desde las pruebas incluidas en el proyecto.

### Evidencia real

- Dependencias existentes: npm ci --ignore-scripts; sin scripts de instalación ni nuevas dependencias.
- TDD estructural: 11 pruebas fallaron contra los exports provisionales por la conducta faltante; parser y esquemas las hicieron pasar.
- TDD semántico: 9 pruebas fallaron porque no se resolvían referencias/compatibilidades ni presupuestos; implementación posterior hasta verde.
- Snapshot: 3 conductas ya estaban satisfechas por la copia/congelación compartida; 2 pruebas nuevas fallaron por orden de colecciones y redondeo de tokens JSON. Se agregaron canonización y validación lexical de enteros antes de admitir datos.
- Integración: 7 pruebas fallaron contra la factory provisional; la prueba legacy ya pasaba. Después pasaron inicialización diferida, fases, vistas mínimas, pausas/debug, independencia, fijación de contenido, replay, cambios de valores/revisión/runtime y rechazos del propietario.
- Un control adicional falló porque COMPONENT_CATEGORIES solo era readonly en tipos. Se congeló el array también en ejecución; categorías y límites públicos son inmutables.
- Dos comprobaciones adicionales ejercitan límites y cierre del núcleo existente: paquete válido cercano a 1 MiB que excede la envoltura inicial al añadir metadata, y selección/cierre de la fixture. No se alteró el núcleo para hacerlas pasar. La especificación distingue este presupuesto del manifiesto final con catálogo de contratos.
- npm test: **129/129 aprobadas**, incluyendo 38 nuevas y las 91 anteriores; Node **24.14.0**.
- npm run typecheck: aprobado; TypeScript **5.9.3**, tsc --noEmit.
- Demostración ejecutada: parseContentJson del archivo real, construcción de la fixture, dos comandos en input y un tick completo. Navigation recibe terreno/movilidad (3 ticks); Combat recibe chasis/arma (100000/2500 unidades). Cada vista conserva bundle.lab, revisión lab-1, y no recibe las definiciones de su vecino.
- Base remota reconsultada: origin/main permanece en d402c32. Rutas protegidas y contratos del núcleo sin diff. git diff --check y revisión de espacios finales de todos los archivos de CAT-001 aprobados; enlaces locales y alcance comprobados.

### Aceptación y límites

Los diez criterios de este plan quedan aprobados mediante las suites indicadas: esquema/diagnósticos atómicos (validation), referencias/componentes/energía/visuales (references), aislamiento/canonización (snapshot), inicialización/manifiesto/replay/legacy/límites (fixture) y dependencias/capacidades (architecture). Se comprueba el dato visual, no archivos 3D ni encaje físico.

Hallazgo corregido: JSON.parse puede convertir 1.00000000000000001 en 1. Validar solamente Number.isSafeInteger después del parse habría admitido un número fraccionario original. El parser verifica los tokens numéricos y rechaza notación decimal/exponencial y enteros inseguros. La entrada de objeto no puede reconstruir la escritura original de un Number ya redondeado; archivos externos deben pasar por parseContentJson.

El paquete es inmutable y completo; no es un servicio vivo ni un estado compartido de gameplay. Los consumidores son fixtures y la factory de integración exige un robot armado para demostrar ambas vistas; el catálogo sí admite robots desarmados válidos. Recursos son placeholders declarados; el perfil de comportamiento de las fichas es de fixture.

No se hicieron builds ni pruebas en Electron. La revisión visual en navegador no cubrió el flujo completo de interacción. No se hicieron benchmarks del juego, assets reales, persistencia ni migración de formatos. El guard de arquitectura es evidencia estática, no sandbox de código hostil/Proxy. Engram no está disponible en esta sesión; las decisiones y hallazgos quedan conservados en estos documentos compartidos, sin afirmar un guardado en memoria externa.

Continuación: revisión humana de esta entrega. Otros sistemas pueden diseñar sus vistas de inicialización y ampliar familias/versiones desde esta base sin acceder a implementaciones vecinas. Un formato incompatible o un catálogo que supere los límites existentes exige una nueva propuesta antes de modificar núcleo/consumidores.
