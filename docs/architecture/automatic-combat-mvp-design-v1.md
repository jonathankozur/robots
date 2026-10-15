# COM-001 — Diseño del combate automático mínimo

Revisión: **1.0.0 aprobada para implementación**. Fecha: **15 de octubre de 2026**. Las decisiones indicadas como aprobadas conservan su aprobación; esta revisión concreta los contratos y la ejecución aprobados.

## Encargo y fuentes

| Campo | Contenido |
| --- | --- |
| Responsable humano | Jonathan Kozur. |
| Ejecutor e integrador | Codex, un único ejecutor con lotes secuenciales. |
| Base comprobada | main y HEAD e533ca31c57b756b61fb0953d28572c70b327ec5. |
| Rama / checkout propio | codex/combat-mvp-design; C:/Users/Jonat/.codex/worktrees/combat-mvp-plan/robots. |
| Plan y reservas | [Plan de ejecución 1.0.0](../workflow/automatic-combat-mvp.md), aprobado conjuntamente con las dos fichas siguientes el 15 de octubre. |
| Contratos completos | [Mensajes, rutas, causalidad, geometría y migración 1.0.0](automatic-combat-mvp-contracts-v1.md). |
| Sistemas y escenario | [Fichas por propietario y aceptación C01–C12 1.0.0](automatic-combat-mvp-systems-v1.md). |
| Alcance activo | MVP implementado localmente: contratos, cinco sistemas nuevos, proyección v2, escenario y pantalla. Ver evidencia y límites en el plan. |

La aprobación del plan coordinador 0.1.0 permitió completar diseño. El usuario aprobó después las alternativas recomendadas y pidió continuar con los contratos y fichas. El usuario aprobó conjuntamente los documentos 1.0.0 mediante «aprobado, implementalo» el 15 de octubre de 2026, habilitando todos sus lotes secuenciales.

## Producto y decisiones ya aprobadas

- Un escenario local y fijo con un tablero y un robot por bando.
- Un botón Iniciar; sin órdenes del jugador, pausa o velocidad durante la batalla.
- Pantalla única, mouse/teclado, foco navegable y español.
- Movimiento/ataque automáticos; mostrar tablero, integridad actual/máxima, estado activo/derrotado, hechos y resultado.
- Sin escudos adicionales, condiciones, efectos generales, soporte, loot, progresión o persistencia en este MVP.
- Una batalla por instancia hasta diseñar transferencia de integridad entre encuentros; no se reinicia daño persistente implícitamente.
- Simulación a 20 ticks/s ENV-001, independiente de RAF, animación y reloj real.
- Errores técnicos se muestran como fallo, sin asignar ganador o convertirlos en empate.

| Decisión técnica aprobada el 14 de octubre | Regla |
| --- | --- |
| Visión | Rango del sensor y bloqueo por hexes intermedios passable=false; geometría pura compartida en values. |
| Dos IA | fixture.observe-v1 se aproxima a adyacencia; fixture.pressure-v1 se aproxima hasta alcance de arma. Ambos se mueven y atacan; no hay nuevos behaviorIds. |
| Simultaneidad | Elegibilidad al comienzo de resolution y resolución del lote completo; doble KO permite empate. |
| Límite | 1200 ticks combatientes; empate si ambos siguen activos al agotarse. |
| Recarga | Se consume al aceptar la orden de arma, aunque el impacto resulte rechazado después. |
| Integridad entre encuentros | Primer recorrido con una única batalla; no se decide una transferencia/reset por omisión. |
| Vista pública | PresentationViewPublished@2 para combate, conservando v1. |
| App | Entry point separado en apps/game, reutilizando los recursos/tablero PRE. |

Las alternativas evaluadas fueron: visión solo por distancia o agregar opacidad a contenido; duplicar geometría; un único perfil o arquetipos nuevos; iniciativa para forzar ganador; combate sin límite; recarga al confirmar daño; reset automático/transferencia/globalidad de contexto; evento de combate independiente de la vista; transformar el laboratorio. La selección aprobada limita el primer recorrido y conserva los propietarios y contratos existentes.

## Base verificada en código

Existen navigation, presentation, presentation-three, protocol, application-host, runtime, values, content y system-api. Los cinco actores combatientes nuevos todavía no están implementados.

NAV v1 publica el mundo inicial y pasos confirmados con revisiones; sus contratos no cambian. CAT-002 ya define integridad, sensor, impacto, alcance y recarga, y admite los dos behaviorIds de IA elegidos. PRE v1 contiene mundo/ensamblados/movimientos, sin HP o resultado. La fixture PRE actual incluye un robot desarmado y solo una ficha observe: la receta jugable requiere datos propios válidos.

APP ya prepara vistas, monta fábricas, establece permisos y selecciona type/version de las salidas. El colector conserva una observación por productor. Usar solo v2 para presentation en la nueva receta evita ambigüedad y permite conservar application-host sin cambios.

El bus entrega una publicación a fases posteriores en el mismo tick y a la fase actual/anterior en el siguiente. Los handlers de una fase se completan antes de sus loops. Además, el bus exige una raíz de correlación común para combinar causas. Las decisiones implementadas de abajo respetan esas reglas.

Fuentes examinadas: paquetes protocol/application/navigation/presentation, assembly/controller/bindings de application-host, catálogo/bus/scheduler, geometría, renderer/motion/recursos, contenido de ejemplo y controles de arquitectura/aislamiento. main y HEAD coincidían al preparar este paquete; la base se comprobará otra vez al ejecutar.

## Concreción técnica aprobada

| Detalle | Solución concreta y costo |
| --- | --- |
| Causalidad | Todos los hechos descienden de BeginApplicationContext. Permite que battle combine dos impactos sin violar la regla existente de raíces; exige conservar unas pocas causas vigentes. |
| Acuse de arma | Nuevo AttackAccepted@1. IA recibe readyAtTick del propietario; agrega un evento frente a reintentar órdenes durante toda la recarga. No significa daño aplicado. |
| Decisión por tick | Hasta un movimiento y un ataque por robot si ambos son posibles en la observación previa. observe sigue aproximándose mientras dispara; pressure se detiene al estar en alcance. Armas revalida después de movimiento. |
| Corte visual | En action t se publica observedTick=t-1 con movimiento/daño/resultado de ese corte. Añade una demora nominal de 50 ms y evita una barrera nueva del scheduler. |
| Arranque / límite | battle espera mundo/roster tras APP, emite startedTick=t+1 y cuenta 1200 ticks desde allí. startMaxTicks 10 impide quedar esperando fuentes obligatorias indefinidamente. |
| Empate geométrico | Supercover cerrado: tocar borde o vértice de una pared intermedia bloquea visión. Recorte racional entero y simétrico, sin epsilon ni RNG. |
| Escenario | Dos robots armados con 100 y 80 puntos, mismo impacto 2,5, recarga 20 y alcance 3. La asimetría permite un ganador en el recorrido principal; no constituye balance final. |
| Feedback | Segmento/destello cosmético de ataque y pulso de impacto desde hechos públicos; sin proyectil físico ni alteración de daño. HUD explica integridad/estado/resultado. |
| Carga | El host espera la preparación gráfica al recibir la primera vista READY, en un límite de tick. Luego continúa; el tiempo de carga no entra en la simulación. |

Los esquemas exactos, causas, vigencia, enums, rechazos y ejemplos por mensaje ya están escritos en las fichas. Estos detalles se aprobaron conjuntamente el 15 de octubre y se implementaron con evidencia en el reporte.

## Propietarios y flujo

| Propietario | Escribe únicamente | Recibe / publica |
| --- | --- | --- |
| navigation existente | Posición, ocupación, revisiones y cooldown de paso | RequestNavigationStep / mundo y movimientos NAV v1. |
| perception | Observaciones propias | Vistas NAV/daño y sensor / observación visible actual. |
| decision | Perfil, secuencias, pendientes y vistas necesarias | Observación vigente, posición propia y acuses / solicitudes y explicación de IA. |
| weapons | Recarga y aceptación de ataques | Intenciones, vista completa de action, observación / acuse e impacto solicitado. |
| damage | Integridad/estado defensivo | Impactos / roster y resultados explícitos, revisión global. |
| battle | Participantes, etapa y resultado | Mundo inicial/roster/hechos de daño / inicio y final únicos. |
| presentation | Proyección y buffer propios | Hechos públicos / vista v2 coherente, inmutable y acotada. |
| Composición y UI | Configuración del ensamblado, estado local de pantalla y recursos externos | APP y vista pública / solo intención de inicio. |

1. Iniciar solicita un contexto mediante APP; la UI bloquea activaciones duplicadas.
2. Los propietarios inicializan y confirman. APP activa al tick siguiente.
3. NAV publica mundo y damage publica roster. battle declara inicio efectivo al tick siguiente, después de validar ambas fuentes.
4. perception observa; decision solicita; navigation confirma movimiento; weapons revalida y acepta/rechaza; damage resuelve lote; battle evalúa fin.
5. presentation compromete el corte completo anterior y el host lo recibe en publication.
6. El runner externo, a un tick por 50 ms sin catch-up, se detiene al recibir FINISHED. RAF puede completar sus animaciones cosméticas.
7. La pantalla conserva resultado. Fallo técnico detiene avance y conserva última vista/diagnóstico.

La composición nueva vive fuera de los actores; solo ella importa sus fábricas. UI y renderer no reciben referencias a implementaciones de combate ni pueden emitir órdenes tácticas.

## Compatibilidad e integración

- Los subpaths y la fábrica PRE v1 conservan forma/semántica y las recetas del laboratorio. La nueva fábrica v2 es una opción explícita de la receta del juego.
- Se agregan cinco paquetes con la misma política de dependencias que NAV/PRE. Registrar sus nombres en los controles no concede dependencia entre actores.
- Los datos del escenario usan CAT-002 y recursos existentes; no se modifica su esquema, GLB o manifest.
- La entrada gráfica v2 reutiliza el DTO visual; no convierte mensajes de bus a v1 ni aplica fallback.
- Replay identifica receta/revisión/configuración propias; las grabaciones de laboratorio siguen en sus composiciones anteriores.
- Los contratos/actores/adaptadores nuevos se verifican juntos antes de una integración en main. Push, PR y merge no están autorizados por esta implementación.

La matriz individual de consumidores, archivos y orden de migración está en los contratos, sección 7. Las reservas concretas por sistema y verificaciones sin build están en el plan 1.0.

## Estado de entrega y aprobación

Paquete conjunto 1.0 aprobado el 15 de octubre de 2026 e implementado en codex/combat-mvp-design. Recorrido real: inicio en tick 2, victoria de team.alpha en 623 con 20 puntos, última vista en 624. El caso de HP igual termina en doble derrota.

Contratos, TDD, integración, replay, aislamiento y navegador tienen evidencia en el [reporte de entrega](../workflow/automatic-combat-mvp.md#reporte-de-entrega-local--15-de-octubre-de-2026). La verificación final local está aprobada. No se realizaron builds, publicaciones ni integración remota. Engram no disponible.
