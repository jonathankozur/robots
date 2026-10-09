---
name: robots-evolve-contract
description: Analizar y proponer cambios en mensajes, bus, scheduler o contratos públicos de Robots. Usar antes de editar interfaces compartidas, fases, orden, versiones o semántica que afecte a otros sistemas.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# Evolucionar contratos

## Referencias

Leer [AGENTS.md](../../../AGENTS.md), [mensajería v1](../../../docs/architecture/messaging-v1.md), [sistemas](../../../docs/architecture/systems.md) y [colaboración](../../../docs/workflow/collaboration.md). Utilizar la [ficha de mensaje](../../../docs/workflow/templates.md#ficha-de-mensaje) y los [escenarios de aceptación](../../../docs/workflow/acceptance.md).

## Procedimiento

1. Identificar la versión vigente y la necesidad concreta. Examinar productores, consumidores, ensamblado y adaptadores afectados; incluir consumidores en desarrollo declarados por el equipo. No asumir que un campo nuevo es compatible por ser opcional.
2. Describir el contrato propuesto: comando o evento, propietario, productores autorizados, consumidores, valores inmutables, versión, fases de emisión y recepción, vigencia, rechazo, errores y relación causal.
3. Evaluar compatibilidad de estructura Y comportamiento: orden, entrega, fases, interpretación de valores, invariantes, determinismo y checkpoints. Revisar red y persistencia como contratos independientes, sin exponer automáticamente eventos internos.
4. Presentar impacto por sistema, alternativas y verificaciones necesarias. Un cambio compatible puede integrarse primero; uno incompatible requiere migración y una integración coordinada donde todos los consumidores afectados sigan siendo válidos.
5. Obtener aprobación humana del contrato y del alcance revisado antes de editar esa parte. Reservar los archivos compartidos y declarar responsable de integración. No ampliar unilateralmente una intervención de sistema.
6. Tras autorización, actualizar contrato, fichas y referencias afectadas dentro del alcance asignado. La implementación tecnológica solo procede cuando se cumplan sus requisitos de habilitación.

## Comandos de consulta

Ejemplo de búsqueda desde el checkout para localizar las referencias de la cadena de combate; adaptar los nombres al contrato que se analiza y examinar cada resultado:

```sh
rg -n "RobotMovido|ObservacionDisponible|SolicitarAtaque|AtaqueResuelto" .
```

## Resultado y detención

Entregar propuesta o cambio aprobado, matriz de productores y consumidores, compatibilidad, migración, criterios y aprobaciones. Detener la parte dependiente si falta autorización, hay alcances superpuestos o un consumidor queda sin estrategia. Al preguntar, detener todo el trabajo y esperar respuesta. Nunca introducir compatibilidad silenciosa para ocultar una ruptura.
