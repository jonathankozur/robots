# Colaboración, agentes e integración

Las restricciones obligatorias están en [AGENTS.md](../../AGENTS.md). Este documento explica cómo aplicarlas sin depender del proveedor del agente.

## Estado del repositorio

El repositorio [jonathankozur/robots](https://github.com/jonathankozur/robots) es público; `main` es la rama base. La configuración vigente requiere PR, una aprobación, aprobación de una persona distinta de quien hizo el último push, descarta revisiones obsoletas y exige resolver conversaciones. Estas reglas también se aplican a administradores. No permite force push ni borrar `main`; requiere historial lineal. GitHub permite squash y rebase, y borra ramas de trabajo después de integrarlas.

La configuración se verificó por API en el repositorio. Aún no se demostró intentando integrar un PR sin aprobación. No hay workflows ni checks configurados, así que GitHub todavía no puede exigir verificaciones automáticas. Al menos otra persona con permiso de escritura debe incorporarse para poder aprobar los PR de la cuenta propietaria. La invitación y la verificación conductual quedan pendientes.

## Roles y autoridad

| Rol | Responsabilidad | Autoridad |
| --- | --- | --- |
| Responsable humano | Define objetivo y criterios, aprueba plan y ampliaciones | Autoriza el alcance de ejecución. |
| Planificador | Analiza la tarea, contratos, riesgos y pruebas | Propone; no convierte su plan en aprobación. |
| Especialista de contratos | Analiza bus, scheduler, productores y consumidores | Propone compatibilidad o migración; no la aprueba por sí mismo. |
| Implementador de sistema | Ejecuta el plan aprobado en su alcance | Modifica los archivos autorizados y reporta evidencias. |
| Verificador | Contrasta especificación, aislamiento y resultados | Informa aprobado/fallido/no verificado, con evidencia. |
| Revisor de integración | Revisa diff, dependencias y base actual | Recomienda; no sustituye revisión humana. |
| Otro desarrollador humano | Revisa el PR y sus cambios relevantes posteriores | Aprueba o solicita cambios antes de integrar. |

Un agente puede ejercer varios roles en momentos distintos. Cambiar de rol no amplía sus permisos. No crear un agente o skill duplicados por proveedor o por cada sistema: el encargo aporta el sistema concreto y los roles usan las mismas reglas compartidas.

## Secuencia de una intervención

1. El humano autoriza una tarea y se completa su [encargo](templates.md#ficha-de-encargo). El encargo indica sistema, responsable y alcance editable; no basta un título.
2. Comprobar que la tarea no está siendo implementada por otra persona y reservar el alcance mediante el mecanismo compartido acordado para esa tarea. Trello o el tracker reflejan la asignación cuando el humano autorice su uso.
3. Preparar un [plan breve](templates.md#plan-breve), identificar contratos y presentar las pruebas. Si faltan decisiones relevantes, formular la pregunta y esperar.
4. El humano aprueba el plan o pide ajustes. Guardar una referencia verificable a esa aprobación. No inventar aprobaciones ni inferirlas del estado de una tarjeta.
5. Ejecutar en una rama y checkout separados. No crear tareas, PR o comunicaciones remotas salvo autorización explícita de esas acciones.
6. Aplicar TDD a la lógica nueva y realizar las verificaciones pertinentes que no incumplan la prohibición de builds. Registrar cualquier comprobación impedida.
7. Entregar el diff y [reporte](templates.md#reporte-de-entrega). Para preparar integración, revisar la referencia base actual y las modificaciones compartidas recientes.
8. Si está autorizada la apertura de PR, otro desarrollador humano revisa. La aprobación debe corresponder al diff actual; un cambio relevante posterior requiere revisión renovada.
9. La integración requiere evidencia de verificaciones exigibles, revisión humana y autorización de la acción de merge. El agente no se integra su propio trabajo por iniciativa propia.

Durante esta entrega inicial no existe repositorio Git ni asignación remota. Las fichas son formatos reutilizables; no son tareas creadas ni un registro ficticio de responsables.

## Aislamiento de trabajo paralelo

Cada tarea tiene rama, checkout y lista explícita de archivos o rutas editables. No reutilizar el checkout de una intervención activa ni escribir en archivos de otra tarea. Las lecturas de contratos, consumidores y pruebas para analizar impacto sí están permitidas.

Antes de iniciar dos tareas simultáneas, comprobar disjunción de sus alcances editables y compatibilidad de sus contratos. Tener ramas distintas no resuelve una modificación incompatible del mismo contrato. Si surge un solapamiento, coordinar un plan revisado antes de editar ese alcance.

El registro de encargo debe permitir saber quién está trabajando y sobre qué revisión. Un trabajo interrumpido conserva su estado y evidencias para traspaso; un agente nuevo verifica referencias antes de continuar.

## Cambios de contratos y migraciones

El nombre, versión, contenido, semántica, fases, orden y política de fallos de un mensaje son parte del contrato. Cambiar cualquiera de esos aspectos puede afectar consumidores aunque el payload conserve la misma forma.

Todo cambio compartido necesita una propuesta que identifique:

- Productores, consumidores y pruebas afectados, incluido cualquier adaptador externo.
- Diferencias observables entre contrato actual y propuesto.
- Compatibilidad y riesgos de orden, determinismo, estado y guardados.
- Estrategia de integración y retirada del contrato anterior, si corresponde.
- Aprobación del plan y posterior revisión humana cruzada del diff.

Un cambio compatible puede integrarse primero si mantiene válidos los consumidores actuales. No agregar campos obligatorios ni modificar significado o fase bajo el supuesto de que es solo una ampliación de datos.

Un cambio incompatible usa un plan de migración explícito. Las tareas de consumidores pueden avanzar en ramas/checkouts propios y reunirse en una rama de integración coordinada. El PR final a la base incluye el contrato y todos los consumidores necesarios, verificados juntos. No dejar la base con consumidores incompatibles entre merges.

Una migración autoriza al integrador a reunir los cambios indicados, no al implementador de un sistema a modificar libremente otros sistemas. Si se elige convivencia temporal de versiones, esa compatibilidad debe estar especificada y probada; no hay fallback implícito.

## Política de GitHub público

Cuando se cree o conecte el repositorio y se identifiquen colaboradores con permisos adecuados, configurar y comprobar:

- Rama base protegida: PR obligatorio, al menos una aprobación humana de otra persona y aprobación del último cambio revisable por alguien distinto de quien lo publicó.
- Invalidación de aprobaciones obsoletas, conversaciones resueltas y verificaciones obligatorias con nombres inequívocos.
- Rama actualizada respecto de la base antes de integrar para verificar los cambios en su contexto real.
- Restricciones aplicadas también a administradores y roles con permiso de bypass; sin force push ni eliminación de la rama base.
- Responsables de revisión para contratos, scheduler, instrucciones, skills, workflows y el propio archivo `CODEOWNERS`. Las identidades se registran al incorporar colaboradores; no escribir usuarios ficticios.
- Las aprobaciones de agentes no cuentan como la revisión humana exigida. Las credenciales de automatización no reciben una vía de bypass de la política.

`CODEOWNERS` solicita y puede exigir revisión de propietarios cuando se configura la protección correspondiente; no garantiza por sí solo dos aprobaciones ni protege una rama sin esas reglas. [Documentación de propietarios](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

Las protecciones están disponibles para repositorios públicos con GitHub Free. La configuración debe demostrarse en el repositorio real, no darse por aplicada por escribir este documento. [Protecciones de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Todavía no existen workflows ni controles ejecutables. Tras elegir tecnología, deberán comprobar al menos dependencias permitidas, validez de contratos, alcance del diff, coherencia de adaptadores y pruebas relevantes. Cualquier revisión de su configuración conserva la aprobación humana; no se elimina un control para hacer pasar el PR que detectó.

## Descubrimiento y conservación del contexto

`AGENTS.md` es la fuente común. Codex lo descubre directamente. Los archivos de entrada de Claude y Gemini importan esas instrucciones. Codex y Gemini descubren `.agents/skills`; Claude descubre `.claude/skills`, cuyas entradas obligan a leer el procedimiento canónico completo.

Verificar la carga en una sesión nueva y cuando cambie la herramienta. Si una entrada o referencia no puede leerse, comunicar el impedimento antes de ejecutar. Un nombre de modelo no indica qué archivos cargó su harness.

- [Instrucciones de Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md) y [skills](https://learn.chatgpt.com/docs/build-skills).
- [Memoria e imports de Claude Code](https://code.claude.com/docs/en/memory) y [skills](https://code.claude.com/docs/en/skills).
- [Contexto de Gemini CLI](https://geminicli.com/docs/cli/gemini-md/) y [skills](https://geminicli.com/docs/cli/using-agent-skills/).

La compatibilidad real se comprueba con las versiones utilizadas por los desarrolladores. Mantener las reglas compactas y abrir solo las referencias que correspondan a la tarea. La memoria externa ayuda a recuperar contexto; los contratos y las aprobaciones provienen de las fuentes compartidas del proyecto.
