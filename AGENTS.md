# Protocolo común de Robots

Revisión: **1.0.0**. Estas reglas se aplican a cualquier agente y a cualquier proveedor. Las skills contienen procedimientos; este archivo contiene las restricciones que siempre deben cumplirse.

## Estado del proyecto

La entrega inicial comprende documentación y skills. Motor, lenguaje, aritmética de simulación, generador aleatorio, base de datos y modelo de multiplayer siguen pendientes. Consultar [decisiones](docs/decisions.md) antes de interpretar una propuesta del GDD como requisito aprobado.

No implementar sistemas del juego hasta cumplir la habilitación descrita en ese documento. No crear tareas, issues ni tarjetas de Trello sin una indicación explícita. La elaboración de un plan no habilita por sí sola su ejecución.

## Antes de trabajar

1. Leer estas reglas y cargar la skill correspondiente según la tabla inferior. Si no hay descubrimiento automático, abrir el `SKILL.md` canónico manualmente.
2. Identificar responsable humano, sistema, alcance editable, referencia base, contratos aplicables y criterios de aceptación en la [ficha de encargo](docs/workflow/templates.md).
3. Presentar un plan breve y esperar aprobación humana antes de implementar. Una instrucción explícita de implementar un plan ya aprobado cuenta como autorización; no volver a pedirla para ese alcance.
4. Para ejecución, usar una rama y un checkout propios. Si todavía no existe Git, detener la implementación del juego. La instalación documental inicial, autorizada antes de existir Git, es una excepción de bootstrap que no habilita tareas posteriores de desarrollo.
5. Leer las referencias específicas del sistema y del cambio. No exigir documentos ajenos al alcance ni depender de memoria privada para conocer las reglas.

## Límites de una intervención

- Editar exclusivamente los archivos autorizados. Se pueden leer contratos y consumidores de otros sistemas para analizar impacto.
- Si hacen falta otro sistema, nuevas dependencias o cambios al bus, scheduler o contratos compartidos, presentar el impacto y obtener aprobación del alcance revisado antes de efectuar esa parte.
- Al formular una pregunta que requiere respuesta, detener el trabajo y esperar. No asumir aprobación por silencio.
- No sobrescribir cambios de otra persona ni resolver un conflicto eligiendo unilateralmente qué trabajo conservar.
- No incluir modificaciones mecánicas globales ni correcciones ajenas al encargo.
- No efectuar merges, publicaciones, invitaciones, comunicaciones a otras personas ni cambios de configuración remota por iniciativa propia. Requieren autorización explícita para esa acción; toda integración necesita además revisión humana de otra persona.

## Arquitectura obligatoria

- Cada sistema modifica únicamente su propio estado. La comunicación entre sistemas se realiza mediante contratos de mensajes.
- No acceder a estado mutable ajeno, llamar a implementaciones de otros sistemas ni compartir sus instancias.
- Admitir únicamente contratos públicos y utilidades puras compartidas como dependencias. El ensamblado de la aplicación es infraestructura compartida, no una excepción para introducir llamadas entre sistemas.
- Conservar solo la información recibida que el sistema necesita, con reglas explícitas de actualización y vigencia.
- Respetar las fases, las colas y el orden estable definidos en [mensajería v1](docs/architecture/messaging-v1.md). Publicar un mensaje nunca ejecuta inmediatamente al receptor.
- Separar la simulación del ritmo visual, reloj del sistema y operaciones de red o base de datos. Ver [límites externos](docs/architecture/external-boundaries.md).
- No modificar reglas de integración, pruebas o diagnósticos para ocultar una violación del contrato.

## Calidad y evidencia

- Verificar afirmaciones técnicas en código, especificaciones o documentación primaria antes de presentarlas como hechos. Distinguir hechos, propuestas y pendientes.
- Aplicar TDD a lógica nueva cuando se habilite desarrollo: prueba significativa que falla por la conducta faltante, implementación mínima y refactor con pruebas aprobadas. La documentación no requiere pruebas artificiales que comparen su redacción.
- **Nunca ejecutar builds después de cambios.** No invocar indirectamente un build mediante otro comando. Si una verificación necesaria exige compilar, explicar el impedimento y obtener una excepción explícita antes de ejecutarla.
- Ejecutar solo verificaciones pertinentes y permitidas. No marcar como aprobadas pruebas que no se ejecutaron.
- Usar commits convencionales. No añadir `Co-Authored-By` ni atribución de IA a los commits.
- Reportar alcance modificado, contratos afectados, verificaciones y sus resultados, limitaciones y trabajo pendiente con la [ficha de entrega](docs/workflow/templates.md).

## Trabajo paralelo y revisión

Toda tarea debe tener un responsable humano, un sistema y un alcance reservado. Ramas y checkouts separados no sustituyen esa coordinación. No iniciar dos implementaciones con archivos editables superpuestos sin un nuevo plan aprobado.

Los cambios de contratos compartidos requieren análisis de todos sus productores y consumidores, plan de compatibilidad o migración y revisión humana cruzada. Todos los PR requieren aprobación de otro desarrollador; la revisión propia o de otro agente es evidencia adicional.

La integración debe revisar la base actual, no únicamente la base desde la que comenzó la tarea. Seguir [colaboración](docs/workflow/collaboration.md). Las protecciones y verificaciones automáticas se consideran pendientes hasta comprobar su configuración y funcionamiento real.

## Fuente común y recuperación de contexto

Estas reglas, los contratos, los planes aprobados y las decisiones del proyecto se conservan en archivos compartidos y, cuando exista Git, se versionan junto al código. Trello organiza conversación y trabajo; no reemplaza la versión aprobada de un contrato.

Cumplir los protocolos de memoria disponibles en la sesión, incluido Engram cuando esté accesible. La memoria personal o de un proveedor no aprueba cambios ni sustituye documentación compartida. Si una herramienta de memoria no está disponible, declararlo y no afirmar que se guardó información allí.

Tras cambiar de herramienta, agente o contexto, recuperar el encargo, la aprobación, la referencia base y los contratos desde sus fuentes explícitas. Si falta una aprobación indispensable o hay instrucciones incompatibles, informar el bloqueo y esperar resolución humana.

## Skills canónicas

| Contexto | Skill y referencia |
| --- | --- |
| Preparar el plan de un cambio | [robots-plan-change](.agents/skills/robots-plan-change/SKILL.md) |
| Evolucionar bus, scheduler o contratos públicos | [robots-evolve-contract](.agents/skills/robots-evolve-contract/SKILL.md) |
| Implementar lógica en un sistema con plan aprobado | [robots-implement-system](.agents/skills/robots-implement-system/SKILL.md) |
| Verificar un cambio frente a su especificación | [robots-verify-change](.agents/skills/robots-verify-change/SKILL.md) |
| Preparar o revisar la integración de un cambio | [robots-review-integration](.agents/skills/robots-review-integration/SKILL.md) |

Si el cambio combina contextos, aplicar las skills pertinentes sin duplicar ni modificar sus reglas. Este protocolo no concede permiso para crear tareas, PR o recursos remotos cuando esa acción no fue autorizada.
