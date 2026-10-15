# COM-001 — Plan de implementación del combate automático mínimo

Revisión: **1.0.0 implementada y verificada localmente**. Fecha: **15 de octubre de 2026**.

## Ficha de encargo y habilitación

| Campo | Contenido |
| --- | --- |
| Identificador | COM-001, recorrido de las tarjetas 07–11 y 06. [Tarjeta 06](https://trello.com/c/ciYHysSx/10-06-interfaz-e-intenciones-del-jugador). No se crean tareas ni tarjetas adicionales. |
| Responsable humano | Jonathan Kozur, usuario que define y aprueba el encargo. |
| Ejecutor / integración | Codex, un único ejecutor que alterna los roles por lote. No hay implementaciones simultáneas ni delegación de archivos. |
| Estado de reserva | Lotes 0–8 implementados secuencialmente por Codex; revisión local y verificación final. |
| Referencia base | main y HEAD e533ca31c57b756b61fb0953d28572c70b327ec5, comprobados el 15 de octubre. Main se volvió a comprobar al cierre de la implementación: conserva esa referencia. |
| Rama / checkout | codex/combat-mvp-design; C:/Users/Jonat/.codex/worktrees/combat-mvp-plan/robots. Ya son propios y separados de C:/dev/robots; utilizados para todos los lotes aprobados. |
| Objetivo | Iniciar una batalla local 1v1, ver tablero y robots moverse/atacarse automáticamente, seguir integridad/estado/hechos y conservar el resultado. El escenario principal debe terminar con ganador; doble KO y límite tienen empate explícito. |
| Contratos vigentes consumidos | BUS-001/002, ENV-001, APP-001 v1, CAT-002 v2, NAV-001 v1 y PRE-001 v1/manifest v1. No se cambian sus reglas. |
| Contratos aprobados | [Mensajes COM y proyección v2](../architecture/automatic-combat-mvp-contracts-v1.md), revisión 1.0.0, y utilidad hasLineOfSight. |
| Fichas por propietario | [Sistemas, escenario y aceptación](../architecture/automatic-combat-mvp-systems-v1.md), revisión 1.0.0. Cada fila de reserva inferior es un encargo concreto bajo este objetivo común. |
| Aprobaciones recuperadas | Producto y recomendaciones: aprobados; plan coordinador 0.1.0: «aprobado el plan, avanza»; ocho alternativas técnicas: «aprobado», 14 de octubre. «oka, continua entonces» autoriza completar estas fichas tras informar que faltaban para empezar código. |
| Aprobación actual | Jonathan aprobó el paquete conjunto 1.0.0 mediante «aprobado, implementalo» el 15 de octubre de 2026; quedan autorizados contratos, fichas, reservas y todos los lotes de implementación/verificación. |
| Entorno | Node 24.14.0 comprobado; TypeScript/Three/Vite fijados en package-lock. Dependencias instaladas con scripts desactivados; solo se agregaron enlaces a los cinco paquetes locales, sin cambiar versiones externas. Pruebas nativas TS y typecheck --noEmit; nunca ejecutar builds. |
| Dependencias de trabajo | Contratos y geometría primero; actores evaluables con proveedores sintéticos por mensajes; luego composición y pantalla. Todos los paquetes nuevos se montan por exports públicos. |
| Memoria | Engram no está disponible en esta sesión; contexto y aprobación se conservan en estos documentos compartidos. |

La aprobación conjunta del **plan 1.0.0, contratos 1.0.0 y fichas 1.0.0** habilitó todos los lotes siguientes en secuencia. No se solicitará una aprobación nueva por cada lote mientras permanezca dentro de esos contratos y archivos. Una ampliación funcional, dependencia externa o cambio de contratos distinto del presentado sí requiere revisar el alcance.

## Producto y límites acordados

Una pantalla en español, mouse/teclado y foco visible. El jugador pulsa Iniciar una vez; durante el combate observa tablero, bandos, HP actual/máximo, estado activo/derrotado, ataques, daño y resultado. No hay órdenes tácticas, selección de robot/mapa, pausa o velocidad del jugador. El host conserva su control de depuración, independiente del producto.

Se incluyen una arma directa por robot, integridad, alcance/recarga, percepción por distancia/obstáculos, dos políticas automáticas e inicio/fin del encuentro. Se excluyen efectos/condiciones, escudos/armadura, evasión, proyectiles físicos, soporte, reparación, loot, progresión, almacenamiento, multiplayer, Electron y segunda batalla. Una sesión nueva no implica curar progreso persistente: este MVP utiliza un escenario nuevo sin transferencia entre encuentros.

## Base comprobada y decisiones del cambio

- En la base existían NAV/PRE. Esta entrega añade damage/weapons/perception/decision/battle.
- APP ya monta participantes con fábricas, fases/bindings y outputTypes versionados; no necesita modificaciones para esta receta.
- La v1 de presentación carece de datos de combate. Una nueva fábrica publica v2; el laboratorio conserva la fábrica y mensajes v1.
- El bus prohíbe causas de distintas raíces: toda la cadena del encuentro conserva la raíz BeginApplicationContext. No se cambia el bus para integrar el combate.
- El corte v2 en action t incluye todos los hechos efectivos hasta t-1. El runner avanza un tick adicional para entregar el final completo.
- AttackAccepted informa aceptación/recarga desde el propietario. La IA puede pedir un movimiento y un ataque por tick si ambos son posibles, siempre revalidados por sus responsables.
- El escenario fijo usa los campos y recursos existentes, pero necesita dos robots armados y una ficha con el behaviorId pressure ya admitido; la fixture PRE actual contiene un robot desarmado.
- El inventario pasa de nueve a catorce paquetes. Los cinco nuevos tienen las mismas restricciones de NAV/PRE; se prueban sin instalar ninguno de los seis actores vecinos.

Estos detalles, incluidos el corte temporal, el acuse, MOVE+ATTACK y los valores del escenario, forman parte del paquete técnico 1.0 aprobado e implementado. Las alternativas y sus costos están en los documentos de contrato y diseño.

## Reservas de alcance por propietario

Cada fila identifica responsable de estado o infraestructura, rutas editables y exclusiones. Las reservas aprobadas se activaron una a una en este checkout, sin solapamiento de implementaciones. Codex es el ejecutor de cada encargo y responsable de integrar los archivos compartidos. La existencia de otros worktrees no demuestra que sus reservas estén libres: se comprueba antes de iniciar.

| Encargo / propietario | Rutas editables aprobadas | Exclusiones y motivo |
| --- | --- | --- |
| COM-PRO / protocolo compartido | Nuevos packages/protocol/src/{damage,weapons,perception,decision,battle}/v1.ts; presentation/v2.ts; packages/protocol/package.json; nuevos packages/protocol/test/combat-contracts.test.ts y tests/core/combat-contract-routing.test.ts. | No editar application/v1, content/v2, navigation/v1 ni presentation/v1. Los permisos de productores no se incrustan en las definiciones. |
| COM-GEO / values | packages/values/src/hex-grid.ts; nuevo packages/values/test/line-of-sight.test.ts. | Conservar distancia, vecinos, BFS y sus resultados; no cambiar imports a protocol o actores. |
| COM-DMG / damage | Nuevo packages/damage/ completo: package.json, tsconfig.json, src/index.ts, actor.ts, data.ts y test/*.test.ts. | Sin editar otros actores ni registrar bindings dentro del sistema. |
| COM-WPN / weapons | Nuevo packages/weapons/ con la misma estructura autónoma. | Sin modificar integridad ni invocar damage/perception/navigation. |
| COM-PER / perception | Nuevo packages/perception/ con la misma estructura autónoma. | No incorporar elección de acciones ni memoria de rivales ocultos. |
| COM-DEC / decision | Nuevo packages/decision/ con la misma estructura autónoma. | Sin introducir órdenes del jugador ni escribir posición/recarga/HP ajenos. |
| COM-BAT / battle | Nuevo packages/battle/ con la misma estructura autónoma. | No introducir autoridad de batalla en scheduler/host ni escribir HP. |
| COM-PRE / presentation | Nuevos packages/presentation/src/combat-actor.ts y combat-data.ts; src/index.ts; package.json si requiere subpath nuevo; test/combat-actor.test.ts. | Conservar actor.ts v1 y sus resultados, sin renderer/reloj/I/O en el actor. |
| COM-VIS / presentation-three | Nuevos src/combat-feedback.ts y test/combat-feedback.test.ts; src/renderer.ts y src/index.ts del mismo paquete; tests/harness/combat-visual.test.ts. | No cambiar GLB, Blender, manifest, reloj de simulación ni semántica de prepare/accept v1. Los efectos son cosméticos. |
| COM-APP / composición y UI | Nuevo apps/game/** (index.html, game.css, main.ts, composition.ts, scenario.ts, runner.ts, view-model.ts, env.d.ts, README.md); content/scenarios/combat-mvp-v1.json; scripts/game-server.ts; nuevos tests/core/combat-integration.test.ts y combat-replay.test.ts, tests/harness/game-runner.test.ts y game-view-model.test.ts, tests/packages/combat-composition.test.ts. | No importar fixtures del laboratorio como código de producto; no modificar tests/browser ni application-host/src. |
| COM-INT / integración compartida | package.json, package-lock.json, tsconfig.json; scripts/package-boundaries.ts; tests/packages/architecture.test.ts e isolated.test.ts; nuevo tests/packages/combat-architecture.test.ts; tests/core/presentation-architecture.test.ts; docs/architecture/systems.md y system-independence-v1.md. | Solo registro de workspaces/exports, inclusión TS de apps y extensión de la misma política/controles. Verificar ausencia real de todos los actores vecinos y el cierre de tres dependencias de cada actor; conservar controles negativos de reloj/I/O/imports. No nuevas bibliotecas externas o versiones. |
| COM-DOC / documentación | docs/decisions.md, este plan y los tres documentos automatic-combat-mvp-{design,contracts,systems}-v1.md. | Registrar avance/evidencia real y estado de aprobación, sin marcar pruebas no ejecutadas. |

Los cambios de raíz/controles corresponden exclusivamente al integrador, aunque se necesiten al dar de alta cada paquete. Son secuenciales y su diff se revisa aparte del comportamiento de los actores. Ningún lote puede ampliar unilateralmente esta tabla.

## Secuencia de ejecución y criterios de salida

| Lote | Trabajo | Dependencia / salida exigida |
| --- | --- | --- |
| 0 | Recuperar aprobación, main/reservas y entorno; activar encargo y registrar base efectiva. Revisar scripts antes de ejecutar verificaciones. | No hay cambios ajenos superpuestos. Si la base cambió, analizar compatibilidad sin sobrescribir trabajo; si cambia alcance funcional, detener esa ampliación. |
| 1 | TDD de DTO/validadores/rutas COM y hasLineOfSight; agregar subpaths públicos neutrales. | C04 y forma/causalidad/fases de C11/C12. Ningún cambio al scheduler/system-api/contratos vigentes. |
| 2 | Implementar damage y registrar su paquete con sus pruebas propias. | C02 y lote letal de C07, proveedores sintéticos conformes; HP/revisiones/deduplicación con TDD. |
| 3 | Implementar weapons y registrar su paquete. | C03/C05, incluyendo datos recibidos después de la intención pero antes del loop, acuse y recarga exacta. |
| 4 | Implementar perception y decision, reservando cada paquete en secuencia. | C04/C05/C06: datos vigentes, ocultos, dos perfiles, MOVE+ATTACK, acuses y rutas deterministas. |
| 5 | Implementar battle y registrar su paquete. | C01/C07/C09: barreras, primer/último tick, ganador, doble KO, límite y una salida terminal. |
| 6 | Implementar proyección v2 y feedback visual, cada propietario en secuencia. | C08/C12: corte coherente, historial/payload acotados, eventos visuales deduplicados y v1 conservada. |
| 7 | Agregar contenido del escenario, composición, runner y pantalla. | C01/C10: robots armados válidos CAT, movimiento/ataques reales, team.alpha vencedor y último corte completo. |
| 8 | Verificar integración, replay, independencia, navegador, errores y cierre. Actualizar documentación de entrega. | C01–C12 con evidencia real; regresiones anteriores aprobadas o limitaciones expresas; sin builds. |

Cada conducta nueva sigue prueba significativa RED por la conducta ausente, implementación mínima GREEN y refactor. Un error de import, instalación o entorno no acredita RED. Los sistemas se pueden evaluar con productores sintéticos que solo usan sus contratos públicos; no se espera a terminar todo el juego para probar estado propio.

Los cinco paquetes se dan de alta conforme se inicia su lote, con los metadatos/root-lockfile coordinados por COM-INT. Las verificaciones globales con inventario final se ejecutan al completar el conjunto de catorce; durante los lotes se usan las pertinentes al paquete. No se elimina un fallo de integración declarando un permiso nuevo entre actores.

## Verificaciones permitidas

Los scripts inspeccionados usan Node nativo o tsc --noEmit; no construyen artefactos. Antes de ejecutarlos se comprueba que siguen teniendo ese contenido. Node observado: 24.14.0. No se ejecutó ninguno de estos comandos de pruebas durante la fase documental.

| Momento | Comando / procedimiento | Propósito |
| --- | --- | --- |
| Por paquete nuevo | npm test --workspace @robots/damage (o propietario correspondiente); npm run typecheck --workspace @robots/damage | RED/GREEN conductual y tipos sin emisión; repetir solo por cambios que lo justifiquen. |
| Geometría / protocolo | node --test packages/values/test/line-of-sight.test.ts packages/protocol/test/combat-contracts.test.ts tests/core/combat-contract-routing.test.ts | Casos geométricos conocidos, invariantes, límites y rutas. |
| Integración COM | node --test tests/core/combat-integration.test.ts tests/core/combat-replay.test.ts tests/harness/game-runner.test.ts tests/harness/game-view-model.test.ts tests/packages/combat-composition.test.ts | Recorrido/resultado/replay, temporizador externo, UI y composición. |
| Conjunto final | npm test; npm run typecheck; npm run typecheck:packages | Regresiones y autonomía. npm test ya incluye tests/packages/isolated.test.ts, que ejecuta typecheck sin emisión/imports/pruebas en copia aislada; no hace falta duplicar test:isolated sin motivo. |
| Navegador | npm run game:dev, script nuevo que ejecuta únicamente node scripts/game-server.ts y Vite en desarrollo; Playwright en Chrome/Chromium disponible. | Inicio por teclado, tablero/HUD/ataques, final, sin segunda batalla, 30/60 FPS, carga lenta, fallos y cierre. Registrar versión real y capturas. |
| Dependencias | Preparación inicial: npm ci --ignore-scripts --no-audit --no-fund. Al dar de alta nuevos workspaces, npm install --ignore-scripts --no-audit --no-fund, con versiones externas fijadas. | Instalar desde lockfile y actualizar únicamente los cinco paquetes locales al agregarlos; no ejecuta scripts de instalación/build. Revisar diff del lockfile. |
| Entrega | git diff --check, revisión de todos los archivos incluidos los nuevos y contraste con C01–C12. | Alcance, contratos, coherencia documental y evidencia. |

No ejecutar npm run build, vite build, tsc con emisión, empaquetado Electron ni un comando que los invoque indirectamente. Una comprobación que exija build queda pendiente hasta una excepción humana explícita; no se sustituye por una afirmación de éxito.

La comparación de ritmos visuales utiliza el mismo runtime/configuración/semilla y el mismo horizonte lógico completo; no compara tiempos de pared. La traza debe estar completa, no truncada. La evidencia del navegador no demuestra Electron o determinismo entre distintas plataformas.

## Aceptación de la entrega

Los criterios C01–C12 están definidos íntegramente en las fichas. La aceptación del recorrido principal exige:

1. Un clic crea un solo contexto y activa el escenario válido.
2. Dos robots de bandos diferentes se mueven y atacan sin nuevas entradas del jugador.
3. Solo damage escribe HP; los rechazos no se muestran como daño.
4. La vista pública muestra tablero, bandos, integridad, estado y hechos coherentes al mismo corte lógico.
5. El escenario fija un ganador esperado: team.alpha, con 20000 unidades; la derivación de los ticks se comprueba con código real.
6. Doble KO y límite tienen resultados explícitos; un error técnico no declara ganador.
7. Se conserva resultado y última vista, se detiene el runner tras recibir el final completo y no se abre otra batalla.
8. Replay/ritmos visuales conservan resultado y traza lógica; los paquetes tienen solo sus dependencias declaradas y la versión v1 conserva sus consumidores.
9. Carga y cierre no crean otra sesión ni reactivan tareas tardías; teclado y pantalla angosta permiten leer la interfaz mínima.

## Riesgos, recuperación e integración

El corte anterior de presentación añade una demora lógica fija; el runner debe drenar el tick posterior al final. La raíz causal compartida evita el error de combinar ataques independientes, pero exige probar toda la cadena. El supercover por contacto de borde es conservador; se demuestra con casos geométricos, sin ajustar epsilons. Los valores del escenario permiten una victoria esperada sin ser balance definitivo.

Una prueba o revisión que contradiga la especificación se corrige dentro del propietario y alcance correspondiente. Un cambio de regla/contrato se propone con impacto antes de editar esa parte. Ante fallo se detiene el runner, se conserva diagnóstico/última vista y se cierra mediante APP; no se captura gameplay parcial como progreso ni se ofrece una segunda batalla.

No se integran paquetes incompletos en main. Entrega local primero con diff, contratos, pruebas ejecutadas/no ejecutadas, riesgos y pendientes. Push, creación de PR, publicación y merge requieren autorización propia; esta aprobación de implementación no los incluye.

## Reporte de entrega local — 15 de octubre de 2026

**Estado: entregado para revisión local; sin integración en main.** Encargo COM-001 y aprobación conjunta «aprobado, implementalo». Base e533ca3, rama codex/combat-mvp-design y checkout propios indicados arriba.

### Alcance y contratos

Se implementaron los cinco propietarios nuevos, geometría LOS, contratos COM v1, nueva fábrica de proyección v2, entrada visual acceptCombat, contenido CAT-002, receta y pantalla apps/game. Registro de catorce paquetes y aislamiento ampliado. APP, bus, scheduler, NAV v1, PRE v1 y recursos GLB/manifest conservan sus implementaciones/contratos previos. El lockfile solo agrega los cinco workspaces locales.

La pantalla permite iniciar con mouse/teclado; muestra tablero, HP actual/máximo, activo/derrotado, actividad y resultado. Un solo encuentro, sin órdenes durante combate. El runner espera carga inicial en una frontera completa y drena la vista final antes de detenerse.

### Evidencia C01–C12

| Criterio | Evidencia ejecutada |
| --- | --- |
| C01 | game-runner y composición: inicio único, siete participantes, APP; combate real iniciado en tick 2. Teclado Enter en Chromium. |
| C02 | damage: saturación, cero, desconocidos, duplicado, conflicto, cache de 64/expirado y revisión. Solo su actor escribe HP. |
| C03 | weapons/decision: recarga exacta t+20, rechazo anterior y aceptación en límite, duplicados sin impacto adicional, acuse/cooldown recibidos. Armas no consume resultados de rechazo de daño ni revierte su recarga. |
| C04 | LOS: pared intermedia, bordes y vértice, simetría, extremos e inválidos; percepción inclusiva y oculta por rango/terreno. |
| C05 | weapons: posición recibida después de intención antes del loop; observación vencida. perception: salto de revisión falla. decision: NAV no proporciona objetivos ocultos. |
| C06 | decision: observe avanza y dispara; pressure mantiene distancia de tiro; orden estable MOVE/explicación/ATTACK/explicación; acuse ausente/contradictorio falla. |
| C07 | damage/battle: doble KO en ambos órdenes; eliminación en tick límite prevalece sobre tiempo. |
| C08 | presentation: movimiento, daño y fin se comprometen al mismo corte t-1; historial de 64; feedback duplicado/gap no repite ataques y snapshot recupera posición. |
| C09 | battle y runner: victoria, empate, límite, final único y última vista retenida. No existe botón de segunda batalla. |
| C10 | integración real: primeros pasos (2,2)/(4,2), disparos desde tick 3; team.alpha gana en 623 con 20000 unidades; vista terminal entregada en 624. Variante con HP igual: doble KO, revisión 80. Replay y 30/60 FPS conservan traza completa, sin registros perdidos. |
| C11 | límites AST/grafo y copias aisladas de los catorce paquetes; mismos tres paquetes neutrales para los siete actores; IDs de montaje renombrados. Rutas reales verificadas por tick/fase; una raíz causal por encuentro. Regresiones APP/NAV/PRE y sesiones anteriores pasan. |
| C12 | proyección máxima de colecciones 57852 bytes y Begin combinado 33363, bajo 65536 sin ampliar runtime. Chromium 145.0.7632.6: inicio teclado, partida normal sin errores de consola, final retenido, viewport 390×844 sin overflow; carga lenta/cierre no reactiva; GLB 404 y pérdida real de WebGL detienen sin fabricar resultado. |

### Verificación y correcciones

- RED/GREEN conductual de geometría, validadores, cinco actores, proyección, feedback, runner y formato. Errores de instalación/import no se contaron como RED.
- Suite final npm test: **313/313 aprobadas**, cero fallos/omitidas, incluyendo copias aisladas de los catorce paquetes. Ejecución final: 31756 ms; log local output/playwright/final-tests.log.
- npm run typecheck y npm run typecheck:packages: **aprobados sobre el código final**, siempre con --noEmit. Logs locales final-types.log y final-package-types.log en output/playwright.
- Cliente de develop-web-game ejecutado tras las correcciones y humo final; capturas abiertas e inspeccionadas. Capturas finales de pantalla completa y evidence.json en output/playwright/combat-final (artefactos locales ignorados por Git).
- La inspección visual encontró que el renderizador PRE nace pausado: acceptCombat activa su reloj visual; prepare/accept v1 conservan semántica. Se volvió a comprobar movimiento real y feedback.
- La prueba de MAX_SAFE_INTEGER detectó pérdida de una unidad en división flotante del HUD: formato corregido mediante cociente entero y resto, con RED/GREEN.
- Validación previa comprueba recursos y sockets del manifest antes de crear actores.
- Main se comprobó nuevamente en e533ca3. No se cambiaron otros checkouts ni se ejecutaron builds.

### Revisión y límites

La ejecución final de pruebas/tipos quedó aprobada. Se revisaron alcance y diff, incluyendo archivos nuevos; las comprobaciones finales de whitespace y enlaces se registran a continuación. La revisión humana e integración son posteriores; no se hizo push, PR, publicación ni merge. La recuperación consiste en conservar este branch/worktree; no se modificó main.

La evidencia acredita Node 24.14.0 y Chromium de escritorio. No acredita Electron, dispositivos móviles físicos ni determinismo entre plataformas. Los modelos son de prototipo y los valores del escenario no son balance definitivo. No hay persistencia/transferencia entre encuentros ni segunda batalla. No quedan decisiones funcionales pendientes dentro del MVP aprobado.

Engram no está disponible; plan, contratos, fichas, decisiones y apps/game/progress.md conservan el contexto.

### Revisión de la entrega

La revisión de fuentes nuevas y diff comprobó propiedad de HP/posición/recarga, fases, comandos con responsable único, raíz causal, límites de buffers/cache/historial y conservación de v1. El feedback gráfico tiene máximo de 64 objetos y libera geometría/materiales propios; los materiales de GLTF compartidos no se tiñen. El protocolo de final conserva como causas mensajes recibidos del arranque y daño, sin reconstruir mensajes emitidos a partir de IDs.

Solo se modificaron las rutas reservadas. El servidor de desarrollo local queda disponible mediante npm run game:dev, puerto 5174. No hay bloqueos funcionales dentro del alcance; revisión humana/integración siguen pendientes como acciones posteriores.

git diff --check aprobado. Se incluyeron los 80 archivos modificados/nuevos en la comprobación de whitespace y fences; 52 enlaces locales comprobados sin rutas rotas. Los avisos de conversión LF/CRLF de Git corresponden a la configuración existente del checkout y no son errores de whitespace.
