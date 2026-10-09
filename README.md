# Robots: base de arquitectura y trabajo con agentes

El proyecto está en diseño. El [GDD preliminar](diseno_autobattler_robots.md) conserva su contenido original y distingue conceptos, propuestas y decisiones abiertas.

Esta entrega contiene documentación y skills. La rama pública `main` requiere PR y revisión; ver la [configuración actual y los pendientes](docs/workflow/collaboration.md#estado-del-repositorio). Todavía no hay motor, código del juego, bus implementado ni pruebas ejecutables. Los checks automáticos de PR quedan pendientes hasta elegir tecnología e implementar workflows.

## Para empezar

1. Leer [AGENTS.md](AGENTS.md): reglas comunes para humanos y agentes.
2. Consultar [decisiones y requisitos pendientes](docs/decisions.md).
3. Leer la especificación del [bus y scheduler v1](docs/architecture/messaging-v1.md) y el [mapa de sistemas](docs/architecture/systems.md).
4. Usar el [protocolo de colaboración](docs/workflow/collaboration.md) y las [fichas de trabajo](docs/workflow/templates.md) cuando se autorice una tarea.

## Documentación

| Documento | Propósito |
| --- | --- |
| [Sistemas](docs/architecture/systems.md) | Responsabilidades, propiedad del estado y aislamiento. |
| [Mensajería v1](docs/architecture/messaging-v1.md) | Comandos, eventos, fases, entrega, determinismo y fallos. |
| [Límites externos](docs/architecture/external-boundaries.md) | Checkpoints, persistencia y futuro puente de red. |
| [Colaboración](docs/workflow/collaboration.md) | Roles, aprobación, trabajo paralelo, contratos e integración. |
| [Fichas](docs/workflow/templates.md) | Encargo, plan, sistema, mensaje y reporte de entrega. |
| [Aceptación](docs/workflow/acceptance.md) | Escenarios para revisar el protocolo y convertirlo después en pruebas. |

## Herramientas de agentes

- Codex: instrucciones en `AGENTS.md` y skills canónicas en `.agents/skills`.
- Gemini CLI: `GEMINI.md` importa las mismas instrucciones; descubre `.agents/skills`.
- Claude Code: `CLAUDE.md` importa las mismas instrucciones; las entradas en `.claude/skills` remiten a las skills canónicas.
- Otras herramientas: entregar `AGENTS.md`, la skill aplicable y sus referencias como contexto explícito. El nombre del modelo no garantiza que su herramienta descubra estos archivos.

Las entradas de Claude son archivos normales, sin enlaces simbólicos ni copias del procedimiento. Las rutas de las skills se resuelven respecto del archivo que contiene el enlace. Antes de usar una herramienta, comprobar qué instrucciones y skills cargó.

El diseño de mensajería tiene revisión documental v1.0.0, pendiente de aprobación técnica específica y pruebas ejecutables antes de desarrollar sistemas del juego. La aprobación de esta entrega documental no implica que la arquitectura ya esté validada en ejecución.
