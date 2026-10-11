# Encargo BUS-001: bus y scheduler v1

Fecha: 11 de octubre de 2026. Estado: **implementación entregada**. La revisión y la integración se tramitan por PR según COL-001.

- Responsable humano: usuario solicitante de la conversación vinculada a la [tarjeta de diseño](https://trello.com/c/oWqxinQ9).
- Aprobación: «ok, autorizado», después del plan de revisión 0.2 con TDD, pruebas Node.js y comprobación de tipos sin emisión. No autoriza PR, push ni merge.
- Sistema: infraestructura compartida de mensajería y scheduler.
- Base: beeeb7f7c610df546d03888e45a1dacba2266417. Rama codex/bus-scheduler-v1, checkout gestionado propio.
- Checkout: C:/Users/Jonat/.codex/worktrees/bus-scheduler-v1/robots. El checkout original C:/dev/robots permanece en su rama inicial; event-bus no se copia ni modifica.
- Base remota consultada al iniciar: origin/main en 7f566764141d9a2d9420fc41311d2d1fbdc9fb8a. Se obtuvo con fetch; la base local aprobada contiene cambios documentales posteriores. No se integró ni reemplazó ninguna base. Volver a revisar main al integrar.
- Alcance: src/core/, tests/core/, package.json, package-lock.json, tsconfig.json, .gitignore, README.md y documentación pertinente bajo docs/. La extracción event-bus/ del checkout original no se modifica.
- Contratos: mensajería v1, fixtures PruebaComando@1 y PruebaEvento@1; sin contratos de gameplay nuevos.
- Objetivo: catálogo, aislamiento, payloads inmutables, rutas acotadas, fases, corte externo, fallos/cierre, traza y replay verificables.
- Entorno: TypeScript estricto con sintaxis borrable; módulos ES; Node.js 24.14.0 para evaluación. node --test ejecuta tipos borrables sin generación de archivos; tsc --noEmit verifica tipos. Sin builds, lifecycle scripts ni dependencias runtime.
- Secuencia TDD: catálogo/datos/permisos → rutas/capacidad/IDs → fases/loops → entrada/fallos/cierre → traza/replay/controles → documentación y entrega.
- Verificación: criterios de revisión 0.2 con fixtures y resultados reales; revisar alcance y git diff --check. Revisor humano de integración pendiente.
- Exclusiones: Three.js, Electron, Vite y gameplay no se instalan en esta entrega. Frecuencia real, aritmética/RNG de combate, almacenamiento y multiplayer siguen pendientes.

## Evidencia de TDD y entrega

| Paso | RED observado | GREEN posterior |
| --- | --- | --- |
| Datos y catálogo | 7 fallos de 8 pruebas: faltaba copia/congelación, rechazo de datos y validación/registro. | 8 aprobadas. |
| Rutas, scheduler y permisos | 13 fallos de 13: avance y publicación todavía no implementados. | 21 aprobadas acumuladas. |
| Entrada y ciclo de vida | 4 pruebas de entrada fallaron por API ausente; 4 pruebas de fallos ya pasaban. Una fixture de baja usaba un ID no registrado y se corrigió antes de validar ese escenario. | 30 aprobadas acumuladas. |
| Traza y replay | 9 fallos de 9 por capacidades todavía ausentes. | 39 aprobadas acumuladas. |
| Casos de borde | 3 fallos conductuales: opción de esquema mal escrita admitida; exportación capturada no invalidaba; faltaba ID del adaptador en fallo externo. | 48 aprobadas acumuladas. |
| Controles e integración | Controles estáticos se probaron con fuentes prohibidas; replay malformado produjo TypeError en lugar del rechazo tipado. | 58 aprobadas acumuladas tras corregir validación de formato. |
| Profundidad compuesta | Payload de profundidad válida fallaba al copiar su esquema/envoltorio con el mismo límite. | 59 aprobadas: límite del payload separado del límite de metadatos. |

Verificaciones finales del código:

- npm test: **59 aprobadas, 0 fallidas, 0 omitidas**.
- npm run typecheck: **aprobada**, tsc --noEmit.
- Ejecución en Node.js 24.14.0 y npm 11.9.0; dependencias de desarrollo fijadas mediante package-lock.json.
- Arquitectura: imports exclusivamente locales en core, sin reloj/I/O/render/RNG; puerto de sistemas congelado y sin scheduler/registro/cierre.
- Determinismo: misma configuración/entradas con diferente orden incidental de registro y agrupación visual de ticks; mismos resultados y traza completa. Replay desde sistemas nuevos y entradas registradas.
- Capacidad: fixtures de 16 entregas, 8 entradas, 1024 bytes y 1000 registros; límites exactos/excesos y fan-out atómico comprobados. Ejecución sostenida de 100 ticks con capacidad 2 y traza 20. Son presupuestos de evaluación, no dimensionamiento de producción.
- Builds, publicación, PR, push y merge: **no ejecutados**. Three.js/Vite/Electron/DB/multiplayer: no instalados ni implementados.
- git diff --check: **aprobada**. Los 25 archivos modificados están dentro del alcance; enlaces locales comprobados en seis documentos modificados. No se generaron dist ni coverage.
- Checkout original comprobado al cerrar: conserva únicamente event-bus/ sin seguimiento, sin modificaciones a archivos versionados.
- [Tarjeta de Trello](https://trello.com/c/oWqxinQ9) actualizada con autorización, implementación y evidencia; se conserva su lista actual «🚧 En desarrollo».

## Reporte de entrega y continuidad

Código: src/core/index.ts; messaging/contracts.ts, immutable.ts, catalogue.ts, bus.ts y trace.ts; scheduler/session.ts. Pruebas: siete suites bajo tests/core/ y fixtures compartidas. Configuración mínima: package.json, lockfile, tsconfig.json y .gitignore.

Documentación: decisiones TEC-001/BUS-001, mensajería v1, API del núcleo, aceptación, README y esta ficha. La API nueva es propia del proyecto; no conserva compatibilidad con la extracción event-bus. No hay sistemas de gameplay existentes que migrar.

Riesgos/límites: copia/congelación sin benchmarks de producción; controles estáticos de arquitectura sin sandbox; callbacks mantienen responsabilidad sobre estado propio y efectos externos. El núcleo no revierte efectos iniciados por un callback asíncrono y no restaura sistemas desde checkpoints.

Integración: revisar implementación, contratos y base actual según COL-001; el mismo autor puede fusionar con autorización humana explícita, sin segundo aprobador. Gameplay requiere frecuencia, aritmética/RNG, fichas de mensajes y planes propios. Browser/Electron, CI obligatorio, rendimiento real y adaptadores externos necesitan verificaciones posteriores.

Reversión: si se rechaza antes de integrar, retirar los cambios de esta rama; si se requiere revertir después, hacerlo mediante un PR. Conservar BUS-001 y la extracción original.

### Ampliación autorizada: arnés web aislado

El 11 de octubre de 2026 el usuario autorizó preparar un arnés únicamente para desarrollo y prueba de sistemas, independiente del juego. Se añade tests/browser/, Vite como dependencia solo de desarrollo y el comando browser:harness. Carga el núcleo compartido con adaptadores y consumidores ficticios; no incluye gameplay, render ni escrituras externas. Vite se ejecuta como servidor de desarrollo, sin generar build de producción.

Engram no está disponible: se conserva aprobación, base, decisiones, descubrimientos y evidencia en documentos compartidos. No se afirma haber guardado memoria en ese servicio.

### Continuación BUS-002: laboratorio manual y control parcial

El usuario autorizó explícitamente pausa real, mejora de bus/scheduler, log debug en archivo y los diez grupos funcionales del arnés. [BUS-002](debug-harness-plan.md) conserva el alcance ampliado, la aprobación y la entrega. Sustituye el arnés de cinco comprobaciones por un laboratorio manual de escenarios, manteniendo los sistemas de prueba separados del juego.

La evidencia histórica anterior corresponde a BUS-001: el estado actual incluye Vite como herramienta de desarrollo, servidor local de JSONL y verificación de Chrome. El núcleo conserva ausencia de I/O/reloj/render y puertos mínimos. No se incorporaron Three.js, Electron ni gameplay.

Verificación actual: **72 pruebas aprobadas**, tsc --noEmit aprobado y flujos reales de navegador para pausa, replay, configuración, aislamiento y fallo/reintento de archivo. Se corrigió un defecto del editor encontrado en navegador: deshabilitar controles antes de capturar FormData omitía sus valores; ahora se captura el formulario antes de bloquearlo. En BUS-002 no se hicieron builds, PR, push, merge ni actualización remota. La integración posterior debe seguir COL-001 y revisar la base vigente.
