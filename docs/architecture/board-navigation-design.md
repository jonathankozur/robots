# NAV-001 — Decisiones de tablero y navegación

Revisión documental: **1.2.0**. Fecha: **13 de octubre de 2026**. Estado: **decisiones de producto y estrategia de migración aprobadas; contrato y plan 1.0 aprobados e implementados**.

## Encargo y autorización

| Campo | Valor |
| --- | --- |
| Responsable humano | Usuario solicitante. |
| Sistema | Tablero y navegación, NAV-001. |
| Referencia | [Tarjeta 04 — Tablero y navegación](https://trello.com/c/koJ7Lhkb), Revisión / pruebas al entregar. |
| Base | main, 53f1d175b825ecd3ec7e7ea14cfc7d1cec905665, [PR #4 integrado](https://github.com/jonathankozur/robots/pull/4). |
| Rama | codex/board-navigation-v1, creada antes de escribir estos documentos. |
| Checkout | C:/Users/Jonat/.codex/worktrees/board-navigation-v1/robots. |
| Alcance de esta intervención | NAV-001, migración coordinada CAT-002 y laboratorio según plan/contrato 1.0 aprobados. |
| Aprobación | Respuestas numeradas del usuario, explicación posterior del movimiento como habilidad con CD y «oka, documenta todas las decisiones. Queda algo pendiente?». |
| Reserva | Implementación aprobada en checkout propio; finalizada al entregar para revisión humana. |
| Bases aplicables | ENV-001 v1, CAT-002 v2, APP-001 v1, mensajería v1 y API del núcleo 1.2. |

El usuario aprobó las recomendaciones 1, 3 y 9, precisó el tamaño en 2, aclaró el bloqueo en 6 y el combate automático en 8. Su modelo posterior de movimiento como habilidad con CD, y la solicitud de documentar tras su explicación, sustituyen las propuestas previas para 4 y 5. La revisión del recorrido antes de cada paso fue solicitada en 7.

La solicitud posterior «Arma el plan de implementacion. Recordá crear un branch» autorizó preparar el [plan 1.0](../workflow/board-navigation-v1.md), [contrato NAV v1](board-navigation-v1.md) y [migración CAT-002](content-catalog-v2.md), preparados para revisión. El usuario autorizó luego ejecutar el alcance mediante «aprobado. implementalo»; integración GitHub pendiente.

Las dos decisiones finales se confirmaron posteriormente mediante «1. ok / 2. ok». No quedan decisiones de producto abiertas para esta primera entrega; contrato técnico y plan 1.0 quedaron aprobados e implementados.

## Decisiones vigentes

| Punto | Decisión y consecuencia |
| --- | --- |
| 1. Geometría | Coordenadas axiales de dos enteros; vecinos y distancia mediante utilidades puras. Orientación visual inicial: punta arriba. La presentación no decide ocupación ni rutas. |
| 2. Tablero | Tablero pequeño, finito y completo en una pantalla. Tamaño configurable antes de iniciar y fijo durante el encuentro. Dimensiones, forma y límites de las fixtures se concretaron en el plan (7x7 inicial, máximo 12x12/16 entidades), sin fijar balance final. |
| 3. Tiempo y terreno | Usar los 20 ticks/s de ENV-001. Primera entrega: terreno transitable o bloqueado y parámetros de locomoción. La velocidad final podrá depender de locomoción, terreno u otros modificadores aprobados posteriormente. Energía sigue siendo presupuesto de equipamiento, sin consumo por paso. |
| 4. Movimiento como habilidad | Cada paso es una acción discreta aprobada de inmediato por Navegación; después entra en CD durante X ticks. La primera acción puede ejecutarse cuando la habilidad esté disponible. Un CD menor implica más pasos por segundo. No hay tránsito lógico ni reserva de casilla durante el CD. |
| 5. Conflictos | Navegación evalúa las solicitudes de un paso en el orden lógico de entrega del bus. La primera válida que encuentre destino libre mueve y ocupa; las siguientes que encuentren ese destino ocupado se rechazan. No priorizar por antigüedad de espera, sorteo ni velocidad. |
| 6. Ocupación | Cada robot ocupa un hexágono. Una casilla ocupada por otra unidad terrestre está bloqueada, sea aliada o enemiga. No intercambios atómicos de posiciones ni rotaciones coordinadas en esta entrega. Un movimiento previo puede liberar una casilla y permitir un paso posterior, según orden secuencial. |
| 7. Recorrido | Calcular un camino válido con la información disponible y reconsiderarlo antes de cada próximo paso, usando la ocupación actual conocida. Ejecutar únicamente ese paso, sin reservar todo el recorrido. Navegación revalida contra su estado autoritativo, porque la vista utilizada para planificar puede haber quedado antigua. |
| 8. Automatismo | La IA elige comportamiento y solicita movimientos. El jugador no da órdenes durante el combate. Solicitudes, cambios de objetivo y reconsideración pertenecen a IA; controles manuales del laboratorio simulan sus mensajes mediante fixtures, sin implementar la IA real de la tarjeta 10. |
| 9. Vistas | Datos iniciales y actualizaciones por mensajes, identificados con revisión y tick lógico. Cada consumidor conserva únicamente su vista necesaria; nadie consulta ni modifica estado mutable ajeno. Vigencia y fases exactas constan en el contrato NAV v1. |

### Autoridad y confirmaciones

Navegación es el único escritor de posiciones, ocupación y disponibilidad/CD de movimiento. Cada robot es una entidad identificada: este diseño no exige una instancia de sistema ni un bus por robot.

La IA elige el destino de su comportamiento y el próximo paso. Puede usar una utilidad pura de búsqueda sobre los datos recibidos. Navegación valida robot/posición de origen, vecindad, existencia y transitabilidad del destino, ocupación y disponibilidad de la habilidad.

Si se aprueba el paso, Navegación actualiza conjuntamente posición, ocupación y próximo tick habilitado; después publica el hecho confirmado. No espera un acuse adicional del robot para aplicar la posición. IA y presentación actualizan sus vistas al recibir el evento. La confirmación informa algo ya sucedido.

Un rechazo normal conserva posición, ocupación y CD. Informa motivo y relación con la solicitud para que IA reconsidere. No activa CD ni falla la sesión por una acción de negocio imposible. Un dato/mensaje que viole el protocolo conserva la política de fallo técnico vigente del núcleo.

La animación puede representar el desplazamiento suavemente, pero la posición lógica cambia al aprobarse el paso. Alcance y ocupación usan la posición nueva desde ese momento. El tiempo de animación no decide cuándo puede volver a moverse el robot.

### Ejemplo temporal aprobado

Si un paso se aprueba en el tick 100 con CD 20, la posición nueva y la ocupación se aplican en ese tick; el próximo paso no puede aprobarse antes del tick 120. CD 10 permite una cadencia de dos pasos por segundo de simulación; CD 40, uno cada dos segundos, cuando existan solicitudes válidas. La velocidad observada también puede limitarse por bloqueos o decisiones de IA.

Las fases actuales admiten solicitud en decision y recepción en movement del mismo tick. Una salida de movement hacia decision se entrega en el tick siguiente. Por tanto, un rechazo no provoca ejecución inmediata o recursiva de IA. Nombres, campos y fichas constan en NAV v1; no se modifica el orden del bus.

El orden de registro/procesamiento de IA puede favorecer repetidamente a unas unidades. Se acepta comenzar con orden de mensajes por simplicidad y trazabilidad; su equidad deberá observarse en pruebas, sin prometer ausencia de bloqueos.

## Alternativas descartadas o sustituidas

- Filas/columnas desplazadas facilitan dibujo pero complican vecinos por paridad; coordenadas de tres valores son regulares pero redundantes. Se usan axiales y geometría pura.
- Generación procedural añade reglas de autoría/generación; se comienza con tablero finito configurable. No hay tablero ilimitado ni tamaño variable en un encuentro.
- Duración previa a la llegada con reserva de destino: **sustituida** por acción inmediata seguida de CD. No conservar origen ocupado durante el CD ni reservar destino antes de aplicar un paso.
- Prioridad por tiempo de espera: **sustituida** por primera solicitud válida en orden del bus. La velocidad habilita cuándo solicitar, no una prioridad especial para competir por una casilla.
- Ruta ejecutada completa sin reconsideración: no se adopta ante ocupación dinámica.
- Cola larga de órdenes de jugador y cancelación de tránsito: no aplica al modelo de combate automático y pasos discretos. La IA puede reconsiderar su siguiente solicitud; detalle de objetivos/órdenes pendientes se diseña con sus contratos.

## Primera entrega y laboratorio: alcance aprobado

Tablero, obstáculos básicos, entidades de un hexágono, posición/ocupación autoritativa, habilidades de movimiento con CD, geometría y cálculo puro de rutas, solicitudes/resultados tipados e integración mediante una receta APP-001 nueva con fixtures. No reemplazar semánticamente los mensajes históricos de demostración.

Se aprobó e implementó BFS porque todos los pasos de una misma unidad tienen igual coste: distintas unidades pueden tener CDs diferentes sin requerir rutas ponderadas. Dijkstra/A* se reconsiderarán si el terreno cambia el tiempo de cada paso. El algoritmo y orden fijo de vecinos constan en el contrato; el panel informa búsquedas/nodos, sin prometer rendimiento de producción.

Panel esquemático 2D de desarrollo: editar mapa/robots/CDs antes de iniciar; programar mensajes de fixtures; avanzar paso/fase/tick, pausar y acelerar; visualizar ocupación, próximo tick habilitado, rutas calculadas y confirmaciones/rechazos; mostrar colas/causalidad; exportar escenario, reporte, replay y debug; comparar encuentros independientes.

El panel no introduce órdenes del jugador en el combate final. No necesita modelos 3D ni implementa percepción/IA/armas reales. La IA de prueba conserva su vista por mensajes y usa utilidades puras para decidir solicitudes reproducibles.

### Escenarios de aceptación

1. Paso válido aplica nueva posición y libera origen una sola vez.
2. Solicitudes a destino ocupado/no vecino/fuera del tablero/bloqueado, origen antiguo o CD activo se rechazan sin alterar movimiento.
3. Dos solicitudes a una casilla libre: primera válida aprobada, segunda rechazada; invertir orden invierte ganador.
4. Una solicitud inválida anterior no bloquea una válida posterior.
5. CDs distintos, primera acción disponible y límite exacto t+X, incluso en pausa/aceleración/replay.
6. Vista de ruta antigua: revalidación impide entrar en casilla recién ocupada; rechazo llega a fixture y provoca reconsideración.
7. Casilla liberada, desvío, corredor cerrado, destino inaccesible y caminos equivalentes con desempate estable.
8. Inicialización inválida/duplicada y solicitudes repetidas: políticas explícitas verificadas al cerrar contrato.
9. Cambios de vistas con revisión/tick, entrada de sesión antigua y aislamiento entre dos encuentros.
10. Traza/resultados reproducibles y debug sin I/O dentro del tick.

La evidencia ejecutada y sus límites constan en la ficha de entrega; no se consideran probados recorridos adicionales del navegador que no figuren allí.

## Decisiones finales aprobadas y continuidad

### CD mínimo y múltiples solicitudes en un tick — aprobado

Aprobado por el usuario mediante «1. ok»: **CD entero >=1 y como máximo un paso aprobado por robot/tick**. Se excluye CD cero para evitar múltiples pasos dentro del mismo tick. Los valores concretos del contenido son de prueba, no balance final.

### Migración del catálogo — estrategia aprobada

Se acordó expresar el tiempo como cooldown: nombre objetivo **moveCooldownTicks**. La base anterior usaba moveDurationTicks en Locomotion, esquema, JSON básico y fixtures CAT/APP. La implementación vigente usa moveCooldownTicks y CAT-002.

Aprobado por el usuario mediante «2. ok»: revisión nueva y explícita del esquema afectado, actualización coordinada de catálogo y fixtures productores/consumidores y rechazo claro de JSON/replays anteriores incompatibles. No mantener lectores legacy separados en esta entrega ni reinterpretar silenciosamente moveDurationTicks. Las versiones exactas, mensajes afectados y migración ejecutada constan en CAT-002, NAV v1 y entrega. Alternativa descartada: lectores legacy separados, con mayor superficie de mantenimiento.

Impacto comprobado: src/content/{contracts,schema}.ts; content/fixtures/basic-v1.json → basic-v2.json; tests/core/content-fixture.ts y content-fixture.test.ts; tests/core/application-fixture.ts; documentación CAT/APP. Buscar también todas las pruebas de esquema/replay y paneles que consumen esas vistas al delimitar alcance. src/core, fases y formato general ReplayRecording no requieren cambios por esta propuesta.

### Contrato y plan — aprobados e implementados

El contrato NAV v1 y el plan 1.0 definen inicialización/solicitudes/resultados, revisiones, cooldown, límites, secuencias/deduplicación, fases y vigencia. La implementación usa BFS, tres participantes y migración CAT-002, sin ampliar APIs de núcleo/APP. Mantiene causalidad por solicitud y no combina raíces independientes. Pendiente: revisión humana de la entrega e integración GitHub.

La conducta de IA ante bloqueo —esperar, cambiar de objetivo o buscar otra ruta— pertenece a la tarjeta 10. Para probar NAV-001 se implementó una fixture determinista; no se fija aquí la IA real ni se habilita implementarla.

Dimensiones y presupuestos, desempates, migración y alcance quedaron concretados en el plan aprobado. Este documento conserva decisiones; la ficha de entrega conserva las verificaciones reales.

## Fuera de esta entrega

Vuelo y capas de ocupación, altura, cobertura, destrucción de obstáculos, empujes, teletransporte, unidades de varios hexágonos, terreno con costes especiales, modificadores de movilidad, fórmulas de IA, balance final y presentación 3D. Vuelo deberá distinguir atravesar una casilla de detenerse en ella cuando se diseñe.

## Referencias y verificación documental

- [Mensajería v1](messaging-v1.md), [propiedad de sistemas](systems.md), [ENV-001](deterministic-environment-v1.md), [CAT-001](content-catalog-v1.md), [APP-001](application-lifecycle-v1.md).
- [Decisiones compartidas](../decisions.md), [fichas de contrato y encargo](../workflow/templates.md).
- [GDD parte 1](https://trello.com/c/RjyacKwt) y [parte 2](https://trello.com/c/xPCPmE6M): propuestas no aprobadas conservan ese estado.

El documento inicial registró las decisiones; la ejecución posterior autorizada implementó el alcance. Se verificaron código, tipos y navegador según ficha de entrega. Sin builds. Engram no está disponible; no se afirma guardar allí.

Ejecución posterior autorizada mediante «aprobado. implementalo»; implementación local completada y evidencia en [entrega NAV-001](../workflow/board-navigation-v1.md). Las propuestas técnicas quedaron concretadas en contrato 1.0 y migración CAT-002; integración GitHub pendiente.
