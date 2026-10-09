# Sistemas y propiedad del estado

Esta especificación organiza responsabilidades. El inventario inicial sirve para definir fronteras; no incorpora mecánicas tentativas del GDD como requisitos de producto ni habilita tareas.

## Regla de aislamiento

Un sistema es el único escritor del estado que posee. Otros sistemas conocen hechos mediante mensajes inmutables y mantienen solo sus vistas necesarias. Nunca reciben referencias a su implementación o estado mutable.

Un dato recibido conserva origen, revisión o tick según su contrato. La ficha debe indicar qué mensaje inicializa la vista, cómo acepta actualizaciones, cuándo la invalida y qué hace antes de disponer de información válida. No completar información faltante leyendo directamente al productor.

Los contratos públicos contienen datos, identificadores y semántica. Las utilidades compartidas son puras: entrada explícita, salida explícita, sin reloj, I/O, estado global mutable, instancias de sistemas ni aleatoriedad implícita. La geometría hexagonal puede ser una utilidad pura; el estado de ocupación pertenece a navegación.

El código de ensamblado crea e inyecta bus, scheduler y sistemas. Ningún sistema obtiene el bus mediante un singleton global ni descubre implementaciones vecinas en un contenedor de servicios.

## Mapa inicial de combate

| Sistema estable | Estado propio | Entradas y vistas necesarias | Salidas de referencia | Fase del loop |
| --- | --- | --- | --- | --- |
| `navigation` | Posiciones y ocupación del tablero | Órdenes de movimiento, geometría y capacidades de movilidad recibidas | `RobotMovido`, rechazos de movimiento | Movimiento |
| `perception` | Observaciones y vistas recibidas que permiten calcularlas | Posiciones y capacidades perceptivas; solo información habilitada por las reglas de visibilidad aprobadas | `ObservacionDisponible` | Percepción |
| `decision` | Estado de comportamiento y decisiones de IA | Observaciones válidas y configuración de IA/directivas recibidas | `SolicitarMovimiento`, `SolicitarAtaque` | Decisiones |
| `weapons` | Estado de armas, recargas y solicitudes de ataque pendientes | Órdenes de ataque, configuración y vista de posiciones necesaria para validar alcance | `AplicarImpacto`, rechazo explícito del ataque | Acciones |
| `damage` | Integridad, escudos y estado defensivo | Impactos y configuración defensiva recibida | `AtaqueResuelto` y cambios defensivos | Resolución |
| `battle` | Participantes, estado y resultado del encuentro | Hechos de los sistemas combatientes necesarios para las condiciones de finalización | Inicio y final del encuentro | Publicación |

Las reglas de movimiento, alcance, daño y victoria se especificarán cuando se apruebe cada mecánica. Esta tabla asigna la autoridad para ejecutarlas; no decide fórmulas ni simultaneidad de ataques.

`weapons` solicita que `damage` resuelva un impacto. No modifica integridad o escudos. `damage` publica el resultado de ese impacto mediante `AtaqueResuelto`. `battle` observa los resultados y decide el estado global del encuentro sin reescribir los datos de los demás sistemas.

## Fronteras fuera del combate

| Sistema | Estado o responsabilidad exclusiva |
| --- | --- |
| `inventory` | Existencias, disponibilidad y movimientos de piezas y materiales. |
| `hangar` | Configuraciones de robots y equipamiento. Las operaciones sobre piezas necesitan el contrato de disponibilidad/reserva de inventario antes de habilitarse. |
| `expedition` | Ruta, nodo y estado de la expedición, según las reglas aprobadas. |
| `progression` | Desbloqueos y progresión permanente; no duplica las existencias de inventario. |
| `presentation` | Estado visual y de interacción; interpreta resultados y envía intenciones, sin autoridad sobre combate. |
| `persistence` | Adaptación y confirmación de almacenamiento de snapshots; no posee las reglas de progresión. |
| `network-bridge` | Traducción controlada de entradas y salidas externas. Modelo de multiplayer pendiente. |

Cada operación que afecte a varios propietarios necesita un protocolo explícito de confirmación y fallo. Por ejemplo, equipar una pieza no puede consistir en que hangar e inventario actualicen sus copias independientemente. El contrato de esa operación debe acordarse antes de implementarla.

## Registro de un sistema

Antes de habilitar un sistema, completar la [ficha de sistema](../workflow/templates.md#ficha-de-sistema). Su identificador, fase, contratos y orden estable forman parte de la configuración de sesión y de las evidencias de reproducibilidad.

Un sistema puede recibir mensajes en fases declaradas distintas de su fase de loop para actualizar sus vistas. Todas las entradas de una fase se procesan antes de cualquier loop de esa fase. Las reglas de negocio que necesitan la vista completa se ejecutan en el loop, no anticipadamente al recibir el primer mensaje.

Los sistemas de simulación avanzan mediante el scheduler. Los adaptadores externos pueden tener ciclos de I/O propios, con los límites descritos en [integraciones externas](external-boundaries.md). El loop visual no puede modificar la simulación mediante referencias directas.
