# IND-002 — Corrección de cuatro acoplamientos

## Encargo y estado

- Responsable humano: Jonathan Kozur. Ejecutor: Codex.
- Solicitud: «vamos a corregir los 4 puntos», crear tarjeta, plan de implementación y rama.
- Base: main/origin/main, `44038c9e1b5ea98d0479bf4c5ffaf9cab1b69e57`.
- Rama: `codex/fix-system-coupling`. Checkout: `C:/dev/robots`, conforme a la preferencia del responsable.
- Tarjeta: [IND-002](https://trello.com/c/P79xHzcu); implementación local terminada, pendiente revisión e integración.
- Estado: plan e interfaces aprobados por Jonathan Kozur mediante «aprobado» el 14 de octubre de 2026; implementación local entregada para revisión. [Evidencia y límites](system-coupling-fixes-delivery.md).
- Evidencia: `docs/reviews/system-independence-2026-10-14.md`.
- Reserva: alcance enumerado abajo. Listas En desarrollo y Revisión / pruebas consultadas: sin otra tarea incompleta que reserve estos archivos; IND-001 está completa.

## Objetivo

Eliminar estado mutable compartido en fases y definiciones APP, permitir suscripciones y observaciones con versiones explícitas, y montar navegación y presentación con una identidad asignada por el host. Conservar mensajes actuales, orden, resultados, causalidad y replay de las recetas existentes.

## Plan de implementación

Cada paso comienza con una prueba significativa que falla por la conducta faltante, continúa con la implementación mínima y termina con regresión pertinente.

### 1. Proteger el orden común de fases

- Congelar `PHASES` en tiempo de ejecución, conservando la tupla y el tipo `Phase`.
- Probar intentos de invertir, sustituir o agregar fases y comprobar que no alteran sesiones activas ni nuevas.
- Comparar orden ejecutado, traza y manifest. No duplicar listas independientes que puedan divergir entre bus y scheduler.

### 2. Eliminar referencias mutables compartidas en esquemas APP

- Hacer que `beginContextDefinition` e `initializationDefinition` devuelvan copias profundas e inmutables mediante los helpers puros existentes.
- Separar las definiciones tanto de constantes internas como de los objetos `fields` entregados por el llamador. No congelar directamente los objetos del llamador.
- Probar aislamiento entre dos llamadas, entre ambas fábricas y frente a cambios posteriores del esquema original.
- Demostrar que crear o intentar modificar una definición no cambia la validación de otro host; conservar validaciones y errores actuales.

### 3. Declarar la versión en suscripciones y observaciones

- Añadir una referencia neutral `MessageReference` con `type` y `version` en `system-api`.
- Exigir `version` en las suscripciones declaradas por `Actor`.
- Cambiar `Recipe.outputTypes` de nombres a referencias `{type, version}`. Se conserva el nombre de la propiedad para limitar la migración.
- Pasar la versión declarada a `session.subscribe`, tanto para actores como para `app-output`.
- Migrar conjuntamente actores, recetas y fixtures existentes con `version: 1`. El ciclo de inicialización APP permanece en v1.
- Probar un evento v2 a través del host, observación v2 y coexistencia de v1/v2 sin entregas cruzadas. Versiones desconocidas y permisos inválidos deben seguir rechazándose.
- Revisar todos los usos antes de editar. La API TypeScript cambia de forma explícita; no interpretar una versión ausente como 1 para ocultar consumidores sin migrar.

### 4. Asignar la identidad de montaje desde el host

- Añadir un contexto neutral e inmutable `ActorContext {systemId}` en `system-api`.
- El host pasa ese contexto como tercer argumento de `Participant.create(identity, ownResource, context)`, preservando el segundo argumento para recursos.
- Las fábricas NAV/PRE reciben un contexto opcional como segundo argumento y capturan su identificador. Las llamadas directas existentes mantienen los identificadores predeterminados `navigation` y `presentation`.
- Las recetas usan wrappers explícitos para entregar el tercer argumento del host a las fábricas NAV/PRE.
- Las confirmaciones APP usan la identidad asignada. Ampliar los helpers de binding para aceptar IDs válidos distintos de los nombres predeterminados.
- Probar NAV/PRE con IDs personalizados, arranque, mensajes de dominio, observaciones y replay; probar instancias independientes en sesiones distintas.
- Conservar la comprobación de que la confirmación pertenece a su emisor y el responsable único por comando/tipo/versión. IDs configurables no habilitan dos responsables del mismo comando en una sesión.

### 5. Regresión y entrega

- Ejecutar pruebas nuevas y existentes de bus, sesión, host, navegación, presentación, arquitectura, composición, aislamiento y replay.
- Comparar las 17 referencias de equivalencia de la migración IND-001: resultados, fases, manifest/traza, causalidad y replay sin actualizar las referencias para ocultar diferencias.
- Comprobar tipos con `tsc --noEmit` en raíz y los nueve paquetes, y ejecutar `git diff --check`.
- Confirmar que no aparecen dependencias de actores hacia host/runtime ni entre sistemas de dominio.
- Registrar evidencia RED/GREEN, verificaciones ejecutadas, límites y pendientes en una entrega compartida y actualizar la tarjeta.

## Alcance editable

- `packages/system-api/src/index.ts` y pruebas pertinentes.
- `packages/protocol/src/application/v1.ts` y pruebas pertinentes.
- `packages/application-host/src/contracts.ts`, `assembly.ts`, `bindings.ts`, `controller.ts` y pruebas pertinentes.
- `packages/navigation/src/actor.ts`, `packages/presentation/src/actor.ts` y sus pruebas.
- Recetas y consumidores afectados en `tests/core/**`, `tests/packages/**` y, si el inventario confirma usos directos afectados, `tests/browser/**`.
- Puentes públicos existentes en `src/**` únicamente si requieren actualizar la exportación de los tipos afectados.
- Documentación de estas interfaces, este plan, informe de revisión y ficha de entrega.

No se necesitan dependencias nuevas, cambios de configuración, fórmulas de juego ni cambios en el scheduler. Los archivos locales ajenos `.playwright-mcp/`, `event-bus/` y `pre-001-initial.png` se preservan.

## Contratos, productores y consumidores

| Interfaz | Productor o proveedor | Consumidores afectados | Compatibilidad |
| --- | --- | --- | --- |
| PHASES | system-api | runtime, catálogo, host, laboratorio | Valores y orden idénticos; protección en ejecución |
| Fábricas APP | protocol/application/v1 | bindings y assembly del host | Mismos nombres, versiones y payloads; devolución inmutable |
| Suscripciones Actor | NAV, PRE y actores de fixtures | assembly del host | Nueva versión obligatoria en la API TypeScript |
| Recipe.outputTypes | recetas APP/NAV/PRE | controller y assembly | Migración coordinada a referencias tipo/versión |
| ActorContext | host o llamador directo | fábricas NAV/PRE | Nuevas capacidades de montaje; defaults actuales conservados |

NAV v1, PRE v1, APP v1, CAT v2 y mensajes BUS conservan sus contratos serializados. La nueva selección de versiones utiliza capacidades ya existentes en Session. Los paquetes son workspaces privados de fuentes; todos los consumidores conocidos se migran juntos. No se cambian permisos, presupuesto, colas, fases ni política global de fallos. Retroceder la simulación queda fuera del encargo.

## Alternativas y elección propuesta

- Congelar fases y copiar/congelar esquemas evita interferencias entre sesiones sin mantener catálogos de fases duplicados. Copiar solo superficialmente dejaría alias anidados.
- Versiones explícitas requieren actualizar consumidores, pero permiten detectar omisiones con TypeScript. Un fallback implícito a v1 mantendría la restricción oculta.
- Un contexto neutral separa la identidad del montaje de los payloads de dominio y mantiene intacto el registro de recursos. Incluir el ID en el payload de identidad APP ampliaría su contrato serializado y la migración de replay.
- IDs predeterminados mantienen las llamadas directas existentes. El host siempre entrega la identidad explícita del participante.

## Criterios de aceptación

1. Ningún llamador puede modificar el orden común de fases ni provocar discrepancias entre ejecución y manifest.
2. Las fábricas APP no comparten referencias mutables con otras llamadas ni con los esquemas de entrada.
3. Actores y observadores del host reciben exclusivamente la versión declarada, incluyendo v2.
4. NAV y PRE arrancan y funcionan con IDs configurados por el host, conservando autorización y responsable único.
5. Las recetas actuales conservan fases, resultados, causalidad y replay; las pruebas de aislamiento y arquitectura siguen aprobadas.

## Verificaciones y restricciones

El plan incluye TDD y comprobación de tipos sin emisión. Nunca ejecutar builds, ni comandos que los invoquen indirectamente. Registrar como pendientes las verificaciones que no se ejecuten. Esta tarea prepara la corrección; commit, push, PR y merge requieren su autorización cuando corresponda.

Engram no está disponible en esta sesión. El contexto, las decisiones propuestas y el estado se conservan en este documento y en Trello; no se afirma haberlos guardado en memoria externa.

## Ampliación documental aprobada — mapa de mensajes

- Aprobación humana: «oka, hacelo», en respuesta a la propuesta de crear un Markdown con catálogo y secuencias de mensajes, el 14 de octubre de 2026.
- Objetivo: hacer visible quién publica cada mensaje, quién lo recibe, en qué fase y qué efecto tiene el handler.
- Alcance editable añadido: `docs/architecture/message-flow-v1.md` y esta ficha para registrar la ampliación.
- Contratos: APP v1, NAV v1 y PRE v1 se consultan; no se cambian nombres, payloads, versiones, fases ni reglas de montaje.
- Criterios: separar actores del producto, infraestructura y fixtures; documentar la composición de laboratorio NAV/PRE que existe en el checkout; dibujar inicio y recorrido de movimiento; distinguir causalidad explícita de mera referencia en payload; enlazar las fuentes de código.
- Verificación permitida: cotejo manual con contratos, bindings, ensamblado, actores y receta; revisar el diff documental. No ejecutar builds ni pruebas para este cambio de documentación.
