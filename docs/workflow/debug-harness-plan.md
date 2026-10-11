# BUS-002 — Ejecución controlada y laboratorio de escenarios

Estado: **implementado y entregado para revisión humana**. Desarrollo autorizado por el usuario el 11 de octubre de 2026: «sí voy a necesitar pausa real… implementa la mejora del bus y scheduler… modo debug… archivo log… luego implementa los 10 puntos del arnés».

Responsable humano: usuario solicitante. Checkout reservado: codex/bus-scheduler-v1, base beeeb7f7c610df546d03888e45a1dacba2266417, conservando BUS-001 pendiente de revisión humana. Alcance: src/core, tests/core, tests/browser, tests/harness, scripts, configuración npm/TypeScript y documentación relacionada. Sin sistemas de gameplay ni cambios remotos.

## Diseño aprobado por el alcance solicitado

- Un único cursor de ejecución sirve a step(), stepPhase() y advanceTick(). La pausa existe entre operaciones síncronas; nunca suspende instrucciones dentro de un callback. La bandeja se congela una sola vez por fase, todas sus entregas preceden a los loops y el orden permanece estable.
- La preparación, actividad, fallo y cierre conservan sus estados. Una sesión activa puede estar entre ticks o tener un tick parcial detenido. Las entradas ingresadas después del corte esperan al siguiente tick. No se exporta replay con tick parcial. Cerrar puede abortar un tick parcial, registra descartes y no confirma ese tick.
- La inspección devuelve datos inmutables de colas y cursor, sin callbacks ni instancias de sistemas. Los puertos de sistemas siguen limitados a send/emit.
- Debug es instrumentación opcional: un journal independiente de la traza acotada se drena entre operaciones del controlador. No contiene reloj real ni I/O. Un adaptador del servidor Vite escribe los registros secuenciales a debug-logs/*.jsonl; los errores de archivo se muestran y detienen la ejecución automática del arnés sin alterar resultados del núcleo.
- El arnés define escenarios mediante datos: sistemas, contratos, rutas, reglas de recepción/loop, entradas por tick y condiciones/acciones sobre estado propio de fixtures. Sin eval. Los casos especiales de JavaScript usan fixtures predefinidos.
- Interfaz: configuración estructurada más JSON, controles de unidad/fase/tick y pausa, entradas manuales, timeline de siete fases, colas, inspector de mensajes/causas/estado local, filtros de traza, catálogo de casos de fallo, replay/comparación, importación/exportación local y evidencia JSONL.

## Compatibilidad y evidencia

Los únicos consumidores actuales son fixtures y el arnés. advanceTick termina el tick actual si se llama desde una pausa parcial. Se añaden registros phase_started/phase_finished y maxTicks al manifiesto: grabaciones anteriores con manifiesto antiguo son rechazadas explícitamente, no migradas silenciosamente. Los métodos nuevos están en el controlador Session, nunca en Publisher.

Aplicar TDD a cursor, invariantes, inspección, journal, reglas declarativas y escritura de logs. Ejecutar node --test, tsc --noEmit y prueba real de navegador con pasos parciales, pausa, entradas tardías, replay, edición y archivo físico. No ejecutar builds. Revisar la base actual y obtener revisión humana antes de integrar.

Engram no está disponible en esta sesión. Las decisiones y evidencia se conservarán aquí y en contratos compartidos.

## Ficha de entrega

Núcleo: cursor común por unidades, fases y ticks; inspección inmutable, cierre parcial, maxTicks y journal debug opcional. Contratos compartidos actualizados en mensajería v1.2.0 y API v1.1.0. El modo debug no introduce dependencias de archivo en core. Las grabaciones previas con manifiesto sin maxTicks requieren recreación explícita.

Arnés: tests/browser/lab.ts y lab.css, escenarios declarativos en scenarios.ts, transporte debug-client.ts y adaptador de archivo log-server.ts. scripts/harness-server.ts ensambla el servidor Vite local. La [guía de uso](../../tests/browser/README.md) relaciona los diez grupos: escenarios/sistemas, contratos, rutas, reglas, entradas, ejecución, visualización, fallos/límites, replay/aislamiento y evidencia/persistencia local. Incluye 44 presets; uno recorre las 49 combinaciones de fases. package.json/tsconfig incluyen las suites y el servidor; logs y artefactos de navegador quedan ignorados.

### Verificaciones ejecutadas

- TDD: ocho pruebas nuevas de núcleo fallaron antes de implementar cursor y journal; pruebas declarativas fallaron antes de implementar sus reglas. Suite final: **72 aprobadas, 0 fallidas, 0 omitidas**, con Node.js 24.14.0.
- Tipos: npm run typecheck, tsc --noEmit **aprobado**.
- Chrome 153 en http://127.0.0.1:5173/: bandeja congelada visible, handler por paso, espera sin avance, entrada tardía, replay de traza/estado iguales y cierre parcial sin confirmación.
- Ejecución automática pausada conserva cursor al esperar; QUEUE_CAPACITY visible. Fallo 503 inducido al escribir conserva pendientes; reintento escribe sin duplicados.
- Editor real: sistemas, contratos, suscripciones, reglas de recepción/loop, entrada por tick, límites/nombre, JSON validado; importación/exportación de escenarios y replay, guardado local, filtro e historial. Intento de importar eval rechazado. Sesión independiente no altera la original.
- Se corrigió el defecto de captura de formularios detectado en navegador: FormData se obtiene antes de deshabilitar los controles por la operación asíncrona.
- Capturas de escritorio 1600 px y móvil 390 px inspeccionadas. Evidencia local en output/playwright/browser-check.js, browser-controls.js, browser-editor.js y capturas; no se versiona.
- Archivo físico verificado: debug-logs/session-afea1643-c272-4ea8-9ce6-fc879396635e.jsonl, 70 registros, seis publicaciones, manifiesto inicial y secuencias continuas. Cada nueva sesión debug produce su propio archivo.
- Sin builds, nuevas dependencias adicionales al Vite del arnés previo ni cambios remotos.
- git diff --check aprobado; archivos nuevos también revisados dentro del alcance. Checkout original conserva solo event-bus/ sin seguimiento. Apertura final de Chrome: consola sin errores ni advertencias.

### Límites y continuidad

La pausa ocurre entre operaciones síncronas completas. El historial inspecciona evidencia y no revierte estado. La comparación completa exige traza íntegra; el journal se drena por separado. El núcleo y el adaptador conservan datos de debug en memoria hasta procesarlos: no hay garantía de persistencia de pendientes al cerrar el navegador ni benchmark para sesiones grandes. El fallo de log pausa el controlador; no cambia el estado lógico de la simulación.

Mantener los productores de juego fuera del arnés y reemplazar fixtures con sistemas reales solo mediante encargos aprobados. Pendientes: revisión humana cruzada, comprobar la base actual al integrar, entorno de combate/aritmética/RNG y validación de Electron/plataformas adicionales. Ninguna prueba local acredita protección de GitHub ni publicación en Steam.

La autorización, decisiones, descubrimientos y evidencia se conservan en estos archivos compartidos ante la indisponibilidad de Engram. Reversión: retirar únicamente la ampliación BUS-002 tras revisión; conservar BUS-001 y el trabajo anterior, sin tocar main ni event-bus del checkout original.
