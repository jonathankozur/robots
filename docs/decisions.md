# Decisiones y habilitación

Revisión documental: **1.2.0**. Actualización: **11 de octubre de 2026**. Conserva la base documental del 9 de octubre.

## Base aprobada

La autorización humana de implementar el plan «Protocolo de agentes y arquitectura de mensajería v1» aprueba la creación de esta base documental. No se interpreta como aprobación de mecánicas tentativas del GDD, del bus ejecutable ni de tareas de implementación del juego.

| Decisión | Consecuencia |
| --- | --- |
| Sistemas especializados pequeños dentro del mismo proceso | Estado propio y fronteras por mensajes; sin transporte distribuido inicial. |
| Simulación determinista por ticks con fases | Reloj lógico y entrega diferida; presentación desacoplada del ritmo de simulación. |
| Datos recibidos mediante mensajes | Vistas locales limitadas, actualizadas por contratos explícitos; sin consultas directas a otro sistema. |
| Persistencia en puntos seguros entre encuentros | Snapshots coherentes y confirmados; no se reanuda una batalla a mitad. |
| GitHub público | Repositorio público `jonathankozur/robots`, con `main` protegido por PR y una aprobación humana. Ver el estado y los límites en [colaboración](workflow/collaboration.md#estado-del-repositorio). |
| Plan breve aprobado antes de implementar | Aprobación específica del alcance, sin renovarla para acciones ya autorizadas. |
| Revisión humana en cada PR | Otro desarrollador aprueba; las revisiones de agentes son complementarias. |
| Primera entrega: documentación y skills | Sin scripts de control, motor, bus, pruebas de juego ni tareas nuevas. |

El GDD original permanece en [diseno_autobattler_robots.md](../diseno_autobattler_robots.md). Sus propuestas de cantidades, IA, componentes y progresión conservan sus estados originales.

## Requisitos pendientes

| Requisito | Evidencia necesaria para habilitarlo |
| --- | --- |
| Integración de presentación y escritorio | Tecnología aprobada en TEC-001; Vite verifica el arnés local en BUS-002. Three.js, presentación del juego y Electron siguen pendientes. |
| Aritmética, precisión, frecuencia de ticks y algoritmo aleatorio | Especificación aprobada del entorno determinista soportado y de sus pruebas. |
| Integración del bus y scheduler v1 | Implementado y probado en BUS-001/BUS-002; revisión cruzada humana e integración pendientes. |
| Controles ejecutables de gameplay | Controles locales del núcleo implementados; ampliar a productores/consumidores reales cuando existan. |
| Git y repositorio compartido | Repositorio real, rama base, colaboradores identificados y checkouts separados. |
| Checks obligatorios de GitHub | Workflows y verificaciones ejecutables que se puedan exigir a cada PR, más evidencia de su bloqueo ante fallos. |
| Base de datos | Elección humana y definición de snapshots, almacenamiento, migraciones y operaciones permitidas. |
| Multiplayer | Autoridad, sincronización, autenticación y protocolo externo. La base solo fija el límite del adaptador. |

El primer desarrollo de infraestructura, una vez elegida la tecnología, debe hacer ejecutables los contratos y escenarios del bus. Los sistemas de gameplay se habilitan después de aprobar y verificar esa infraestructura. Esto evita exigir pruebas del bus antes de permitir construir el propio bus.

La prohibición de builds permanece vigente. Si el motor exige compilar para una prueba, esa verificación queda pendiente hasta que el humano autorice explícitamente una excepción; no se la declara exitosa ni se sortea mediante otro comando.

## Registro de decisiones posteriores

Cada decisión posterior debe conservar: identificador, fecha, estado (propuesta/aprobada/sustituida), aprobación humana, contexto, alternativas y consecuencias, sistemas y contratos afectados, y referencia a la decisión que sustituye si corresponde. Una propuesta o un recuerdo del agente no es una aprobación.

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

Fecha: 11 de octubre de 2026. Estado: **desarrollo autorizado; entregado para revisión humana**. El usuario aprobó el plan basado en la [tarjeta de revisión 0.2](https://trello.com/c/oWqxinQ9), con pruebas Node y tsc --noEmit. La aprobación habilita este núcleo y sus fixtures; no habilita combate, PR, push ni merge.

Alcance y evidencia están en la [ficha de entrega](workflow/bus-scheduler-implementation.md). La [API](architecture/core-api-v1.md) concreta la sintaxis y presupuestos de evaluación manteniendo las fases y reglas de mensajería v1. No hay productores o consumidores de gameplay que migrar. La extracción event-bus conserva su API y archivos originales en el checkout inicial, y no es una dependencia del núcleo.

### BUS-002 — Pausa real, journal debug y laboratorio manual

Fecha: 11 de octubre de 2026. Estado: **desarrollo autorizado; entregado para revisión humana**. Responsable humano: usuario solicitante. Aprobación explícita: «sí voy a necesitar pausa real… implementa la mejora del bus y scheduler… modo debug… archivo log… luego implementa los 10 puntos del arnés». Amplía BUS-001; no autoriza integración, PR, push ni merge.

Se elige un cursor único de ejecución: step ejecuta una unidad completa, stepPhase termina una fase y advanceTick termina el tick actual. Pausar conserva bandeja congelada, cursor y estado propio. El controlador deja de avanzar; no existe reloj autónomo en el núcleo. Suspender instrucciones dentro de callbacks exigiría transformar cada sistema y su contrato de ejecución; no se adopta esa alternativa.

Se elige un journal debug opcional independiente de la traza acotada. El núcleo produce datos inmutables; un adaptador local fuera de la simulación escribe JSONL secuencial. Frente a descarga únicamente en navegador, esta opción deja un archivo físico y admite reintentos, a cambio de requerir servidor local y conservar datos pendientes en memoria. El modo debug no modifica el resultado ni la traza lógica. Cerrar el navegador no garantiza persistir registros pendientes.

El laboratorio configura escenarios con datos y reglas de estado propio, sin código importado. Incluye controles parciales, entradas manuales/programadas, fases/colas/causas, fallos controlados, replay, sesiones independientes y evidencia exportable. Los casos de infracción usan fixtures explícitos; no son permisos nuevos de los sistemas.

Contratos afectados: API Session, inspección, marcadores de fase, journal y maxTicks del manifiesto. Productores/consumidores actuales: fixtures y arnés; sin gameplay que migrar. Grabaciones de manifiesto anterior se rechazan explícitamente. Las fases y el orden de entregas siguen vigentes.

Evidencia, alcance y límites: [entrega BUS-002](workflow/debug-harness-plan.md), [guía manual](../tests/browser/README.md) y [API](architecture/core-api-v1.md). Node y Chrome fueron verificados; no se extrapola a Electron ni a determinismo entre plataformas. La revisión humana y la comparación con la base actual siguen pendientes antes de integrar.

## Estado de esta instalación

Al comenzar esta entrega, la carpeta contenía únicamente el GDD y no era un repositorio Git. Se creó `jonathankozur/robots` como repositorio público, se subió la documentación inicial a `main` y se configuraron protecciones de rama. La configuración actual y los controles aún pendientes están detallados en [colaboración](workflow/collaboration.md#estado-del-repositorio).
