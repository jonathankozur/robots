# Persistencia y puente de red

Los adaptadores reciben y emiten mensajes mediante contratos explícitos. No entregan conexiones, referencias a sistemas ni callbacks de I/O como payload. No leen directamente estado mutable de los sistemas.

## Separación de loops

El scheduler controla la simulación. Los adaptadores externos pueden tener ciclos de I/O propios, pero sus resultados se convierten en entradas inmutables admitidas en el límite de `input` de una sesión válida.

No esperar una operación de red o base de datos dentro de un handler o loop de simulación. Un sistema que espera un resultado conserva un estado explícito de operación pendiente y continúa únicamente al recibir el mensaje correspondiente. Esperar lógicamente una confirmación no significa bloquear el hilo del scheduler.

El ritmo y las respuestas externas no forman parte de la garantía de determinismo salvo que se registren como entradas admitidas. La reproducción emplea esas entradas registradas, sin repetir escrituras reales ni consultar servicios externos.

## Checkpoint coherente

Un punto seguro se produce entre encuentros, con el resultado y los cambios persistentes asociados ya resueltos. El simple evento de fin de combate no acredita por sí solo que inventario, progresión y expedición terminaron sus actualizaciones.

El coordinador de ciclo de expedición debe establecer una barrera de captura:

1. Identificar el punto seguro, el conjunto de sistemas persistentes y una revisión común del checkpoint.
2. Terminar las operaciones persistentes previas y detener brevemente nuevas mutaciones de esos propietarios mientras se capturan sus partes.
3. Solicitar las partes por mensajes; cada propietario produce una copia inmutable con identificador de checkpoint y revisión comunes.
4. Reunir exactamente una parte válida por propietario. Si falta una, hay conflicto o una revisión no coincide, la captura falla explícitamente y no se envía un snapshot incompleto.
5. Una vez reunido el snapshot, finalizar la barrera de captura y enviarlo al adaptador de persistencia. La escritura externa ocurre fuera del loop de simulación.

La barrera es un protocolo de mensajes. No consiste en que el adaptador recorra objetos de los sistemas. No exige que todas las colas del juego estén vacías: exige que se hayan resuelto las operaciones que afectan a las partes incluidas en el punto seguro.

El snapshot declara identificador de progreso/perfil, checkpoint, revisión lógica, versión de formato y partes con propietario y versión. La tecnología elegida concretará su esquema de almacenamiento y migraciones. La configuración inicial del combate siguiente se reconstruye desde los datos de progreso; no se guardan mensajes o estado intermedio para reanudar una batalla.

## Confirmación y recuperación

- `SolicitarGuardado` tiene un único responsable: persistencia. `GuardadoConfirmado` y `GuardadoFallido` conservan la correlación y el identificador de checkpoint.
- El adaptador serializa las escrituras de un mismo perfil. Una confirmación vieja no puede hacer retroceder el último checkpoint confirmado.
- Solo una escritura completada con éxito actualiza el checkpoint confirmado. Una solicitud encolada no es evidencia de durabilidad.
- Un fallo conserva el snapshot capturado para un reintento explícito. Reintentar el mismo checkpoint debe ser idempotente en el contrato de almacenamiento; no duplica recompensas ni vuelve a ejecutar reglas de progreso.
- La recuperación usa el último checkpoint confirmado y valida las versiones de todas sus partes. Los propietarios reciben sus datos por mensajes de restauración antes de habilitar la expedición.
- Un snapshot incompatible, incompleto o una carga fallida se informa explícitamente. No se sustituye silenciosamente por progreso nuevo ni se sobrescribe el guardado válido.
- Una sesión de simulación fallida no captura el estado parcial como checkpoint. Los resultados de I/O tardíos solo se procesan en un contexto de adaptación válido y nunca reactivan una sesión cerrada.

No queda definida la pérdida de botín por derrota o retirada: es una decisión de producto pendiente en el GDD. Recuperar un checkpoint tras una interrupción y aplicar las reglas de una derrota son operaciones distintas que tendrán sus propios contratos.

## Puente de red

El puente de red será una frontera explícita, con lista permitida de operaciones y conversión entre protocolo externo y contratos internos. Una conexión remota no puede elegir libremente el tipo de evento interno, productor o estado de un sistema.

El bus interno permanece dentro del proceso. El puente valida y adapta entradas, controla el contexto de sesión y registra su admisión. Las salidas externas se construyen a partir de los datos autorizados para el destinatario; no se exporta automáticamente el catálogo completo de eventos.

Antes de implementarlo deben decidirse autoridad, sincronización, autenticación, validación de entradas, orden, repetición, desconexiones y compatibilidad de versiones. No se eligen servidor autoritativo, lockstep ni transporte en esta base.

Los escenarios de fallo y captura están en [aceptación](../workflow/acceptance.md). El esquema, la biblioteca de base de datos y los controles de red se implementarán con planes posteriores aprobados.
