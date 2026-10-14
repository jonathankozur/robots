# IND-001 — Plan aprobado de independencia de sistemas

## Encargo, aprobación y base
Responsable humano: Jonathan Kozur. Ejecutor: Codex. Autorización explícita: «implementa migración en este orden», seguida de los cinco pasos; crear esta tarjeta, ponerla en desarrollo y crear branch.
Rama: codex/independent-systems. Directorio de trabajo: C:/dev/robots, conforme a la preferencia expresa del usuario. Base main: e05aac9330ef0579aeacb2ffc886a2622eb058e8 (PR #6); remoto comprobado antes de comenzar.
Investigación compartida: docs/architecture/system-independence-proposal.md.
Reserva: paquetes, fuentes de infraestructura/sistemas actualmente implementados, consumidores, configuración, verificaciones y documentación enumerados abajo. Tablero revisado: no hay otra tarjeta en desarrollo o revisión con ese alcance.

## Objetivo
Cada sistema puede resolver sus tipos y ejecutarse con su código y dependencias declaradas, sin fuentes o implementaciones de sistemas vecinos. Los consumidores pueden permanecer esperando si no hay productores. Se conserva comunicación por mensajes, estado propio, fases/ticks, causalidad, datos inmutables, límites, fallo global de sesión y replay.

## Plan completo, en el orden aprobado

### 1. Extraer contratos, puertos y helpers, conservando mensajes
- Registrar evidencia de referencia de las recetas APP, NAV y PRE antes de migrar: resultados, traza/manifest y replay con IDs/runtime/semilla fijos.
- Extraer system-api: envolturas y DSL de esquemas, Publisher send/emit, contexto/definición de sistema y Actor neutral; conservar una única clase ProtocolError.
- Crear protocol con entradas por dominio/version: navigation/v1 (World, Result, Step y esquemas), presentation/v1 (View/ensamblado), application/v1 (identidad/arranque), content/v2 (datos/constantes).
- Separar MessageDefinition (nombre/version/clase/esquema) de bindings de sesión (productores/owner concretos).
- Extraer values para datos JSON/copias congeladas, aritmética/RNG puros y hex-grid. Preservar restricciones distintas de cada perfil de copia, códigos, presupuestos y orden canónico.
- Los contratos no importan actores, helpers privados de sistemas ni la implementación del runtime. Estado privado continúa dentro de cada sistema.
- Mantener entradas antiguas de src como puentes públicos de compatibilidad hacia las implementaciones canónicas; los paquetes no importan esos puentes ni duplican implementaciones.

### 2. Crear paquetes autónomos y actualizar imports
- Paquetes previstos: system-api, protocol, values, runtime, navigation, presentation, presentation-three, content y application-host; host/laboratorio conserva las recetas y adapters externos.
- Manifest propio, nombre @robots/*, dependencias explícitas, exports y tsconfig de comprobación sin emisión por paquete. npm workspaces y un lockfile raíz.
- Los sistemas dependen solo de system-api, protocolos públicos y bibliotecas puras; navigation/presentation no dependen del otro sistema ni del host.
- Datos de presentación independientes de Three/DOM; paquete gráfico con sus propias dependencias.
- Actualizar fuentes, fixtures, tests, browser lab y servidor a entradas públicas. Reforzar guardas con resolución de grafo/exports y controles negativos, sin relajar las prohibiciones actuales.
- npm install/ci solo con --ignore-scripts; no builds ni publicación. Fuentes .ts locales funcionan mediante enlaces reales del workspace; paquetes compilados publicables quedan fuera de esta entrega.

### 3. Llevar autorización y montaje al host
- Extraer navigation-agent-fixture de definiciones productivas; el host declara explícitamente bindings y mantiene los mismos IDs/fases de las recetas actuales.
- Host crea sistemas, registro de handlers/loops y contratos de sesión; conserva barrera de inicialización y activación por mensajes.
- Actores usan Actor/system-api y protocolo APP neutral, sin importar ApplicationController/ContentBundle/Session.
- Mantener loader de contenido como biblioteca pura de preparación; no introducir llamadas entre actores ni consultas de estado privado.
- Probar composición con un productor alternativo autorizado sin editar navigation/presentation.

### 4. Permitir consumidores sin productores y demostrar ejecución aislada
- TDD: mostrar RED real del catálogo actual ante evento con consumidor y cero productores, y ante comando con responsable único y cero productores.
- Aceptar contratos conocidos con producers=[]; nadie queda autorizado a emitirlos. Mantener verificación de productores registrados, fases, tipo/version/payload, owner único y catálogo fijo durante actividad.
- Presentación sola como sistema de dominio se inicializa y espera sin navegación. Navegación sola conserva su receptor de órdenes y publica eventos sin consumidores; no requiere decisión/fixture.
- En un host mínimo alimentar presentación con mensajes sintéticos conformes; validar su proyección, revisiones, duplicados y fallos esperados.
- Evaluar paquetes en directorios temporales aislados, copiando solo el paquete y las dependencias declaradas, sin el checkout/paquetes vecinos. Ejecutar fuentes y comprobación de tipos sin emisión por separado.
- Verificar alias/inmutabilidad, cierre e instancias independientes y errores ProtocolError compartidos.

### 5. Comprobar integración y equivalencia
- Comparar resultados y trazas de APP/NAV/PRE con las referencias previas, incluyendo causalidad, mensajes/revisiones, orden de fases y replays.
- Ejecutar suites existentes y nuevas, verificación de arquitectura, comprobación de tipos por paquete y raíz sin emisión, git diff --check.
- Recetas existentes conservan configuración serializada/versiones: una extracción de archivos no obliga a romper sus grabaciones. Las nuevas composiciones tienen su propio manifest.
- Comprobar servidor Vite y recorrido pertinente de laboratorio si el entorno lo permite, sin invocar builds.
- Documentar cambios, resultados RED/GREEN, criterios, límites y recuperación. Actualizar esta tarjeta con entrega, conservando revisión humana pendiente.

## Alcance editable
Nuevos packages/**; src/core/**, src/application/**, src/content/**, src/navigation/**, src/presentation/**, src/shared/** como puentes/migración; tests/core/**, tests/harness/**, tests/browser/**; scripts/harness-server.ts y nuevos scripts pertinentes de verificación; package.json/package-lock.json/tsconfig; docs de contratos, sistemas, decisiones, API, plan y entrega, README y guía del laboratorio.
Sin cambios a assets/modelos, balance, fórmulas ni gameplay pendiente. Archivos locales ajenos event-bus/, .playwright-mcp/ y pre-001-initial.png se preservan.

## Contratos e impacto
NAV v1, PRE v1, APP v1, CAT v2 y mensajes BUS actuales conservan nombre, payload, unidades, fases y causalidad. Runtime amplía preparación para productores vacíos; autorización de emisión permanece estricta, y comandos conservan responsable único.
Afectados: actores navigation/presentation, host APP/coordinator/output, agent/observer de fixtures NAV, fixtures CAT/APP, renderer/paneles y pruebas de bus/replay. No consumidores productivos adicionales declarados en desarrollo.
No dinámico hot-plug, aislación de fallos, cambio de tick/aritmética/RNG ni rollback.
No push/PR/merge en esta autorización; la entrega queda local para revisión.

## Aceptación y evidencia requerida
- Protocol/system-api no importan implementaciones de sistemas/runtime.
- Cada paquete cumple dependencias declaradas y no necesita fuentes de vecinos para comprobar tipos o ejecutar su conducta.
- Navegación y presentación funcionan aisladamente, sin proveedores habituales, y con fuentes de mensajes alternativas conformes.
- Contratos vacíos no permiten emisores desconocidos; comando sin owner/receptores múltiples sigue rechazado.
- Recetas y pruebas existentes conservan resultados, traza, causalidad y replay.
- Datos/copias y cierres no comparten estado mutable ni capacidades indebidas.
- Guardas detectan imports directos/transitivos indebidos con controles negativos.
- No builds de software ni artefactos JS/.d.ts emitidos. Distribución npm compilada pendiente de una excepción explícita.
- Documentar verificaciones no ejecutadas sin declararlas aprobadas.

## Verificaciones autorizadas para esta migración
Node 24.14.0 con runner nativo de pruebas .ts; npm test; comprobación tsc --noEmit (sin build/artefactos); verificaciones de grafo y ejecución aislada; git diff --check; Vite dev y navegador pertinente. Instalación de dependencias con --ignore-scripts.
TDD obligatorio para conducta nueva. Engram no disponible: memoria compartida en docs y esta tarjeta.


## Seguimiento local

Tarjeta: https://trello.com/c/Hw4FTSfv. Estado inicial: En desarrollo.

- [x] 1. Contratos, puertos y helpers comunes.
- [x] 2. Paquetes autónomos e imports.
- [x] 3. Bindings y montaje del host.
- [x] 4. Productores ausentes y ejecución aislada.
- [x] 5. Equivalencia, integración automatizada y comprobación del navegador.

La ejecución autorizada se registra en este documento. No hay autorización para push, PR ni integración.

## Evidencia de ejecución recuperable

14 de octubre de 2026, Node 24.14.0 / TypeScript 5.9.3. Engram no está disponible; este registro compartido conserva el avance.

- Base previa a la extracción: 198/198 pruebas originales aprobadas. Referencia fija capturada desde main e05aac9 en tests/core/migration-baseline-v1.json antes de mover las implementaciones.
- Implementados nueve paquetes con manifests, exports, dependencias y configuración propia; puentes src sin duplicar implementaciones. Actores NAV/PRE dependen exclusivamente de API/protocolo/valores comunes. Three.js pertenece al adaptador gráfico.
- Host monta participantes y permisos. Mensajes neutrales conservan nombres/versiones/payloads; fixtures declaran permisos explícitos. Control de grafo y guardas anteriores aplicados a las fuentes canónicas, con controles negativos.
- TDD de productores vacíos: 3 fallos RED reales del catálogo anterior, con 1 control válido; 4/4 GREEN tras ampliar la preparación. La admisión no autoriza emisores con una lista vacía y conserva owner/rutas/registro.
- TDD del nuevo control de grafo: 5 fallos RED de controles negativos ante una implementación vacía; 7/7 GREEN tras implementar el análisis.
- Pruebas propias: NAV 2/2, PRE 3/3, runtime de productores ausentes 4/4. Composición del host 4/4: PRE sola, NAV sola, productor alternativo y snapshots de permisos.
- Paquetes aislados: 9/9 directorios temporales con solo dependencias declaradas, comprobación de tipos sin emisión, carga de exports y pruebas propias. NAV/PRE comprueban ausencia real del vecino.
- Configuración autónoma: se retiró del ensayo la copia de tsconfig.base.json y NAV falló por TS5083 (RED). Se conservaron las mismas opciones dentro de cada tsconfig propio, eliminando extends hacia la raíz. NAV pasó sin ese archivo (GREEN); los nueve paquetes pasaron después en la regresión completa final, sin copiar configuración de la raíz.
- Equivalencia: 17/17 casos APP/NAV/PRE, 26 ticks cada uno, comparación contra la referencia previa de traza/observación completas y reejecución/replay con instancias nuevas. IDs, manifest, fases, causalidad y resultados conservados.
- Regresión conjunta final: **244/244 pruebas aprobadas**, cero omitidas, cero fallos; npm test (~23.1 s). npm run typecheck y npm run typecheck:packages aprobados, este último para los nueve paquetes; ambos sin emisión.
- No builds, archivos JS/.d.ts emitidos, push, PR ni merge. Distribución compilada/publicable y revisión humana pendientes. Archivos locales ajenos preservados.

### Comprobación real del navegador

El servidor existente en 5173 pertenecía al checkout anterior de PRE-001: se detectó por la ruta del debug y su ejecución se excluyó de la evidencia de migración. El intento inicial de servidor adicional rechazó el puerto ocupado. El navegador MCP estaba ocupado y CUA no pudo inicializarse; se abrió una sesión Playwright CLI independiente sin cerrar el navegador existente.

Se levantó Vite dev temporal en **http://127.0.0.1:5174/**, con root C:/dev/robots/tests/browser, publicDir C:/dev/robots/public y middleware de logs del checkout actual. La red confirmó HTTP200 para módulos en C:/dev/robots/packages de los nueve paquetes y los nueve GLB. Recorrido PRE-001: preparar (ready, tick2), ejecutar20 ticks (tick22), comparar replay (**traza y vistas coinciden**), segunda sesión/escena (**original intacto**), cerrar ambas (**0 canvas restantes**). Cero errores y cero advertencias en consola; diagnóstico visual vacío. Log físico: debug-logs/session-8badad80-512a-4317-b8bb-2d0e75fbbbfc.jsonl. Captura local: output/playwright/ind-001-scene.png. Ambos son artefactos locales ignorados por Git. Se cerraron el navegador CLI y el servidor temporal al terminar; el servidor anterior permanece intacto.

## Reporte de entrega

Estado: **implementado localmente, entregado para revisión humana**. Tarjeta IND-001 permanece en En desarrollo según el encargo; sus cinco pasos se completaron. Rama codex/independent-systems en C:/dev/robots. Plan y base identificados al comienzo de esta ficha; ninguna integración remota forma parte de esta entrega.

### Archivos y contratos

- packages/system-api, values y protocol: puertos, tipos/esquemas/versiones y bibliotecas puras comunes. World/Result ya no requieren navegación instalada.
- packages/runtime, navigation, presentation, presentation-three, content y application-host: implementaciones canónicas y límites de dependencia. Bindings y montaje pertenecen al host.
- src/**: reexports de compatibilidad. Su preset histórico navigationContracts conserva permisos antiguos exclusivamente como puente del laboratorio.
- Configuración npm/workspaces/lockfile/tsconfig, scripts de comprobación, consumidores tests/browser/core/harness y tests/packages: entradas públicas, aislamiento real y controles de arquitectura.
- README, API, mensajería, mapa de sistemas, decisiones e investigación/arquitectura IND-001: instrucciones para localizar y modificar el código y límites comprobados.

NAV1/PRE1/APP1/CAT2 y mensajes actuales conservan nombre, versión, payload, unidad, fase y causalidad. Los contratos existentes mantienen su configuración serializada; ampliación autorizada de runtime: producers=[] durante preparación. Un comando exige su owner único; una lista vacía no concede permisos. Fail-fast de sesión, scheduler y replay se conservan.

### Verificaciones y límites

| Comprobación ejecutada | Resultado |
| --- | --- |
| npm test, suite final | 244/244, sin fallos ni omitidas; incluye 17 casos de referencia, 9 de aislamiento y controles negativos |
| npm run typecheck | Aprobada, sin emisión |
| npm run typecheck:packages | 9/9, sin emisión |
| Laboratorio Vite dev/Playwright CLI desde este checkout | Escena,20 ticks,replay,segunda sesión,cierre y consola aprobados |
| git diff --check | Aprobado; advertencias de conversión LF/CRLF propias de la configuración existente de Git |
| Revisión de whitespace en archivos nuevos | 78 archivos examinados, cero incidencias |
| Enlaces documentales locales | Ocho documentos revisados, cero destinos ausentes |

No ejecutados: builds, empaquetado compilado/publicable, instalación desde un registro npm, pruebas gráficas exhaustivas de rendimiento en todos los equipos, CI remota y revisión humana. Motivo: builds prohibidos, publicación/CI fuera del alcance y el recorrido gráfico fue una regresión pertinente de módulos/escena, sin cambiar assets ni renderer. La carga de exports del adaptador en Node no se presenta como render WebGL aislado: este se comprobó en el navegador.

### Recuperación y próximos pasos

Los cambios permanecen locales y sin commit, push, PR o merge. Preservados event-bus/, .playwright-mcp/ y pre-001-initial.png. Para continuar: revisar esta rama y la arquitectura IND-001; integración GitHub requiere autorización explícita. No descartar indiscriminadamente archivos locales para revertir: comparar con la base e05aac9 y conservar las fuentes/evidencias propias de este encargo antes de retirar cambios.

Limitaciones vigentes: dependencia semántica de los protocolos comunes, IDs estables de actores actuales y fallo global de sesión. No se implementaron hot-plug, reinicio de actores, procesos separados, rollback ni aislar fallos. Compilación de distribución requiere excepción explícita a la regla de no builds. Engram no está disponible; plan, decisiones, resultados y continuidad están conservados en archivos compartidos y la tarjeta.
