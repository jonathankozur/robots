# Revisión de independencia y consulta sobre reversa

Fecha: 14 de octubre de 2026. Responsable humano: usuario solicitante. Base local examinada: main, `44038c9e1b5ea98d0479bf4c5ffaf9cab1b69e57`, en C:/dev/robots. Alcance: revisión de paquetes, contratos, puertos, montaje, ownership, scheduler y replay. Esta revisión no implementa correcciones ni reversa. Engram no está disponible: los descubrimientos se conservan en este informe.

## Resultado

Los paquetes canónicos no importan implementaciones de sus vecinos. Navegación y presentación funcionan sin sus proveedores habituales con las dependencias comunes declaradas. Se encontraron dos vías de acoplamiento por objetos mutables compartidos, una restricción de versionado del host y una limitación conocida de identidad.

## Hallazgos reproducidos

### 1. P1 — PHASES permite cambiar el scheduler de otras sesiones

Fuente: [system-api:1](../../packages/system-api/src/index.ts#L1), [sesión:59](../../packages/runtime/src/scheduler/session.ts#L59), [sesión:195](../../packages/runtime/src/scheduler/session.ts#L195), [bus:58](../../packages/runtime/src/messaging/bus.ts#L58).

PHASES es un array singleton exportado con `as const`; no está congelado en ejecución. Lo leen el scheduler, el catálogo, el bus y los consumidores del API. Un consumidor JavaScript puede modificarlo aunque TypeScript declare el tipo readonly.

Reproducción en un proceso Node independiente: crear e iniciar una Session, ejecutar `PHASES.reverse()` desde otro módulo y avanzar un tick. Resultado:

```text
Object.isFrozen(PHASES): false
Manifiesto: input,perception,decision,movement,action,resolution,publication
Orden ejecutado: publication,resolution,action,movement,decision,perception,input
```

El manifiesto conserva su copia congelada original y deja de describir el comportamiento real. Una modificación ajena puede afectar sesiones activas y posteriores sin pasar por el host ni por un mensaje. No se encontró una mutación así en los consumidores actuales; la vía existe y se reprodujo. Debe cerrarse congelando la constante y comprobando que intentos de mutarla no alteran ninguna sesión.

### 2. P2 — beginContextDefinition filtra una regla mutable común

Fuente: [application/v1:7](../../packages/protocol/src/application/v1.ts#L7), [application/v1:14](../../packages/protocol/src/application/v1.ts#L14).

La fábrica devuelve `requiredParticipants: strings`, donde strings es un objeto mutable a nivel de módulo. Dos definiciones comparten esa referencia. Modificar el resultado de una llamada afecta las siguientes llamadas.

```text
Regla congelada: false
Límite original: 32
Límite tras modificar una definición: 1
Regla compartida entre dos llamadas: true
```

También se probó con el host real y la receta APP existente: la receta inició correctamente antes de modificar esa regla; un host nuevo con la misma receta rechazó luego el arranque con `PAYLOAD_INVALID`. Los bindings y catálogos ya preparados conservan sus snapshots; el efecto afecta composiciones posteriores.

Propuesta: congelar profundamente las reglas internas y devolver definiciones con datos propios inmutables. Verificar independencia entre llamadas y entre hosts, además de la inmutabilidad de las definiciones estáticas, que sí está comprobada.

### 3. P2 — El puerto Actor y el host fijan las suscripciones a versión 1

Fuente: [Actor:110](../../packages/system-api/src/index.ts#L110), [montaje:73](../../packages/application-host/src/assembly.ts#L73), [observador:77](../../packages/application-host/src/assembly.ts#L77).

Actor.subscriptions no incluye version. El host inscribe cada suscripción con la versión literal 1; también interpreta outputTypes como nombres y los inscribe con versión 1. Esto impide montar un consumidor de un contrato v2 sin cambiar infraestructura común.

Reproducción: un evento IndependentEvent v2 con cero productores y un consumidor válido se inscribe y arranca directamente en Session. El mismo contrato mediante ApplicationController y una suscripción con version:2 adicional es rechazado con `CONTRACT_INVALID`, porque el host ignora ese campo y busca v1. Las recetas actuales usan v1 y siguen funcionando.

Propuesta: identificar suscripciones y salidas por nombre y versión explícitos, conservando un camino de compatibilidad para recetas actuales. El protocolo APP v1 puede continuar como protocolo de ciclo de vida aprobado; no debe imponer v1 a todos los mensajes de dominio.

### 4. P3 — IDs propios fijos limitan el montaje de NAV/PRE

Fuente: [NAV:30](../../packages/navigation/src/actor.ts#L30), [PRE:34](../../packages/presentation/src/actor.ts#L34), [bindings:25](../../packages/application-host/src/bindings.ts#L25), [bindings:32](../../packages/application-host/src/bindings.ts#L32).

Los actores confirman inicialización con participantId navigation/presentation literal. Los helpers de binding restringen sus IDs a esos mismos literales. No son dependencias de implementaciones vecinas; sí son una dependencia de la convención de identidad del host. Esta limitación ya estaba documentada en IND-001.

Reproducción: montar el actor NAV intacto como nav-a mediante bindMessage con permisos y owner correctos. La preparación es válida; el primer tick falla con `APP_PARTICIPANT`, porque el actor confirma navigation y el productor real es nav-a.

Propuesta opcional: inyectar la identidad propia al crear el actor. Conservar los IDs actuales como defaults y en recetas existentes, ya que forman parte del manifiesto y de la derivación de RNG. No es necesario cambiar IDs para cumplir independencia de presencia de los proveedores actuales.

## Observaciones y controles que sí funcionan

- Las definiciones NAV/PRE y APPLICATION_MESSAGES están congeladas, incluidos sus campos. Se comprobó como control; no se reportan como estado mutable.
- No se encontraron imports de runtime/host/implementaciones vecinas en NAV/PRE, ni imports de implementaciones de dominio en API, protocolo o bibliotecas puras.
- World y Result en protocol/navigation/v1 representan dependencia del contrato público. Presentación puede consumir datos conformes de cualquier proveedor. Cambiar la semántica del protocolo exige migración, aunque el proveedor sea intercambiable.
- Los puentes antiguos src/navigation/contracts y src/presentation/data/contracts importan bindings del host. Esa dependencia permanece por compatibilidad y no está en los paquetes canónicos.
- El adaptador gráfico repite 50 ms por tick en motion.ts, coherente actualmente con el perfil de 20 ticks/s. Es una convención duplicada que convendría centralizar al evolucionar el perfil; no se detectó un desajuste actual.
- La sesión conserva su política de fallo global. Independencia de código/presencia no aporta aislamiento de fallos ni procesos separados.

## Evidencia ejecutada

```powershell
node --test tests/packages/architecture.test.ts tests/packages/composition.test.ts tests/packages/isolated.test.ts tests/core/migration-equivalence.test.ts
```

37/37 pruebas aprobadas, cero omitidas y cero fallos (~16.9 s): 7 controles del grafo, 4 composiciones, 9 paquetes aislados y 17 referencias de equivalencia/replay. Los ensayos aislados incluyen comprobación de tipos sin emisión. No se repitió la suite completa ni se ejecutaron builds.

Comprobaciones adicionales efímeras en procesos Node separados: mutación de PHASES y divergencia respecto del manifiesto; mutación de la regla APP y fallo en otro host; evento v2 aceptado por Session y rechazado por el host; cambio de ID NAV con fallo de confirmación. No persistieron mutaciones en el checkout ni se añadieron pruebas al código.

## Consulta conceptual: avanzar hacia atrás sin guardar historial

Determinismo garantiza el mismo sucesor con el mismo estado y entradas. Reversibilidad exige además poder reconstruir un único predecesor a partir del estado actual y de las entradas necesarias. Una operación que sobrescribe o descarta información puede ser determinista y no tener inversa única. Esta distinción se expone en el trabajo original de [Bennett sobre reversibilidad lógica](https://worrydream.com/refs/Bennett_1973_-_Logical_Reversibility_of_Computation.pdf).

Ejemplo del código: msToTicks convierte tanto 1 ms como 49 ms a 1 tick. Si solo se conserva ese tick, no puede deducirse cuál fue la duración original. En NAV se sobrescriben readyAtTick y revisiones/posiciones, se vacía la cola y se expulsan resultados de la caché acotada. El bus elimina entregas consumidas; el scheduler retira entradas admitidas. Estos datos anteriores no se recuperan decrementando el contador de tick. Usar trazas para recuperarlos ya supone guardar historial, incluso cuando solo se guarda en RAM.

| Enfoque | Información necesaria | Coste y límite |
| --- | --- | --- |
| Reconstruir desde el inicio hasta el tick elegido | Estado inicial, semilla, configuración y secuencia de entradas externas | Sin snapshots por tick; trabajo proporcional al horizonte reconstruido. Requiere conservar entradas o poder regenerarlas. |
| Checkpoints/deltas y replay | Estados parciales o completos más las entradas necesarias | Más almacenamiento y retroceso más rápido. Puede ser íntegramente en RAM; sigue siendo historial guardado. |
| Simulación matemáticamente reversible | Reglas invertibles sobre el estado completo y sus entradas disponibles | Rediseño profundo: sin pérdida de información, operaciones inversas de cada sistema, bus/scheduler/RNG y manejo de efectos externos. Las reglas actuales no ofrecen ese contrato. |

Una simulación cerrada que recibe todas sus entradas al principio puede recomputar un tick anterior desde su estado inicial y semilla sin almacenar estados intermedios. Eso permite buscar un tiempo anterior, pero no ejecuta las reglas actuales en reversa. Cuando hay órdenes externas durante la ejecución, sus valores y orden deben conservarse o ser regenerables: la semilla no los reconstruye.

Para una reversa real habría que invertir también el orden de operaciones, restituir colas y mensajes, revisiones, caches, contadores, consumo de RNG y estado privado de cada actor. Aislar efectos externos y reconstruir la presentación visual completa esa operación. Un motor reversible general puede retener la información que normalmente borraría, pero esa información adicional es almacenamiento aunque no se llame snapshot.

Recomendación conceptual: aprovechar replay para buscar un tick anterior y añadir checkpoints si el coste lo exige. Si el requisito literal es no conservar ninguna información histórica, las reglas deben restringirse a transformaciones invertibles y las entradas necesarias deben estar disponibles. No se propone implementar nada de esto con esta consulta.
