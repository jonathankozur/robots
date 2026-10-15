# Sistemas y propiedad del estado

Esta especificación organiza responsabilidades. El inventario inicial sirve para definir fronteras; no incorpora mecánicas tentativas del GDD como requisitos de producto ni habilita tareas.

## Regla de aislamiento

Un sistema es el único escritor del estado que posee. Otros sistemas conocen hechos mediante mensajes inmutables y mantienen solo sus vistas necesarias. Nunca reciben referencias a su implementación o estado mutable.

Un dato recibido conserva origen, revisión o tick según su contrato. La ficha debe indicar qué mensaje inicializa la vista, cómo acepta actualizaciones, cuándo la invalida y qué hace antes de disponer de información válida. No completar información faltante leyendo directamente al productor.

IND-001 concreta esta frontera en [paquetes independientes](system-independence-v1.md). Los sistemas importan puertos neutrales, contratos públicos versionados y utilidades puras; sus dependencias no incluyen implementaciones de otros sistemas ni el runtime. `World` y `Result` pertenecen al protocolo público navigation/v1 en `packages/protocol`, no a la implementación de navegación. Presentación puede recibir datos sintéticos conformes o esperar sin que navegación esté instalada. El host selecciona implementaciones y permisos para cada composición.

Esta independencia conserva el fallo global de sesión ante una violación del protocolo o excepción de un actor. Aislamiento de fallos y procesos separados requieren otro diseño; no fueron autorizados en IND-001.

Los contratos públicos contienen datos, identificadores y semántica. Las utilidades compartidas son puras: entrada explícita, salida explícita, sin reloj, I/O, estado global mutable, instancias de sistemas ni aleatoriedad implícita. La geometría hexagonal puede ser una utilidad pura; el estado de ocupación pertenece a navegación.

El código de ensamblado crea e inyecta bus, scheduler y sistemas. Ningún sistema obtiene el bus mediante un singleton global ni descubre implementaciones vecinas en un contenedor de servicios.

## Mapa del combate mínimo aprobado

| Sistema estable | Estado propio | Entradas y vistas necesarias | Salidas de referencia | Fase del loop |
| --- | --- | --- | --- | --- |
| `navigation` | Posiciones y ocupación del tablero | Órdenes de movimiento, geometría y capacidades de movilidad recibidas | NavigationWorldReady@1 y NavigationStepResolved@1 | Movimiento |
| `perception` | Observaciones y vistas recibidas que permiten calcularlas | Posiciones y capacidades perceptivas; solo información habilitada por las reglas de visibilidad aprobadas | RobotObservationPublished@1 | Percepción |
| `decision` | Estado de comportamiento y decisiones de IA | Observaciones válidas y configuración de IA/directivas recibidas | RequestNavigationStep@1, RequestAttack@1, AIDecisionPublished@1 | Decisiones |
| `weapons` | Estado de armas, recargas y solicitudes de ataque pendientes | Órdenes de ataque, configuración y vista de posiciones necesaria para validar alcance | AttackAccepted@1, AttackRejected@1, ImpactRequested@1 | Acciones |
| `damage` | Integridad y estado activo/derrotado | Impactos, participantes y configuración de integridad recibida | DamageRosterInitialized@1, ImpactResolved@1 e ImpactRejected@1 | Resolución |
| `battle` | Participantes, estado y resultado del encuentro | Hechos de los sistemas combatientes necesarios para las condiciones de finalización | BattleStarted@1 y BattleFinished@1 | Publicación |

COM-001 aprobó e implementó las reglas mínimas de alcance/visión, recarga, daño simultáneo y resultado. Ver [contratos](automatic-combat-mvp-contracts-v1.md), [fichas](automatic-combat-mvp-systems-v1.md) y [entrega](../workflow/automatic-combat-mvp.md). Armadura, soporte, efectos y loot siguen fuera de este MVP.

`weapons` solicita que `damage` resuelva un impacto. No modifica integridad o escudos. `damage` publica el resultado de ese impacto mediante ImpactResolved@1 o ImpactRejected@1. `battle` observa los resultados y decide el estado global del encuentro sin reescribir los datos de los demás sistemas.

## Fronteras fuera del combate

| Sistema | Estado o responsabilidad exclusiva |
| --- | --- |
| `inventory` | Existencias, disponibilidad y movimientos de piezas y materiales. |
| `hangar` | Configuraciones de robots y equipamiento. Las operaciones sobre piezas necesitan el contrato de disponibilidad/reserva de inventario antes de habilitarse. |
| `expedition` | Ruta, nodo y estado de la expedición, según las reglas aprobadas. |
| `progression` | Desbloqueos y progresión permanente; no duplica las existencias de inventario. |
| `presentation` | Proyección pública e historial; sin autoridad sobre combate. En COM-001 el jugador observa y solo inicia el encuentro desde la aplicación. |
| `persistence` | Adaptación y confirmación de almacenamiento de snapshots; no posee las reglas de progresión. |
| `network-bridge` | Traducción controlada de entradas y salidas externas. Modelo de multiplayer pendiente. |

Cada operación que afecte a varios propietarios necesita un protocolo explícito de confirmación y fallo. Por ejemplo, equipar una pieza no puede consistir en que hangar e inventario actualicen sus copias independientemente. El contrato de esa operación debe acordarse antes de implementarla.

## Registro de un sistema

Antes de habilitar un sistema, completar la [ficha de sistema](../workflow/templates.md#ficha-de-sistema). Su identificador, fase, contratos y orden estable forman parte de la configuración de sesión y de las evidencias de reproducibilidad.

Un sistema puede recibir mensajes en fases declaradas distintas de su fase de loop para actualizar sus vistas. Todas las entradas de una fase se procesan antes de cualquier loop de esa fase. Las reglas de negocio que necesitan la vista completa se ejecutan en el loop, no anticipadamente al recibir el primer mensaje.

Los sistemas de simulación avanzan mediante el scheduler. Los adaptadores externos pueden tener ciclos de I/O propios, con los límites descritos en [integraciones externas](external-boundaries.md). El loop visual no puede modificar la simulación mediante referencias directas.
