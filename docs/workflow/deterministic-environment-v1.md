# ENV-001 — Entorno determinista de simulación

Fecha: 13 de octubre de 2026. Responsable humano: usuario solicitante. Estado: entregado localmente para revisión; integración pendiente. Reserva de implementación finalizada.

Plan: [tarjeta 01](https://trello.com/c/4pYHaLi7). Aprobación de decisiones y preparación: «me parece bien la recomendacion sobre las decisiones, documentalas en la tarjeta, pasala a Listo para desarrollar y arma un plan de implementacion». Aprobación de ejecución, incluidos contratos y laboratorio: «implementalo. Recorda que tenes que crear un nuevo branch antes de tocar codigo».

Base comprobada local/remota: `main`, `050f831aa2fbce0e00992208232bd718b138a3a2`. Rama nueva: `codex/deterministic-environment-v1`. Checkout propio: `C:/Users/Jonat/.codex/worktrees/deterministic-environment-v1/robots`. No se modifica el checkout inicial ni la extracción `event-bus`.

Reserva: `src/core/determinism/**`, exports públicos, datos de contratos y configuración de Session; suites/fixtures bajo `tests/core/**`, integración focalizada `tests/browser/**` y `tests/harness/**`; documentación de decisiones, API, mensajería y aceptación. No hay gameplay, dependencias nuevas, CI, persistencia, motor, builds ni acciones de integración GitHub en este encargo.

Plan aprobado: (1) documentar entorno/compatibilidad; (2) tiempo y aritmética con TDD; (3) RNG y vectores independientes con TDD; (4) entorno opcional/manifiesto con TDD; (5) fixture compartida y panel manual; (6) regresión, comprobación de tipos sin emisión, Chrome, reporte y revisión del diff.

Compatibilidad: SessionOptions.environment es opcional; no inferir defaults para sesiones antiguas. ReplayRecording permanece en v1 y mantiene comparación estricta de manifiesto/runtime. Se comprueba equivalencia lógica Node/Chrome sin prometer importación de grabaciones entre runtimes distintos. No se cambian fases, puertos ni reglas de entrega. Cada sistema conserva su propio estado RNG; el entorno y los helpers son datos inmutables/funciones puras.

Verificaciones permitidas: `npm test`, `npm run typecheck`, servidor Vite de desarrollo y navegador. Pruebas nativas Node; no hay scripts de build.

## Entrega y revisión técnica

Se implementó el [contrato ENV-001 v1](../architecture/deterministic-environment-v1.md), la ampliación opcional de SessionOptions/manifiesto (API documental 1.2), utilidades puras de tiempo/cálculo/RNG, una fixture Alpha/Beta/Observador con mensajes y panel manual independiente. Publisher, siete fases, orden de ejecución, pausas, ReplayRecording v1 y validación estricta de runtime se conservan. Las fixtures anteriores no reciben defaults de entorno.

Archivos: src/core/determinism/{numeric,rng,environment}.ts; datos públicos en messaging/contracts.ts, configuración en scheduler/session.ts y exports index.ts. Suites determinism-*.test.ts y environment-fixture.test.ts; fixture, exportador Node y vectores/oráculo Python bajo tests/core. Panel environment-panel.ts, integración lab.ts/lab.css y guía bajo tests/browser. Especificación, decisiones, API, mensajería y aceptación actualizadas. Sin cambios a package.json/lockfile, controles de arquitectura ni otros sistemas.

### Evidencia ejecutada

- Dependencias existentes instaladas con `npm ci --ignore-scripts`: sin scripts de instalación ni nuevas dependencias.
- TDD: las 4 pruebas numéricas, 6 RNG, 4 conductas de configuración/compatibilidad y 4 de fixture fallaron primero por comportamiento pendiente. La suite de entorno pasó luego parcialmente y evidenció 3 fallos reales de integración de Session antes de añadir el manifiesto. Se implementó y refactorizó hasta verde. Los controles previos se conservaron.
- `npm test`: **91/91 aprobadas**, Node **24.14.0**. Incluye regresión, arquitectura, privacidad de Publisher, replay, casos numéricos contra BigInt, semillas Unicode, muestreo por rechazo, límites, snapshots y aislamiento.
- `npm run typecheck`: aprobado, TypeScript **5.9.3**, `tsc --noEmit`. `git diff --check`: aprobado.
- Oráculo: `python tests/core/reference-vectors.py`, Python **3.12.10**; vectores generados independientemente del código TypeScript. Node y Chrome verificaron **5 vectores / 48 extracciones**, incluidos límites uint32 y derivación Unicode.
- `node tests/core/export-environment-reference.ts`: referencia Node real escrita en debug-logs. Cargada por el panel en **Chrome 153.0.8010.54**; seis ticks con semilla 0123456789abcdef y 0 sorteos extra producen estados, cálculos, configuración y traza lógica iguales. Alpha: 8322, 4625, 6261, 2887, 1851, 6097; total Beta: **40847**. Metadatos reales de runtime separados.
- Chrome con Playwright: pausa por paso sin cambios durante espera; ejecución automática interrumpida y estable; repetición mezclando paso/fase/tick; reinicio confirma registro closed en JSONL anterior; fallo HTTP 503 controlado detiene avance, conserva pendientes y permite reintento con secuencias contiguas sin duplicados.
- Regresión de UI anterior: replay y segunda sesión aprobados; esos controles no modifican la fixture de entorno retenida. Capturas revisadas en 1440×1000 y 390×844. Se corrigió el desbordamiento horizontal de la cuarta pestaña. Sin errores inesperados de consola; el 503 fue deliberado en la prueba de fallo.
- Base remota reconsultada: main continúa en 050f831, sin cambios concurrentes detectados en la base. Diff revisado dentro de alcance; datos públicos siguen sin imports, helpers sin capacidades externas y consumidores sin migración pendiente.

Capturas locales no versionadas: output/playwright/environment-final-desktop.png y environment-final-mobile.png. Logs y referencia Node también son artefactos locales ignorados; la evidencia normativa reproducible es el código, suites, vectores y procedimientos de esta ficha/guía.

### Límites, recuperación y continuación

No se ejecutaron builds. No hay gameplay, pruebas de rendimiento real, persistencia/checkpoints, Electron ni otros navegadores. La detección de colisión entre estados derivados está revisada en código; no se fabricó una colisión real del hash para ejecutar esa rama. Determinismo de esta fixture/primitivas no acredita un juego completo ni importación de replay entre runtimes.

Un fallo numérico no resuelto invalida el callback/sesión; helpers no revierten mutaciones previas de negocio. Debug requiere drenaje externo, consume memoria pendiente y cerrar navegador no confirma escrituras. El entorno opcional existe por compatibilidad: nuevos consumidores deben declararlo explícitamente.

Revisión humana e integración GitHub pendientes. La entrega queda en la rama propia; no se crea PR, hace push ni merge en este encargo. Una reversión debe retirar conjuntamente entorno y consumidores nuevos, conservando legacy sin conversiones silenciosas. Para continuar: revisar esta entrega y usar la guía de tests/browser/README.md; tramitar integración solo por solicitud humana.
