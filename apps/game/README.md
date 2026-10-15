# Robots — combate automático mínimo

## Abrir el juego

Desde la raíz de este checkout:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run game:dev
```

Abrir http://127.0.0.1:5174 y pulsar **Iniciar combate**. También funciona con teclado. El servidor usa Vite en desarrollo; no ejecuta builds.

Un encuentro por instancia de pantalla. Alpha y Beta se mueven y atacan automáticamente; el jugador observa vida, estado, actividad y resultado. El escenario usa los modelos de prototipo existentes.

## Organización

- composition.ts: preflight puro de contenido, vistas mínimas, participantes y permisos por mensaje.
- runner.ts: un temporizador de 50 ms, sin recuperación de ticks atrasados. Espera la carga inicial y la proyección terminal completa.
- view-model.ts: formato exacto de unidades y textos de hechos confirmados.
- main.ts, index.html, style.css: pantalla y ciclo de vida del adaptador gráfico.
- ../../packages/: propietarios independientes de posición, percepción, decisiones, armas, daño, batalla y proyección.

La receta es automatic-combat-mvp / automatic-combat-mvp-v1. Semilla: 0123456789abcdef. Inicio esperado en tick 2; ganador team.alpha en tick 623 con 20000 unidades (20 puntos); vista final en tick 624.

## Verificación sin build

```powershell
npm test
npm run typecheck
npm run typecheck:packages
```

Pruebas nativas de Node y tsc --noEmit. El plan y el reporte de evidencia están en [COM-001](../../docs/workflow/automatic-combat-mvp.md). El laboratorio anterior conserva su receta y presentación v1.

Para inspección de navegador, window.render_game_to_text() devuelve estado de pantalla y última proyección pública; no permite emitir acciones de combate. Las pruebas usan el cliente de la skill develop-web-game y Playwright con el servidor de desarrollo.

## Límites de esta entrega

Solo batalla local 1v1, un arma directa por robot, dos perfiles de IA y modelos de prototipo. Victoria, doble derrota y límite de duración tienen resultados explícitos. Fallos técnicos detienen el avance sin declarar ganador. No hay nueva batalla, progresión, guardado, loot, defensas avanzadas ni efectos de juego.

La evidencia de navegador se obtuvo en Chromium de escritorio y viewport móvil emulado. Electron, dispositivos móviles reales y determinismo entre plataformas no están comprobados.
