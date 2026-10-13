# APP-001 — Ensamblado y ciclo de aplicación

Revisión: 1.0.0. Fecha: 13 de octubre de 2026. **Implementación aprobada por el responsable humano; commit, push, PR y merge autorizados.**

## Encargo y base

| Campo | Valor |
| --- | --- |
| Responsable humano | Usuario solicitante. |
| Sistema | Infraestructura de aplicación, APP-001. |
| Referencia | [Tarjeta 03](https://trello.com/c/5bvkqD4N), Revisión / pruebas. |
| Base | main, bf8b89b2dd9ff5b8815e3f4b50bc16b590ee48f1; [PR #3 integrado](https://github.com/jonathankozur/robots/pull/3). |
| Rama | codex/application-lifecycle-v1, creada antes de escribir documentación. |
| Checkout | C:/Users/Jonat/.codex/worktrees/application-lifecycle-v1/robots. |
| Autorización | «comenza la implementacion. Recorda mover la tarjeta a su posicion correspondiente» aprueba ejecutar esta revisión de plan y contrato. |
| Reserva | Implementación APP-001 entregada localmente; reserva finalizada. |
| Contratos base | Mensajería v1, API del núcleo 1.2, ENV-001 v1, CAT-001 v1, ReplayRecording v1. |

## Ocho decisiones confirmadas

El usuario confirmó los puntos 1 y 3–8; después de explicar las alternativas de sesión, confirmó el punto 2 mediante «ok».

1. Estados explícitos y transiciones permitidas.
2. Una sesión nueva por combate, con contexto de aplicación duradero y progreso conservado por sus propietarios entre encuentros.
3. Receta explícita con funciones que crean instancias nuevas, sin localizador global ni código escogido desde JSON.
4. Disponibilidad después de las confirmaciones de todos los participantes requeridos.
5. Validar y preparar el siguiente contexto antes de cerrar el anterior.
6. Rechazo normal para una petición inválida; fallo técnico detenido y visible, diagnóstico conservado y recuperación explícita con instancias nuevas.
7. Preparar recorrido de restauración sin implementar almacenamiento ahora.
8. Controlador externo de ejecución, independiente de temporizadores de los sistemas.

## Objetivo y primera entrega aprobada

Crear infraestructura reutilizable para construir, inicializar, avanzar, reemplazar y cerrar una simulación con fixtures independientes. No implementar combate real.

El contexto de aplicación posee ciclo de vida, intento de transición, identidad/generación de los encuentros y recursos del host. Una sesión posee exclusivamente la ejecución de un encuentro. APP-001 no posee integridad persistente, equipamiento, inventario, progreso ni resultados de victoria.

Cada nueva sesión recibe datos confirmados de sus propietarios cuando estos existan. Crear instancias nuevas no reinicia por regla de producto la identidad o daño de un robot: la transferencia explícita conserva esas magnitudes. Esta entrega solo demuestra ese recorrido con partes ficticias; no crea metajuego ni guardados.

## Alcance editable aprobado

- src/application/**: contratos propios, receta y configuración validada, ensamblador, controlador y puertos de infraestructura. Solo APIs públicas del núcleo y del catálogo; ninguna importación desde tests.
- tests/core/application-*.test.ts y tests/core/application-fixture.ts: fábricas de propietarios ficticios, mensajes y pruebas. npm test ya incluye esos nombres; no cambiar package.json/lockfile.
- tests/browser/application-panel.ts, tests/browser/lab.ts, tests/browser/lab.css y tests/browser/README.md: pestaña manual de ciclo de aplicación y guía. Conservar los paneles anteriores.
- docs/architecture/application-lifecycle-v1.md, esta ficha y APP-001 en docs/decisions.md.

Fuera: src/core/**, contratos históricos de fixtures, gameplay, victoria, hangar/expedición reales, inventario, persistencia, Three.js, Electron y nuevas dependencias. Si la API pública existente resulta insuficiente, presentar impacto y alcance revisado antes de editar el núcleo.

## Diseño aprobado

Contrato y tabla de transiciones: [APP-001 v1](../architecture/application-lifecycle-v1.md), aprobados para esta implementación. La entrega local y la integración GitHub son estados distintos; integración pendiente.

Separar receta, ensamblador y controlador. La receta declara factories/participantes, contratos, fases y orden estable. El ensamblador construye objetos nuevos y puertos mínimos. El controlador posee la transición y conduce Session; observa hechos mediante un adaptador de salida, sin consultar estado privado de participantes.

Estados: idle, preparing, initializing, ready, closing y faulted. El avance manual está separado del ciclo de vida. En initializing se puede avanzar el protocolo de arranque, pero no admitir intenciones de gameplay. ready habilita controles e ingreso autorizado. No existe avance autónomo en esta primera entrega.

Una receta inicial de laboratorio usa dos propietarios ficticios, navegación y combate, con datos mínimos tomados del paquete CAT-001. No importar createContentFixture a src/application ni modificar la fixture histórica para añadirle permisos.

La inicialización comienza con un único comando raíz. El coordinador emite comandos distintos para cada propietario, recibe sus confirmaciones y publica disponibilidad. Así las confirmaciones comparten raíz causal y se pueden reunir sin infringir la prohibición de combinar causas independientes. El evento de disponibilidad llega al input del tick siguiente antes de loops de participantes.

Preparar el siguiente encuentro incluye construir candidato y llamar a Session.start para validar catálogo, responsables y rutas usando la API pública. Esto no ejecuta callbacks ni ticks. El candidato permanece aislado, sin driver ni entradas vivas; el anterior se conserva sin mutaciones. Puede haber dos Session en estado active del núcleo durante este preflight, pero solo un contexto publicado y ningún avance del candidato.

Si el preflight falla, cerrar/liberar el candidato y conservar el anterior. Si pasa, cerrar y liberar el anterior; recién después conducir inicialización del nuevo. Si esta inicialización falla, informar fallo: no reabrir una Session cerrada ni fingir rollback. Es el coste explícito de conservar el núcleo sin añadir un API de preflight.

Reemplazo normal solo entre ticks. Si hay un tick parcial, rechazar la petición con explicación: completar el tick mediante control explícito o cerrar con descarte explícito. La transición no avanza automáticamente una simulación pausada.

Una transición pendiente por controlador. requestId identifica repeticiones dentro de un registro acotado; repetir misma solicitud conserva el resultado, contenido diferente con el mismo ID se rechaza, y una petición competidora se rechaza como ocupada. No usar una cola ilimitada ni ejecutar automáticamente solicitudes viejas.

Identidad nueva por encuentro y generación del host. Resultados externos incluyen identidad e intento: el puente filtra lo ajeno/antiguo antes de stageExternalInput. Los eventos de salida se traducen a datos inmutables para el laboratorio. El host no obtiene las implementaciones ni estado mutable de los sistemas.

Cerrar cancela el driver, invalida ingreso, cierra Session fuera de callbacks y ejecuta limpieza idempotente de recursos de infraestructura. Intentar todas las limpiezas aunque una falle; conservar sus errores. No activar otro contexto si quedan recursos exclusivos sin liberar. Retener diagnóstico/traza final como datos, no como una sesión operativa.

## Secuencia de implementación aprobada

1. Escribir pruebas RED de receta/montaje y contrato: rechazo antes de avance para contenido/esquemas/versiones/rutas inválidos; fábricas nuevas, orden estable y dependencias públicas.
2. Implementar configuración/receta y montaje mínimo hasta GREEN; fijar contenido, semilla, montaje, límites, datos iniciales e identidad en el manifiesto existente.
3. TDD de inicialización: comando raíz, vistas mínimas por propietario, confirmaciones, barrera, duplicados exactos/conflictivos, rechazo, falta de respuesta y presupuesto lógico.
4. TDD del controlador: tabla de estados, ingreso permitido, bootstrap separado de operaciones, paso/fase/tick, ausencia de avance autónomo y snapshots de infraestructura.
5. TDD de reemplazo: preflight preserva sesión vieja, solicitud repetida/competidora, límite entre ticks, cierre anterior y fallo posterior sin rollback.
6. TDD de cierre/fallo y restauración ficticia: limpieza idempotente, limpieza incompleta visible, respuestas tardías, recuperación con instancias nuevas y datos incompatibles rechazados.
7. TDD de reconstrucción/replay: receta y datos fijados, mismo runtime, traza completa y propietarios nuevos; sin ingreso vivo ni efectos externos repetidos. Separar replay del encuentro de registro de transiciones de la aplicación.
8. Panel de laboratorio: iniciar/preparar/reemplazar/cerrar, avance parcial, pendientes/confirmaciones, fallos, traza, identidades y evidencia de aislamiento. Datos/restauración son fixtures, no progreso real.
9. Verificación: npm test, npm run typecheck (tsc --noEmit), git diff --check, revisión del diff contra main actual y recorridos manuales del panel. No builds.

## Criterios y evidencia prevista

| Criterio | Evidencia |
| --- | --- |
| Todos los participantes reciben solo su vista por mensajes y confirman antes de disponibilidad | Pruebas de contenido, entrega y barrera. |
| Bootstrap faltante/rechazado/conflictivo no habilita operaciones | Pruebas de fallo normal/técnico y horizonte lógico. |
| Montajes y RNG vivos no se comparten entre encuentros | Dos instancias y mutación de datos fuente, con salidas independientes. |
| Preflight fallido preserva el contexto actual y no avanza el candidato | Pruebas de factories/rutas/contenido y cursor retenido. |
| Repetición o competencia no crea una segunda transición | Pruebas de requestId/ocupación. |
| Pausa real no se rompe al reemplazar | Rechazo en tick parcial; acción explícita para completar/descartar. |
| Cierre y limpieza invalidan ingreso/recursos; fallos de limpieza son visibles | Recursos de prueba, doble cierre y respuesta tardía. |
| Restauración válida inicializa datos ficticios exactos y no aplica defaults | Partes con dueño/versiones/revisión y rechazo de faltantes. |
| Mismo encuentro reconstruido reproduce evidencia con manifiesto exacto | Replay de sesión y pruebas de cambio de contenido/semilla/montaje/runtime. |
| Laboratorio muestra ciclo completo y aislamiento | Recorrido manual de dos encuentros, fallo y cierre. |

## Decisiones posteriores fuera de alcance

Se decidirán con sus tarjetas: formatos de partes persistentes reales, coordinación de checkpoint, autoridad de resultados de batalla y transiciones completas hangar/expedición. El driver visual continuo/FPS y recursos 3D pertenecen a sus integraciones posteriores; la primera entrega usa avance manual.


## Entrega APP-001 y evidencia ejecutada

Estado: **implementado localmente para revisión humana**, rama codex/application-lifecycle-v1 desde bf8b89b. Desarrollo y plan/contrato 1.0 autorizados mediante «comenza la implementacion. Recorda mover la tarjeta a su posicion correspondiente». Reserva de implementación finalizada.

Archivos: src/application/{contracts,data,assembly,controller,index}.ts; tests/core/application-{lifecycle,replay,architecture}.test.ts y application-fixture.ts; tests/browser/application-panel.ts, lab.ts, lab.css y README.md; documentación APP-001 y decisiones. No se modificaron src/core/**, pruebas/contratos anteriores, package.json, lockfile ni tsconfig.

Se implementaron receta explícita, montaje nuevo por encuentro, bootstrap con una raíz causal, confirmaciones/vistas mínimas, estado disponible después de la barrera input, controlador manual, preflight y reemplazo entre ticks, deduplicación acotada, limpieza idempotente/reintentable, guard de entradas ajenas y restauración ficticia versionada. El puerto público expone datos/control, no Session ni implementaciones de los propietarios.

Detalle comprobado del núcleo: un sistema declarado kind=adapter no puede consumir mensajes. app-output se registra como sistema observador de infraestructura con una vista propia, copiada/congelada hacia el host. El adaptador de I/O queda fuera de callbacks. No se cambió ese contrato para permitir receptores privilegiados.

### TDD y pruebas

- Las siete pruebas iniciales fallaron por conductas ausentes contra el controlador provisional; luego pasaron con montaje, barrera, ciclo y limpieza.
- Dos pruebas adicionales fallaron por ingreso vivo en replay y revisión de receta insuficiente; se agregaron guard de replay, horizonte y validación de datos/manifiesto.
- Fallaron antes de corregirse: selección real de piezas/robot armado para la demo, validación del ingreso externo antes de admitirlo, raíz causal de confirmación y rechazo Promise de limpieza inválida.
- Restauración completa/versionada, aislamiento, recurso adquirido antes de excepción, contrato de suscripciones, límites y ausencia de imports/reloj/I-O indebidos quedaron verdes.
- npm test: **151/151 aprobadas** (22 nuevas y 129 previas); Node 24.14.0.
- npm run typecheck: aprobado, TypeScript 5.9.3, tsc --noEmit. git diff --check y revisión de espacios/enlaces dentro del alcance aprobados.

### Verificación en navegador

Laboratorio servido desde este checkout en http://127.0.0.1:5173/. Verificado con navegador integrado, Chromium/Chrome 155 (UA declarado por la página), sin extrapolar a Electron ni otros navegadores.

Se operaron controles reales: inicio y repetición, dos ticks de barrera, operación diferida, Paso + reemplazo rechazado en tick parcial, preflight inválido preservando contexto, reemplazo con ID nuevo, ingreso tardío rechazado, limpieza fallida y reintento explícito. Se ejecutaron escenarios missing/reject/duplicate/conflict/crash; sus estados/diagnósticos y recursos pendientes coincidieron con el contrato.

Restauración ficticia mostró integridad 70000 y contador 7. Replay de ejecución normal y restaurada coincidió en traza y vistas. Console del navegador sin errores/warnings en las comprobaciones. Debug se escribió en JSONL físicos, con secuencias contiguas y mensajes publicados, sin pendientes tras escritura confirmada. El panel se comprobó visualmente a 600 px de ancho (ancho real del panel integrado).

### Límites y pendientes

No gameplay, fórmulas de combate, captura de checkpoint, almacenamiento, Three.js, benchmarks, CI ni Electron. La fixture no usa RNG vivo; la semilla/perfil se fijan y comparan en el manifiesto. El guard de imports es evidencia estática, no sandbox de código hostil/Proxy. Detectar Promise en una limpieza no revierte efectos que ya haya iniciado código externo; se informa fallo, consume rechazo y exige recuperación explícita.

Session de candidato puede estar active antes de publicar contexto para verificar configuración, sin callbacks/ticks del candidato. Los intentos fallidos pueden consumir una generación, pero no reutilizan identidad. La aceptación de request confirma recepción del pedido, no disponibilidad: esta se confirma por mensajes y estado ready.

El responsable humano autorizó integrar la entrega mediante «hace commit, push, crea el PR y mergea». Revisión de integración contra origin/main bf8b89b: base vigente sin cambios adicionales, alcance y contratos compatibles, sin conflictos. GitHub exige PR e historial lineal; no exige segundo aprobador ni checks automáticos (no configurados). El enlace y commit final de integración quedarán registrados en el PR y Trello. No se ejecutó ningún build. Engram no está disponible; evidencia conservada en fuentes compartidas.