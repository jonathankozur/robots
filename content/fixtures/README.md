# Paquete mínimo CAT-001

basic-v1.json es una colección de demostración, no contenido balanceado del juego. Incluye un chasis, núcleo, locomoción, IA, sensor y arma; dos terrenos y dos configuraciones (armada/desarmada). Las etiquetas de rareza/tecnología son vocabularios de prueba. Los recursos solo describen IDs y sockets: no existen modelos 3D asociados.

Contrato, campos y unidades: [catálogo v1](../../docs/architecture/content-catalog-v1.md). API: src/content/index.ts. Lectura de archivos fuera de la simulación; el parser recibe texto y devuelve content o issues, nunca ambos.

## Ejemplos inválidos reproducibles

Modificar una copia de basic-v1.json; conservar el original. Los casos se ejecutan automáticamente en las suites content-*.test.ts.

| Modificación | Resultado esperado |
| --- | --- |
| Repetir una ficha de arma con el mismo id | CONTENT_DUPLICATE_ID. |
| Cambiar rarityId a rarity.inexistente | CONTENT_REFERENCE, con ruta de la ficha. |
| Agregar formula al arma | CONTENT_UNKNOWN_FIELD; no hay intérprete de expresiones. |
| Cambiar impactUnits a 1.00000000000000001 en texto JSON | CONTENT_NUMBER_LITERAL, aunque JSON.parse lo redondee a 1. |
| Escribir dos claves schemaVersion en el mismo objeto, incluso con escapes Unicode | CONTENT_DUPLICATE_KEY. |
| Cambiar sizeId de weapon-a a size.large | CONTENT_INCOMPATIBLE; no se supone que pequeño encaja en grande. |
| Quitar sensor de equipment | CONTENT_REQUIRED_COMPONENT. |
| Bajar energyCapacityUnits de core.basic a 59000 | CONTENT_ENERGY; robot.scout requiere 60000 unidades. |
| Cambiar socketId a missing | CONTENT_SOCKET_REFERENCE. |
| Cambiar valores y conservar contentRevision | Validar el nuevo paquete puede ser válido; un replay del anterior se rechaza por manifiesto diferente. |

No se devuelve un catálogo parcial. Los diagnósticos exponen código, ruta y definición cuando se conoce. Un resourceId válido significa referencia declarada, no archivo/artwork verificado.

## Verificación local sin build

Desde el checkout de CAT-001:

    node --test tests/core/content-*.test.ts
    npm test
    npm run typecheck

La fixture de integración está en tests/core/content-fixture.ts. Recibe un paquete como datos, valida antes de construir Session y entrega dos vistas pequeñas por comandos diferidos. Necesita seleccionar un robot armado y un terreno existente para mostrar ambas vistas; la validez del catálogo permite robots desarmados. El laboratorio local incluye una pestaña CAT-001 para validar el JSON y ejecutar esa fixture manualmente; no es una pantalla del juego.

La sesión fija el contenido completo en initialState.content; cada consumidor recibe solo su vista. La prueba de replay reconstruye la fixture desde el snapshot registrado y compara traza/resultado sin inyectar entradas nuevas.
