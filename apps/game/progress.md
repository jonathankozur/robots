Original prompt: aprobado, implementalo — MVP de combate automático con dos robots, movimiento, ataque, ganador e interfaz mínima.

## Goal
Implementar íntegramente COM-001 1.0 aprobado por Jonathan Kozur, sin órdenes del jugador durante combate.

## Instructions
- Rama codex/combat-mvp-design, checkout C:/Users/Jonat/.codex/worktrees/combat-mvp-plan/robots; base/main e533ca3.
- Ejecutor único, lotes secuenciales; nunca builds. Verificación autorizada: Node nativo, tsc --noEmit y navegador de desarrollo.
- No push/PR/merge/publicación ni cambios a Trello autorizados por este encargo.
- Engram no disponible; este registro y documentos COM son recuperación compartida.

## Discoveries
- APP admite siete participantes y salida PRE v2 sin modificar el host.
- El bus exige una raíz causal común; se preservan Message recibidos reales, no mensajes reconstruidos a partir de IDs.
- El renderizador v1 inicia pausado: acceptCombat activa el reloj visual, conservando prepare/accept v1.
- División flotante del HUD perdía una unidad cerca de MAX_SAFE_INTEGER; se corrigió mediante cociente entero y resto con prueba RED/GREEN.
- La proyección compromete corte t-1; detener el runner al ver BattleFinished pierde la vista final. Se espera FINISHED pública.
- Precarga lenta bloquea avance en frontera completa; generación de runner impide tareas tardías tras cierre.

## Accomplished
- LOS con supercover por bordes/vértices; contratos COM v1 y PRE v2.
- Cinco paquetes autónomos nuevos: damage, weapons, perception, decision, battle; solo system-api/protocol/values.
- Damage posee HP y resuelve impactos simultáneos; armas posee aceptación/recarga; IA mueve y ataca con observación vigente.
- Nueva fábrica de proyección v2, historial 64 y vista terminal coherente; fábrica v1 intacta.
- Feedback visual deduplicado, máximo 64 objetos con recursos propios.
- Escenario CAT-002, preflight de equipo/visuales/sockets, receta y pantalla mínima española en apps/game.
- Integración real: start 2, movimientos iniciales (2,2)/(4,2), ataques desde 3, team.alpha gana en 623 con 20000 unidades; vista final en 624. HP igual produce doble KO.
- Replay y agrupación 30/60 FPS: misma traza completa y resultado, cero registros perdidos.
- Colecciones máximas: vista 57852 bytes, Begin 33363 bytes; presupuesto 65536 conservado.
- npm test final: 313/313 aprobadas, 0 fallos/omitidas. Root y 14 paquetes typecheck sin emisión aprobados.
- Chromium 145.0.7632.6: inicio Enter, partida completa/victoria, consola normal sin errores, viewport 390×844 sin overflow. GLB 404 y WebGL perdido detienen sin resultado falso. Carga lenta/cierre no reactiva.
- Capturas abiertas e inspeccionadas en output/playwright/combat-final y humo posterior en combat-smoke-final; archivos de evidencia ignorados por Git.
- Plan, contratos, fichas, decisiones e inventario actualizados. No builds.

## Next Steps
- Revisión humana del resultado local. Integración remota requiere instrucción propia.
- Fuera de este alcance: transferencia entre encuentros, segunda batalla, defensas, efectos, loot/progreso y persistencia.
- No acreditado: Electron, dispositivos móviles reales ni determinismo entre plataformas.
- Servidor Vite de desarrollo en http://127.0.0.1:5174; reiniciar desde este checkout con npm run game:dev si deja de estar activo.

## Relevant Files
- docs/workflow/automatic-combat-mvp.md — aprobación, reservas y reporte C01–C12.
- docs/architecture/automatic-combat-mvp-contracts-v1.md — mensajes, rutas, causalidad, límites.
- docs/architecture/automatic-combat-mvp-systems-v1.md — propiedad, reglas, escenario.
- apps/game/composition.ts — preflight, receta y permisos.
- apps/game/runner.ts — temporizador externo y carga/cierre/final.
- apps/game/main.ts — pantalla, recursos y datos observables.
- packages/{damage,weapons,perception,decision,battle}/ — actores autónomos y pruebas.
- packages/presentation/src/combat-actor.ts — corte coherente v2.
- packages/presentation-three/src/renderer.ts — entrada gráfica combatiente.
- tests/core/combat-*.test.ts — rutas, presupuesto, encuentro y replay.
- tests/harness/game-*.test.ts, combat-visual.test.ts — runner, HUD y animación.
- tests/packages/ — composición, grafo, capacidades y carga aislada.
