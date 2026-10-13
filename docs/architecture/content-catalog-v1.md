# Catálogo de contenido v1 — CAT-001

Revisión: 1.0.0. Plan aprobado por el usuario mediante «aprobado, implementalo». Base: main d402c32. [Encargo y alcance](../workflow/content-catalog-v1.md); [decisiones CAT-001](../decisions.md#cat-001--catálogo-de-contenido-y-primera-entrega). Esquemas de infraestructura/fixtures, sin reglas productivas de combate.

## API y fases de validación

parseContentJson(text) y validateContentBundle(data) devuelven un resultado discriminado: éxito con content, o rechazo con issues. Un rechazo nunca contiene content. ContentIssue contiene code, path, message y definitionId cuando existe. Los errores se ordenan por path/code/ID/mensaje y se limitan a 128, con marcador explícito al excederlos.

Entrada: texto JSON o datos planos. Sin I/O ni getters, capacidades, ciclos, símbolos o prototypes especiales. Texto hasta 1 MiB UTF-8, profundidad 32; hasta 256 entradas por colección, 32 slots/equipamientos y 64 sockets por recurso. No se admite JSON con claves repetidas. Los límites son de infraestructura, no balance del juego.

Primero se valida la forma y los campos de todas las familias. Solo si esa etapa termina sin errores se resuelven las referencias y las configuraciones completas; así no se usa una estructura inválida como si fuera tipada. Cualquier rechazo impide el arranque de la fixture. Definiciones se copian y congelan profundamente.

## Esquemas exactos

Todo campo no declarado se rechaza; todos los campos indicados son obligatorios salvo los marcados opcionales. No hay valores por defecto ni migración automática.

| Registro | Campos |
| --- | --- |
| Paquete | schemaVersion: 1; bundleId: ID bundle; contentRevision: texto estable ASCII (1..128); vocabularies; definitions. |
| Vocabularies | rarities, technologies, mountTypes, sizes, resources: arrays de sus respectivos registros. |
| Definitions | chassis, cores, locomotions, ais, sensors, weapons, terrains, robots: arrays de sus respectivos registros. |
| Ficha común | schemaVersion: 1; id: ID de su familia; name: texto de 1..128 caracteres. |
| Rareza/tecnología/montaje/tamaño | Solo ficha común. Son vocabularios separados, sin multiplicadores ni jerarquías implícitas. |
| Recurso | Ficha común; sockets: array de IDs locales únicos. Es descriptor de prueba, sin ruta ni archivo real. |
| Visual | resourceId: referencia a recurso. Opcional en fichas de chasis/componentes. |
| Chasis | Ficha común; rarityId; technologyId; integrityUnits: entero seguro positivo; slots; visual opcional. |
| Slot | id local único; category: core/locomotion/ai/sensor/weapon/defense/utility; mountTypeId; sizeId; socketId opcional. |
| Componente común | Ficha común; rarityId; technologyId; mounting con mountTypeId/sizeId; energyCostUnits: entero seguro no negativo; visual opcional. |
| Núcleo | Componente común; energyCapacityUnits: entero seguro positivo. |
| Locomoción | Componente común; moveDurationTicks: entero seguro positivo. |
| IA | Componente común; behaviorId: fixture.observe-v1 o fixture.pressure-v1. |
| Sensor | Componente común; rangeHexes: entero seguro no negativo. |
| Arma | Componente común; behaviorId: fixture.direct-v1; impactUnits: entero seguro positivo; reloadTicks: entero seguro positivo; rangeHexes: entero seguro no negativo. |
| Terreno | Ficha común; passable: boolean. |
| Configuración de robot | Ficha común; chassisId; equipment: array de slotId/componentId. |

IDs globales: prefijo singular de familia (bundle, rarity, technology, mount, size, resource, chassis, core, locomotion, ai, sensor, weapon, terrain, robot), punto y slug ASCII en minúsculas. Longitud total máxima 128; slug comienza con letra y continúa con letras/dígitos/guion/punto/guion bajo. IDs locales: letra y hasta 63 letras/dígitos/guiones/guion bajo. No normalizar ni generar IDs desde nombres.

Magnitudes terminadas en Units usan escala 1000 de ENV-001; Ticks son duraciones en ticks de 50 ms; Hexes son distancias enteras. Todas las magnitudes tienen límite Number.MAX_SAFE_INTEGER y se comprueba también el total de energía. El JSON fuente admite solo literales numéricos enteros seguros, sin notación decimal ni exponencial: esto evita que JSON.parse redondee una fracción larga y la valide después como entero. En objetos ya construidos solo se puede validar el Number recibido, no recuperar su escritura original. Estos parámetros describen fixtures; no implementan fórmulas de ataque, movimiento, detección o IA. Ampliar behaviorId implica aprobar su propietario y esquema; no ejecutar texto del paquete.

## Referencias y configuraciones estáticas

Todas las referencias apuntan a una familia explícita. Un prefijo incorrecto es distinto de una referencia con el prefijo correcto pero inexistente. Verificar incluso las fichas que no usa un robot. Slots de chasis y sockets de recursos no repiten identidad local.

Un chasis declara al menos un slot para núcleo, locomoción, IA y sensor. Una configuración completa equipa exactamente uno de cada categoría necesaria; armas son opcionales. Defense/utility son categorías de slots futuros, sin familias de componentes equipables en esta revisión.

fitsSlot(slot, component) es un helper puro: categoría derivada de la familia del componente y coincidencia exacta de tipo/tamaño. No existe la regla implícita «más pequeño siempre encaja». Cada slot recibe como máximo un componente; una definición puede repetirse en slots distintos porque describe un modelo, no una pieza de inventario.

El coste total de los componentes equipados, incluido el núcleo si declara coste, no supera la capacidad del único núcleo. Overflow rechaza la configuración; no saturar ni penalizar silenciosamente. Estos chequeos son coherencia estática de fixtures; Hangar tendrá la autoridad de equipamiento dinámico.

Si un slot declara socketId, el chasis necesita visual y el recurso referenciado debe declarar ese socket. Cuando el chasis declara visual, todos sus slots deben tener socketId. No reutilizar un socket en dos slots del mismo chasis. Visuales de componentes también resuelven resourceId. Esta verificación no demuestra existencia de archivos ni encaje geométrico.

## Canonización, inicialización y replay

Ordenar por ID colecciones de definiciones/vocabularios y slots; sockets son conjuntos ordenados, y equipment se ordena por slotId. No hay secuencias de prioridad en v1. No cambiar nombres, números ni identidades para canonizar.

La fixture conserva el paquete canónico completo en initialState.content. Session comprueba 1 MiB tanto para initialState como para su envoltura inicial (identidad, entorno y límites); un paquete que cabe solo puede no caber junto a esa metadata y se rechaza antes de avanzar. Al iniciar, el núcleo añade aparte su catálogo de mensajes: no se afirma que el manifiesto final agregado tenga un límite total de 1 MiB. Se conservan los presupuestos vigentes sin modificar src/core. Distribuye dos vistas pequeñas y distintas como comandos v1:

| Comando | Productor / emisión | Responsable / recepción | Payload y vigencia |
| --- | --- | --- | --- |
| FixtureInitializeNavigationContent | content-bootstrap (adapter), input | content-navigation-fixture, movement | bundleId, contentRevision, terrainId, passable, locomotionId, moveDurationTicks. Fijo por sesión. |
| FixtureInitializeCombatContent | content-bootstrap (adapter), input | content-combat-fixture, resolution | bundleId, contentRevision, chassisId, integrityUnits, weaponId, impactUnits. Fijo por sesión. |

Cada consumidor escribe solo su vista local, rechaza una segunda inicialización o revisión discrepante y no obtiene la instancia del vecino ni del catálogo. Ninguno implementa navegación/combate reales. El paquete se valida antes de construir la sesión. En replay se reconstruyen propietarios frescos y se usan entradas registradas, sin volver a inyectar ingreso vivo.

ReplayRecording v1 compara manifiestos completos, incluido initialState.content y runtime. Una revisión reutilizada con otros valores también se rechaza. Se puede reconstruir desde la copia incluida en el replay, validándola otra vez. Sesiones legacy conservan manifiestos sin contenido. No modificar src/core ni aumentar límites para aceptar un paquete.

## Límites

No hay interfaz de contenido dentro del juego. El laboratorio de desarrollo ofrece una pestaña manual para validar paquetes y observar la fixture, sin añadir reglas de gameplay ni consultas de consumidores al catálogo vivo. Siguen fuera assets reales, persistencia, hot reload, merges de paquetes, plugins de código, balance final y migración entre formatos/runtimes. El loader proporciona datos/diagnósticos puros.
