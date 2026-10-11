# Robots: base de arquitectura y trabajo con agentes

El proyecto está en diseño. El [GDD preliminar](diseno_autobattler_robots.md) conserva su contenido original y distingue conceptos, propuestas y decisiones abiertas.

Esta entrega incorpora el núcleo ejecutable de mensajería y scheduler, con pruebas de contratos, aislamiento y replay. La tecnología aprobada es TypeScript con Three.js para presentación 3D y Electron para escritorio; esas integraciones y el gameplay siguen pendientes. La rama pública `main` requiere PR y revisión; ver la [configuración actual y los pendientes](docs/workflow/collaboration.md#estado-del-repositorio). Los checks automáticos de PR aún requieren workflows propios.

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
| [API del núcleo](docs/architecture/core-api-v1.md) | Configuración, puertos, límites, errores y reproducción. |
| [Entrega BUS-001](docs/workflow/bus-scheduler-implementation.md) | Autorización, alcance, evidencia TDD y pendientes de integración. |

## Ejecutar las verificaciones

En Node.js 24.12 o posterior de la línea 24:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
```

Las pruebas ejecutan TypeScript con tipos borrables mediante Node; la comprobación de tipos usa tsc --noEmit. Ninguno de estos comandos genera un build. No hay dependencias runtime ni script de build. La evaluación de BUS-001 se ejecutó en Node.js 24.14.0 con TypeScript 5.9.3.

El ensamblador importa [src/core/index.ts](src/core/index.ts). Cada sistema recibe únicamente su Publisher y datos inmutables. El ensamblador conserva Session, registra handlers y controla los ticks. Ver [un ejemplo probado](tests/core/replay.test.ts).

### Harness de navegador del núcleo

El [laboratorio independiente](tests/browser/README.md) carga el bus real con fixtures editables. Ejecuta npm run browser:harness y abre http://127.0.0.1:5173. Permite configurar escenarios, preparar entradas y pausar realmente entre operaciones, fases o ticks, inspeccionar colas/causas, reproducir/comparar y exportar evidencia. El modo debug escribe cada mensaje admitido y su recorrido en debug-logs/*.jsonl. Detén el servidor con Ctrl+C.

El comando inicia Vite en desarrollo para servir y transformar módulos TypeScript en el navegador; no ejecuta vite build ni crea artefactos de producción.

## Herramientas de agentes

- Codex: instrucciones en `AGENTS.md` y skills canónicas en `.agents/skills`.
- Gemini CLI: `GEMINI.md` importa las mismas instrucciones; descubre `.agents/skills`.
- Claude Code: `CLAUDE.md` importa las mismas instrucciones; las entradas en `.claude/skills` remiten a las skills canónicas.
- Otras herramientas: entregar `AGENTS.md`, la skill aplicable y sus referencias como contexto explícito. El nombre del modelo no garantiza que su herramienta descubra estos archivos.

Las entradas de Claude son archivos normales, sin enlaces simbólicos ni copias del procedimiento. Las rutas de las skills se resuelven respecto del archivo que contiene el enlace. Antes de usar una herramienta, comprobar qué instrucciones y skills cargó.

Mensajería v1 mantiene sus fases y reglas de entrega. BUS-001 y BUS-002 tienen autorización específica y evidencia con sistemas ficticios en Node y Chrome. La integración por PR sigue el flujo liviano documentado en [decisiones](docs/decisions.md); las pruebas con fixtures no habilitan por sí solas gameplay ni el entorno determinista de combate.
