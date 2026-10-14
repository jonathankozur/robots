# Independencia de sistemas: investigación y propuesta

Fecha: 14 de octubre de 2026. Estado histórico: investigación previa a la migración. El usuario autorizó posteriormente los cinco pasos de IND-001; consultar la [arquitectura implementada](system-independence-v1.md) y la [entrega](../workflow/system-independence-v1.md). Los hallazgos siguientes describen la base e05aac9 anterior a la extracción; sus referencias a src apuntan ahora a puentes de compatibilidad.

Responsable humano: Jonat, usuario solicitante. Referencia examinada: main, e05aac9330ef0579aeacb2ffc886a2622eb058e8. Checkout: C:/dev/robots. Esta investigación analiza código, configuración, contratos y pruebas existentes; no ejecuta pruebas ni builds. Único archivo creado: este documento. Engram no está disponible en la sesión; las conclusiones quedan en esta fuente compartida.

## Objetivo solicitado

Cada sistema debe poder existir, comprobar sus tipos, compilar cuando se permita generar artefactos y ejecutarse con sus dependencias declaradas sin disponer de implementaciones de otros sistemas. Puede permanecer sin trabajo si no recibe los mensajes necesarios. Los contratos comunes y las bibliotecas puras son dependencias permitidas.

La independencia se comprobará en una carpeta de evaluación que contenga un sistema y sus dependencias declaradas, sin fuentes ni paquetes de sistemas vecinos. La ejecución con otros participantes conservará comunicación por mensajes y propiedad exclusiva del estado.

El usuario quiere trabajar sobre C:/dev/robots. La propuesta mantiene un único repositorio y directorio de trabajo; los paquetes son subcarpetas del proyecto. No requiere otros repositorios Git ni otros checkouts para usarlo.

La independencia de presencia y código no implica automáticamente aislamiento de fallos, procesos separados, incorporación de participantes a una sesión activa ni independencia del protocolo compartido. Esas capacidades requerirían decisiones diferentes.

## Estado actual y hallazgos comprobados

### Lo que ya funciona como frontera

Los actores de navegación y presentación poseen estado en sus propias instancias. Reciben Publisher, procesan mensajes y producen nuevos mensajes; no reciben las instancias de sus pares. El bus copia/congela cargas, valida contratos, productores y fases, y programa entregas. El scheduler ejecuta las fases y los callbacks. La creación y conexión se realiza en el ensamblado.

Fuentes: [bus](../../src/core/messaging/bus.ts), [Session](../../src/core/scheduler/session.ts), [ensamblado](../../src/application/assembly.ts), [navegación](../../src/navigation/actor.ts) y [presentación](../../src/presentation/data/actor.ts).

Esto satisface la separación de implementación y estado descrita en el protocolo actual. La solicitud añade una condición más fuerte: independencia de las fuentes y paquetes de otros sistemas, además de una configuración de ejecución que admita consumidores sin productores instalados.

### Dependencias que impiden la independencia solicitada

| Hallazgo | Evidencia | Consecuencia |
| --- | --- | --- |
| World y Result se definen dentro de navegación | [navigation/contracts.ts](../../src/navigation/contracts.ts), [presentation/data/contracts.ts](../../src/presentation/data/contracts.ts) | Presentación necesita esas fuentes para resolver tipos y esquemas, aunque no invoque el actor de navegación. |
| El módulo de contratos usa un helper privado | navigation/contracts.ts importa copyData desde [navigation/data.ts](../../src/navigation/data.ts); ese archivo también importa validación geométrica y core/index.ts | El consumidor de esquemas arrastra módulos auxiliares del sistema. Mover solo interfaces deja este problema. |
| Actor pertenece al módulo de aplicación | Ambos actores importan su tipo desde application/index.ts; [application/contracts.ts](../../src/application/contracts.ts) también importa ContentBundle y Session | La resolución de tipos está ligada a fuentes del host. import type evita la carga en ejecución, pero no elimina la dependencia para comprobar tipos. |
| El arranque está ligado al protocolo APP | Los actores validan contextId/attemptId/bundleId/contentRevision, emiten ApplicationParticipantInitialized y reciben activación mediante ApplicationContextReady | Un host alternativo necesita reproducir ese protocolo o utilizar un adaptador explícito. |
| El contrato público incorpora una fixture | navigationContracts() autoriza RequestNavigationStep solo desde navigation-agent-fixture | La infraestructura de prueba forma parte de la configuración ofrecida por código productivo. Cambiar el productor exige rehacer ese contrato de sesión. |
| El catálogo exige productores presentes | [Catalogue.start](../../src/core/messaging/catalogue.ts) exige producers.length > 0 y que cada productor esté registrado | Mantener un contrato de entrada sin ningún productor instalado no es una configuración válida actualmente. |
| Hay un único paquete y una configuración general | [package.json](../../package.json), [tsconfig.json](../../tsconfig.json) | No hay fronteras de instalación ni comprobación independiente por sistema. Las pruebas y sus imports incorporan sistemas al mismo programa TypeScript. |
| Las guardas permiten las dependencias actuales | [navigation-architecture](../../tests/core/navigation-architecture.test.ts), [presentation-architecture](../../tests/core/presentation-architecture.test.ts) | Las guardas controlan imports y capacidades concretos; no demuestran aislamiento completo de paquetes ni sus dependencias transitivas. |
| Los helpers puros se importan desde una entrada amplia | [core/index.ts](../../src/core/index.ts) reexporta Session, mensajería, entorno y aritmética | Los imports de valores desde esa entrada tienen un grafo de módulos más amplio que el helper requerido. No es una llamada entre sistemas, pero dificulta extraer dependencias mínimas. |

World y Result viven ahí porque la implementación colocó sus contratos públicos junto al productor. TypeScript no exige esa ubicación. Un paquete neutral de contratos puede contenerlos y ser consumido por navegación, presentación, un reproductor o un productor de prueba.

### Matices para evitar una migración equivocada

ApplicationController llama directamente a validateContentBundle. [CAT-001](content-catalog-v1.md) define ese componente como loader/validador puro, previo al arranque. Esa llamada es una dependencia de biblioteca; no consulta estado de otro actor. Si se decide convertir contenido en un sistema con estado y ciclo propio, habrá que definir su protocolo. No hace falta convertir cada función pura en un mensaje.

Presentación ya separa datos de gráficos. Su entrada pública no exporta PresentationRenderer; el laboratorio lo usa como adaptador externo. El panel obtiene una proyección inmutable a través del observador de salida de aplicación, no lee directamente el estado de navegación. Esa frontera puede conservarse al separar paquetes.

La vista pública de presentación incluye World y Result completos. Hay campos que sí afectan conducta visual: [motion.ts](../../src/presentation/graphics/motion.ts) calcula duración a partir de moveCooldownTicks, con factor 50 y límite 120 ms. No se deben reducir cargas o eliminar campos suponiendo que son irrelevantes. Una proyección propia más pequeña necesita definir qué información conserva y cómo mantiene el comportamiento.

Las rutinas de copia tampoco son intercambiables sin análisis: copyData de navegación admite enteros seguros y usa profundidad 32; snapshotData del núcleo admite números finitos y tiene otro valor predeterminado de profundidad y otros códigos de error. Extraerlas debe preservar restricciones, presupuestos, inmutabilidad y errores relevantes.

Session cambia a failed ante fallos de callbacks. El desacoplamiento de paquetes puede lograrse conservando esa política determinista. Si se pretende que un sistema falle y el resto siga avanzando, se necesita otro diseño de fallos; no se obtendrá moviendo archivos.

## Diseño recomendado

### Paquetes autónomos dentro del mismo repositorio

Utilizar paquetes con nombre, dependencias declaradas, entrada pública y configuración de tipos propias. npm workspaces permite mantenerlos bajo la misma carpeta y enlazarlos durante el desarrollo. [Documentación oficial de npm](https://docs.npmjs.com/cli/v11/using-npm/workspaces/).

Distribución orientativa, que se concretaría en el plan aprobado:

    C:/dev/robots/
      packages/
        system-api/          puertos, mensajes y ciclo de vida neutral
        protocol/            tipos y esquemas públicos por dominio y versión
        values/              utilidades puras y geometría, con entradas pequeñas
        runtime/             bus, catálogo y scheduler
        navigation/          implementación y estado de navegación
        presentation/        proyección de datos por mensajes
        presentation-three/  adaptador gráfico y sus dependencias
        content/             loader y validación estática
      apps/
        lab/                 host, composición y demostraciones

Cada paquete tendrá manifest propio. Un lockfile raíz puede conservar la reproducibilidad del conjunto. La instalación de navegación aislada no debe exigir presentación, Three.js, el laboratorio ni el host de aplicación. El adaptador gráfico declarará Three.js y sus requisitos de navegador como dependencias propias.

Este reparto no obliga a crear un paquete por cada helper. values puede ofrecer entradas limitadas para aritmética y geometría. Su contrato público no debe reexportar bus, scheduler ni sistemas. El runtime dependerá de los contratos genéricos de mensajería, sin importar protocolos específicos del juego.

El ensamblado es el lugar autorizado para importar las implementaciones que se quieran montar. Si app-coordinator se mantiene como actor, su lógica dependerá de system-api y del protocolo de arranque compartido, sin importar implementaciones de participantes. El host se ocupará de construirlos y conectarlos.

En este diagrama cada flecha significa una dependencia de código. Los sistemas comparten puertos y protocolos; el host conoce las implementaciones elegidas.

~~~mermaid
flowchart LR
  Host[Host y ensamblado] --> Nav[Sistema navegación]
  Host --> Pres[Sistema presentación]
  Host --> Runtime[Bus y scheduler]
  Nav --> API[API neutral de sistemas]
  Pres --> API
  Runtime --> API
  Nav --> Protocol[Protocolo público de navegación]
  Pres --> Protocol
~~~

### Contratos comunes organizados por dominio

Un paquete común no debe convertirse en una bolsa con todo el modelo del juego. Debe exponer únicamente datos públicos, identificadores de mensajes, versiones, esquemas y semántica documentada. No contendrá actores, estado mutable, fábricas de mundos, algoritmos de navegación, relojes, recursos gráficos ni imports de sistemas.

Entradas posibles:

    @robots/protocol/navigation/v1
    @robots/protocol/presentation/v1
    @robots/protocol/application/v1

Navegación y presentación podrán importar NavigationWorldReadyPayloadV1 y NavigationStepResolvedPayloadV1 desde la primera entrada. Son nombres orientativos para evitar World/Result ambiguos; los nombres y versiones actuales de los mensajes pueden conservarse en una extracción compatible.

Ambos paquetes dependen del mismo protocolo. El protocolo no depende de ninguno de ellos. Un proveedor distinto puede publicar mensajes equivalentes si cumple su semántica y la autorización del host.

Los tipos de estado interno seguirán privados. El handler consumidor transformará un mensaje público en su vista local. Cambiar un Map privado de navegación no debe modificar los contratos públicos; cambiar el significado de una revisión, un cooldown o un rechazo sí requiere revisar el protocolo.

La propiedad semántica del contrato debe conservar un responsable de dominio y revisión de productores/consumidores, aunque sus archivos estén en el paquete común. La ubicación compartida no concede permiso para alterar contratos unilateralmente.

### Tipos y esquemas coherentes

Actualmente las interfaces y los FieldRule se mantienen manualmente y aparecen conversiones desde Payload mediante as unknown as. El bus valida en ejecución, pero una divergencia entre interfaz y esquema puede superar la comprobación estática.

Recomendación: conservar inicialmente el DSL de FieldRule y su validación exacta; extraer sus primitivas a una dependencia neutral. Diseñar posteriormente inferencia de tipos desde el esquema o una generación controlada que deje una única definición de la estructura. Los tests de contrato comprobarán las restricciones que TypeScript no representa, como rangos, tamaños y campos desconocidos.

Una fachada de mensajes tipados puede comprobar nombres, versiones y payloads al emitir/recibir sin ampliar las capacidades de Publisher. La validación de ejecución sigue siendo necesaria. No se recomienda incorporar una nueva biblioteca de esquemas solo para mover tipos; esa elección tendría que justificar costos y diferencias de conducta.

### Puerto de sistema y adaptación del ciclo de vida

Actor y sus puertos mínimos deben pertenecer a system-api, un módulo independiente de ApplicationController, ContentBundle y Session. El sistema no recibirá capacidades de avanzar ticks, inspeccionar pares, cerrar sesiones o buscar instancias.

Dos opciones para el arranque:

1. Compartir un protocolo de ciclo de vida neutral, que los actores implementen. Es sencillo, pero cada sistema conserva dependencia semántica de ese protocolo.
2. Colocar un adaptador APP en el host que traduzca identidad, comandos de arranque, confirmaciones y activación a los puertos de cada sistema. Da mayor reutilización en otros hosts, a cambio de más ensamblado y verificaciones de la barrera de arranque.

Se recomienda la primera como extracción compatible del puerto; utilizar adaptadores donde la identidad APP o los datos de catálogo no tengan significado para el sistema. La adaptación debe conservar entregas diferidas, confirmaciones por mensajes y el momento aprobado de activación. No debe consultar estado privado ni ejecutar operaciones de un sistema desde otro.

### Separar definición del mensaje y configuración de sesión

| Protocolo compartido | Configuración del host |
| --- | --- |
| Nombre, versión y clase del mensaje | IDs de las instancias instaladas |
| Payload, unidades, restricciones y motivos | Productores autorizados en esa sesión |
| Significado, causalidad, vigencia y orden relevante | Vinculación del responsable de un comando |
| Requisitos semánticos de las fases | Suscripciones y orden explícito de los participantes |

El protocolo de RequestNavigationStep no debe mencionar navigation-agent-fixture. La receta de laboratorio puede autorizar esa fixture; otra receta puede autorizar decisión o un adaptador. Cada configuración debe respetar las fases y la autoridad del contrato.

La primera extracción puede generar los Contract actuales a partir de definiciones neutrales y bindings del host, sin cambiar el algoritmo del bus. Conservará IDs, productores y fases del laboratorio existente. Renombrar IDs cambia manifiestos y puede afectar streams RNG; no es una operación neutra para replay.

### Ejecución sin productores de entrada

Para que un consumidor pueda arrancar en una sesión real sin su proveedor habitual, el runtime necesita distinguir mensajes conocidos de productores activos autorizados. Se propone permitir un evento conocido con cero productores vinculados: sus consumidores pueden permanecer suscritos y esperar; nadie estará autorizado a publicarlo en esa sesión.

Esto cambia la regla actual producers.length > 0 y requiere aprobación específica del contrato del runtime, documentación y pruebas. No equivale a permitir productores desconocidos, registros dinámicos o emisores que suplanten otro ID. El catálogo y las rutas seguirán fijos durante la sesión activa.

La misma separación debe cubrir los comandos recibidos por un sistema aislado: puede existir su esquema y un responsable instalado, con cero productores autorizados en esa composición. Navegación podría registrar RequestNavigationStep y quedar esperando aunque no exista decisión. Nadie podrá enviar ese comando hasta preparar otra composición que autorice un productor. Esta ampliación también requiere revisar la regla de catálogo para comandos; permitir cero productores no elimina su responsable único.

Los comandos conservarán un responsable único cuando estén habilitados. Un cliente debe conocer qué comandos están disponibles en la composición, mediante configuración o protocolo de capacidades; no se debe descartar silenciosamente un comando sin responsable. Un sistema instalado puede recibir un comando de un adaptador o productor alternativo sin necesitar la implementación habitual de decisión.

Cada sistema documentará su comportamiento sin entradas iniciales: espera, estado no disponible o rechazo tipado. Presentación ya espera a world antes de publicar una vista. Datos inválidos recibidos, revisiones contradictorias y ausencia de datos son condiciones distintas; conservar esa diferencia.

La independencia se refiere a montar una sesión sin ciertos sistemas. Incorporarlos después del arranque o recuperar vistas con gaps requeriría protocolos adicionales de snapshot/resincronización. No se incluirá hot plug implícito en esta migración.

## Matriz de productores y consumidores vigentes

| Contrato | Productor actual y emisión | Consumidores actuales y recepción |
| --- | --- | --- |
| NavigationWorldReady v1 | navigation, input durante activación | navigation-agent-fixture en decision; navigation-lab-observer y presentation en action |
| RequestNavigationStep v1 | navigation-agent-fixture, decision | navigation, movement |
| NavigationStepResolved v1 | navigation, movement | navigation-agent-fixture en decision del tick posterior; navigation-lab-observer y presentation en action |
| InitializeNavigationBoard v1 | app-coordinator, input; definición creada por receta APP | navigation, movement |
| InitializePresentationView v1 | app-coordinator, input; definición creada por receta APP | presentation, action |
| ApplicationParticipantInitialized v1 | participantes en su fase de inicialización | app-coordinator y app-output, publication |
| ApplicationContextReady v1 | app-coordinator, publication | participantes y app-output, input del tick posterior |
| PresentationViewPublished v1 | presentation, action | app-output, publication; después el host entrega la proyección al adaptador visual |

Fuentes de montaje: [navigation-fixture](../../tests/core/navigation-fixture.ts), [presentation-fixture](../../tests/core/presentation-fixture.ts), [assembly](../../src/application/assembly.ts). También se deben revisar los rechazos y observaciones de fixtures, pruebas de replay, paneles y tipos públicos de contenido usados por el host. Los actores de combate de las demostraciones son fixtures, no sistemas productivos completos.

## Estrategia de migración propuesta

1. **Extraer las fronteras sin cambiar mensajes.** Crear system-api, el protocolo neutral y las utilidades necesarias. Sacar los esquemas de helpers privados. Cambiar imports de sistemas y consumidores. Conservar forma, versiones, fases, IDs, budgets y errores relevantes. Un puente temporal desde las entradas antiguas hacia las nuevas puede mantener imports históricos; los paquetes nuevos nunca importarán las entradas antiguas.
2. **Formalizar los paquetes.** Crear manifests, exports y configuraciones por paquete; separar laboratorio, pruebas unitarias de sistema e integración. Mantener el núcleo y el sistema de datos de presentación libres de DOM y bibliotecas gráficas en sus configuraciones propias.
3. **Mover bindings al ensamblado.** Extraer la referencia a navigation-agent-fixture del protocolo. Conservar primero la misma configuración en las demostraciones, y añadir una composición con otro productor que cumpla el protocolo.
4. **Habilitar consumidores sin productores.** Aprobar y ejecutar el cambio de catálogo para eventos y comandos con responsable instalado descrito arriba, con autorización intacta de emisión y ausencia explícita de capacidades de comandos no instalados. Adaptar el arranque APP para que su lista requerida corresponda a los participantes de la composición.
5. **Demostrar aislamiento y equivalencia.** Verificar cada sistema sin fuentes de pares y luego el conjunto. Mantener las pruebas de arquitectura existentes y reforzarlas con un grafo de dependencias, controles negativos y entorno aislado.

Las proyecciones públicas mínimas, una fachada de mensajes tipados y adaptadores adicionales de ciclo de vida pueden hacerse después. Reducir PresentationViewPublished o cambiar semántica requiere su propia versión/migración; no debe mezclarse con una extracción de ubicación.

### Compatibilidad

Mover archivos y tipos puede preservar el protocolo de ejecución, aunque rompa imports de consumidores. Si existiesen paquetes publicados, su API y versión de paquete necesitarían tratamiento independiente de contractVersion de cada mensaje. Actualmente el paquete raíz es privado.

El replay compara manifiestos completos y la aplicación comprueba la revisión de receta. La extracción compatible debe conservar configuración y contenido serializados. Cambiar bindings, productores ausentes, formatos o la revisión debe tener una estrategia explícita: aceptar grabaciones anteriores con equivalencia demostrada o rechazarlas claramente. No se promete compatibilidad automática.

Conservar la política fail-fast, el orden de fases, la causalidad, la aritmética, la admisión externa, los límites y el cierre de recursos. El refactor no autoriza modificar balance, navegación, render ni gameplay pendiente.

ProtocolError se reconoce mediante instanceof en Session y ApplicationController. No se debe copiar su clase a cada paquete: instancias de clases duplicadas pueden dejar de reconocerse como el mismo error y perder su clasificación. La API compartida debe conservar esa identidad, y la evaluación de paquetes instalados debe cubrir la propagación de errores. Cambiar a otro mecanismo de clasificación sería un cambio de conducta separado.

### Alcance a concretar antes de implementar

| Área | Cambios previstos |
| --- | --- |
| src/core/messaging y src/core/index.ts | Separar API mínima de implementación; revisión específica de catálogo para contratos sin productores activos, conservando responsable único de comandos. |
| src/navigation y src/shared/hex-grid | Extraer contratos/utilidades públicas; separar bindings; conservar algoritmo y estado propios. |
| src/presentation/data | Importar protocolo neutral y API; preservar proyección y validaciones. |
| src/presentation/graphics | Paquete/adaptador independiente, conservando conducta visual. |
| src/application y src/content | Host, puertos neutrales, datos de arranque y clasificación del loader puro. |
| tests/core, tests/harness, tests/browser y scripts | Actualizar entradas, recetas, productores de prueba y verificaciones de aislamiento/integración. |
| package.json, package-lock.json y tsconfig | Configuración por paquete y resolución compatible con Node/Vite. |
| Documentos de arquitectura, decisiones y guardas | Registrar las fronteras aprobadas y sus pruebas. |

Los assets, fórmulas del juego y nuevos recursos remotos quedan fuera de este diseño. No se han creado tareas, issues, tarjetas ni PR. La implementación deberá recuperar base actual y reserva de alcance antes de ejecutar el plan aprobado.

## Evidencia que deberá demostrar independencia

- El paquete de protocolo se importa sin tener instalado ningún sistema ni runtime ejecutable; no tiene dependencias transitivas hacia ellos.
- Navegación resuelve tipos y se ejecuta con system-api, protocolo y utilidades, sin aplicación, presentación ni fixtures productivas obligatorias.
- Presentación resuelve tipos y procesa mensajes sintéticos válidos sin código ni paquete ejecutable de navegación. Esas pruebas validan conducta de proyección, revisiones, duplicados y rechazo de contradicciones.
- Una sesión con presentación como único sistema de dominio puede inicializarse y permanecer esperando datos, conservando suscripciones y sin autorizar emisores inexistentes. Un productor no autorizado sigue siendo rechazado.
- Una sesión con navegación como único sistema de dominio puede conservar su receptor único de RequestNavigationStep sin instalar decisión ni un productor de fixture. Sin productores autorizados no se admiten solicitudes; sus eventos sin consumidores siguen siendo válidos.
- Dos productores alternativos conformes pueden sustituirse mediante el montaje sin editar el consumidor ni cambiar el contrato semántico.
- Comandos sin responsable no se anuncian como disponibles ni se ignoran silenciosamente.
- La evaluación por paquete sucede fuera del workspace completo, con solo dependencias declaradas. Un tsconfig reducido por sí solo no prueba independencia.
- Una regla de grafo detecta imports, reexports y dependencias de tipos a sistemas vecinos, rutas a fuentes privadas, ciclos y dependencias no declaradas. Sus controles negativos demuestran que no se limita a una whitelist superficial.
- La receta integrada conserva estados observables, traza lógica y comportamiento visual aprobados; los replays se conservan o rechazan conforme a la estrategia documentada.
- El cierre y la creación de instancias nuevas no comparten estado mutable ni recursos entre sesiones.

Estas verificaciones se proponen para implementación; ninguna fue ejecutada en esta investigación.

## Resolución de paquetes, compilación y límites del entorno

exports define las entradas públicas de un paquete, pero no reemplaza un control de dependencias: rutas directas a archivos pueden evitar esa frontera. [Node 24.14: paquetes](https://nodejs.org/download/release/v24.14.0/docs/api/packages.html).

TypeScript permite incorporar un archivo excluido mediante imports; include/exclude no constituyen una frontera de arquitectura. Las comprobaciones de paquetes deben controlar qué fuentes y dependencias se resuelven. [Referencia oficial de exclude](https://www.typescriptlang.org/tsconfig/#exclude).

Project References puede organizar compilaciones separadas y declaraciones públicas, pero su modo build genera artefactos y espera proyectos composite. No debe introducirse tsc -b como una comprobación inocua bajo la prohibición vigente de builds. [TypeScript: Project References](https://www.typescriptlang.org/docs/handbook/project-references).

El proyecto actual usa Node 24 con borrado nativo de tipos y tsc --noEmit para comprobarlos. Node no usa los alias paths de tsconfig ni comprueba tipos al ejecutar. Además, rechaza borrar tipos de archivos TypeScript bajo node_modules. Por eso un paquete que funciona como fuente local no prueba que su distribución de .ts vaya a ejecutarse como dependencia instalada. Para distribución convencional hay que preparar JavaScript y declaraciones, o decidir explícitamente otro runtime/herramienta. [Node 24.14: TypeScript](https://nodejs.org/download/release/v24.14.0/docs/api/typescript.html).

En desarrollo se puede mantener la comprobación sin emisión y la ejecución de fuentes locales, verificando la resolución de workspaces. La generación real de artefactos independientes queda pendiente de una excepción explícita a la prohibición de builds. Esta investigación no la solicita ni la ejecuta.

## Alternativas y recomendación

| Alternativa | Beneficio | Costo o limitación |
| --- | --- | --- |
| Carpeta común de tipos, dentro del paquete actual | Extracción inicial sencilla | No establece fronteras de instalación ni demuestra compilación aislada; puede ocultar dependencias transitivas. |
| Paquetes autónomos en el mismo repositorio | Un solo directorio de trabajo; APIs y dependencias comprobables; coordinación de cambios sencilla | Requiere manifests, configuraciones, pruebas por paquete y disciplina de versiones. Es la opción recomendada. |
| Repositorios separados y paquetes publicados | Ciclos de publicación separados y consumo desde otros productos | Más coordinación, distribución y gestión de compatibilidad. Puede adoptarse cuando exista esa necesidad. |
| Sistemas en procesos o servicios diferentes | Aislamiento de proceso y despliegue | Exige transporte, admisión/orden, fallos de red y consistencia; es un cambio de arquitectura distinto del objetivo solicitado. |

La recomendación es mantener el repositorio único y usar contratos neutrales por dominio, un puerto mínimo de sistema, dependencias puras pequeñas y un montaje que vincule participantes concretos. El criterio decisivo será que cada sistema pase la evaluación aislada sin tener disponibles implementaciones vecinas.
