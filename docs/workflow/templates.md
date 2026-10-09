# Fichas reutilizables

Estas fichas son formatos de documentación, no tareas existentes. Completar los campos relevantes con datos reales. Un campo indispensable pendiente impide habilitar la ejecución; un campo no aplicable debe indicarlo y explicar por qué.

## Ficha de encargo

| Campo | Contenido obligatorio |
| --- | --- |
| Identificador | Referencia única del encargo autorizado; no crear un issue para obtenerla sin autorización. |
| Responsable humano | Persona que autoriza objetivo y alcance. |
| Ejecutor y estado de reserva | Persona/agente que trabaja y estado pendiente, reservado, activo, interrumpido o entregado. |
| Sistema | Identificador estable del sistema o infraestructura compartida autorizada. |
| Referencia base | Rama y commit de partida cuando exista Git; revisión documental en bootstrap. |
| Contratos | Nombres y versiones exactas; indicar si cambian o solo se consumen. |
| Objetivo | Conducta observable y problema que se resuelve. |
| Alcance editable | Archivos/rutas incluidos, exclusiones y motivo de cualquier alcance compartido. |
| Criterios de aceptación | Resultados verificables, incluido aislamiento y fallos relevantes. |
| Plan aprobado | Referencia al plan y a la aprobación humana de su revisión actual. |
| Entorno | Checkout propio, rama, herramientas disponibles y verificaciones permitidas. |
| Dependencias de trabajo | Cambios previos necesarios y compatibilidad de la base de contratos. |

## Plan breve

1. Objetivo y sistema responsable.
2. Estado actual comprobado y referencias utilizadas.
3. Archivos/rutas que se modificarán; estado propio y mensajes afectados.
4. Conducta propuesta, rechazo y fallo; efecto sobre otros consumidores o confirmación de que el contrato se conserva.
5. Pruebas significativas y verificaciones permitidas, incluidos los impedimentos por falta de motor o prohibición de builds.
6. Riesgos y estrategia de compatibilidad/integración.
7. Aprobación humana: referencia y revisión del plan aprobada. Hasta recibirla, el plan conserva el estado propuesto.

Un cambio relevante de esos puntos invalida la autorización para el alcance nuevo. No requiere renovar la aprobación para acciones necesarias ya incluidas en el plan aceptado.

## Ficha de sistema

| Campo | Contenido |
| --- | --- |
| Identificador y revisión | Nombre estable, versión de la ficha y estado propuesto/aprobado. |
| Responsabilidad | Resultado que garantiza y límites de su autoridad. |
| Estado propio | Datos que modifica exclusivamente y forma de inicialización. |
| Entradas | Contratos/versiones y fase de recepción por mensaje. |
| Vistas recibidas | Campos que conserva; origen, actualización, revisión/tick, invalidez y conducta sin datos. |
| Salidas | Contratos/versiones, datos necesarios para consumidores y fases de emisión. |
| Loop | Fase del loop, orden estable y comportamiento por tick. |
| Dependencias | Contratos públicos y utilidades puras permitidos; imports restringidos al implementar. |
| Ciclo de vida | Registro, inicio, cierre y aislamiento entre sesiones. |
| Fallos | Rechazos de negocio y fallos que invalidan la sesión. |
| Persistencia | Parte del checkpoint, versión y captura/restauración, o motivo de no aplicación. |
| Pruebas | Entradas, estado/salidas esperadas y escenarios de aislamiento. |

## Ficha de mensaje

| Campo | Contenido |
| --- | --- |
| Nombre y versión | Identidad pública y versión exacta. |
| Clase | Comando o evento. |
| Significado | Qué solicita o qué hecho informa; no solo la forma del payload. |
| Productores | Identificadores autorizados y fases de emisión. |
| Responsable/consumidores | Único responsable del comando o lista de consumidores del evento, con fase de recepción por consumidor. |
| Payload | Valores, identificadores, unidades, campos requeridos y restricciones. |
| Vigencia | Tick/revisión representados y tratamiento de datos ausentes o desactualizados. |
| Causalidad | Correlación y mensajes causantes de resultados posteriores. |
| Resultados | Eventos/resultados esperados, rechazos normales y motivos tipados. |
| Compatibilidad | Diferencia frente a versión anterior y consumidores afectados. |
| Ejemplos | Casos admitidos y rechazados, con tick/fase de entrega esperados. |
| Evidencia de aceptación | Referencias a escenarios y, cuando existan, pruebas ejecutadas. |

## Reporte de entrega

- Encargo, plan aprobado, sistema, referencia base y revisión de contratos.
- Estado: entregado para revisión, bloqueado, fallido o parcialmente completado; no confundir entrega con integración.
- Archivos modificados y conducta resultante.
- Contratos afectados y compatibilidad comprobada.
- Verificaciones realizadas: comando o procedimiento, entorno y resultado real.
- Verificaciones no realizadas y motivo; no marcar como aprobada una comprobación pendiente.
- Riesgos, decisiones abiertas y recuperación o reversión cuando corresponda.
- Revisión humana e integración: pendiente o referencia verificable si ocurrieron.
- Contexto para continuar: trabajo restante, aprobaciones necesarias y fuentes compartidas.

Para una entrega documental, revisar enlaces, coherencia entre documentos y campos de skills. Para código futuro, sumar evidencias conductuales, pruebas de contratos y aislamiento. Un reporte por sí solo no configura controles de GitHub.
