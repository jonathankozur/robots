# CAT-002 — Catálogo v2 para cooldown de movimiento

Revisión: **2.0.0**, 13 de octubre de 2026. Estrategia de migración aprobada mediante «2. ok»; versiones y alcance concretos incluidos en el [plan NAV-001](../workflow/board-navigation-v1.md), aprobados para ejecución mediante «aprobado. implementalo».

## Diferencia frente a CAT-001

Paquete y todas las fichas/vocabularios pasan de schemaVersion=1 a **schemaVersion=2**. Locomoción sustituye moveDurationTicks por **moveCooldownTicks**, entero seguro >=1. Su significado es espera posterior a un paso inmediato aprobado, en ticks ENV-001; no duración previa al cambio de posición.

Se conservan API parseContentJson/validateContentBundle/fitsSlot, familias, IDs estables, categoría/montaje/tamaño, energía, referencias, canonización, profundidad/bytes/límites y datos inmutables descritos en [CAT-001 histórico](content-catalog-v1.md). No nuevos behaviorId, fórmulas, carga, consumo por paso ni archivos de assets.

El formato v2 rechaza campos desconocidos, campo viejo, ausencia de cooldown, cero/no enteros y mezcla de fichas v1/v2. Diagnóstico de versión o campo con path, sin migrar automáticamente objetos importados ni aplicar defaults.

## Colección y consumidores

basic-v2.json reemplazará basic-v1.json, con bundleId estable bundle.lab y contentRevision=lab-2; cooldown de la locomoción básica se declara explícitamente con valor de prueba 3. Actualizar importaciones y generadores de datos de tests. El valor 3 sigue siendo parámetro ficticio, no balance del juego ni conversión general de duración a cooldown.

Fixture CAT cambia FixtureInitializeNavigationContent a versión 2, payload moveCooldownTicks y revision content-fixture-v2; comando de combate conserva versión 1. Fixture APP usa nuevo Initialize de cooldown/salida de equipo con nombres y revisión distintos, conforme a [NAV v1](board-navigation-v1.md), sin ampliar el montaje APP.

Pruebas de versiones inválidas usarán v1 o v3 según caso; pruebas de miembros JSON repetidos y budgets conservan la conducta original adaptando la colección v2. ContentRevision discrepante usará un valor distinto de lab-2, sin convertir una prueba de incompatibilidad en igualdad accidental.

## Replay y notas históricas

Manifiestos guardan paquete v2 y contratos/revisiones nuevas; ReplayRecording conserva formatVersion=1. CAT/APP v1 se rechazan antes de operar con runtime nuevo. BUS/ENV sin contenido no se migran ni adquieren defaults. No mantener lectores legacy separados ni converters automáticos.

CAT-001 y documentación de entrega mantienen su evidencia histórica con nota de migración. Las demostraciones APP anteriores conservan lógica/barrera/cierre/restauración de prueba; cambian solo los datos/contratos afectados.

## Evidencia de aceptación

Paquete v2 y configuración canónica válidos; campo viejo, v1, combinación de versiones y CD inválido rechazados; fixtures nuevas inicializadas por mensajes; replay viejo rechazado; replay nuevo equivalente; paneles de Catálogo y Ciclo de aplicación operativos. Preservar pruebas de energía, slots, recursos, presupuestos, inmutabilidad y ausencia de I/O.

Migración ejecutada y verificada con las pruebas y recorridos de la entrega NAV-001. El plan enumera archivos y verificaciones permitidas; nunca ejecutar builds.
