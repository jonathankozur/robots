# PRE-001 — Presentación 3D modular

Revisión 1.0. Fecha: 14 de octubre de 2026. [Tarjeta 05](https://trello.com/c/yvOivbe1). **Diseño y plan 1.0 aprobados mediante «aprobado. Implementalo»; implementación local entregada para revisión.**

## Autorización y base

El usuario confirmó las diez recomendaciones, con estas precisiones: ensamblado por piezas, geometría genérica, modelos lo más simples posible y colores contrastantes. Codex producirá los modelos con Blender. GLB, convenciones de montaje, cámara ortográfica inclinada, suavizado solo tras confirmación, pausa del reloj visual, vista propia por mensajes, señales iniciales y precarga/reutilización/limpieza quedaron aceptados. La solicitud posterior habilita documentar, crear rama y preparar un plan; el usuario autorizó después su ejecución con «aprobado. Implementalo».

Base: main a9d8d834a9f5169d9c1b79f0a8b2023fefb52f59, [PR #5 integrado](https://github.com/jonathankozur/robots/pull/5). Rama codex/presentation-3d-v1, checkout propio creado antes de editar. Contratos de referencia: NAV v1, CAT-002, APP-001 y API del núcleo 1.2. Blender 5.1.0 encontrado en el equipo; Three.js 0.186.1 incorporado en esta entrega.

## Decisiones aprobadas

| Tema | Elección y consecuencia |
| --- | --- |
| Ensamblado | Construir cada robot visualmente con sus piezas equipadas. La vista de prueba mostrará también núcleo, IA y sensor para explicar el ensamblado. |
| Arte | Primitivas y materiales de colores contrastantes. Formas distintas para que el color no sea la única señal. Sin arte definitivo ni texturas externas. |
| Producción/formato | Codex crea fuentes Blender y exporta GLB glTF 2.0 autocontenidos; conserva un generador reproducible y el archivo .blend. |
| Convenciones | Plano XZ, Y arriba, frente +Z; origen del robot en el centro de apoyo. Escala uniforme, sockets nombrados y transformaciones en el modelo. |
| Cámara | Ortográfica inclinada, tablero completo por defecto y ajuste al tamaño del área. Inspección libre limitada al laboratorio con restablecimiento. |
| Movimiento | Animar exclusivamente hechos confirmados. CD sigue siendo disponibilidad lógica, no duración de tránsito. |
| Pausa | Congelar reloj visual al pausar. Avance manual exacto y aceleración sin acumular animaciones pendientes. |
| Datos | Propietario presentation con vista propia por mensajes; Three.js, reloj y carga fuera del scheduler. |
| Señales | Tablero, obstáculos, identidad y orientación; posiciones/rutas/CD como diagnósticos de laboratorio. Combate y pantallas se amplían con sus sistemas. |
| Recursos | Precarga del encuentro, reutilización y limpieza explícita; sustitución visible y diagnóstico ante fallos. Primera ruta gráfica: Three.js/WebGL 2, escenario máximo actual 12x12/16 robots. |

Alternativas descartadas para esta entrega: modelo completo por combinación; assets detallados o comerciales; ajustes particulares de encaje en código; cámara de perspectiva como vista inicial; predicción del movimiento; acceso directo al estado de navegación; carga de archivos dentro del tick. Sus ventajas eran preparación inicial menor o apariencia más elaborada, a cambio de menor validación modular, excepciones de montaje o acoplamiento temporal.

## Kit geométrico propuesto

Un hexágono de punta arriba tiene radio visual 1; centros vecinos separados sqrt(3). Robot completo dentro de una huella circular de radio 0.80. Estas unidades son visuales; las coordenadas lógicas permanecen como enteros axiales. La conversión pura propuesta es x=sqrt(3)*(q+r/2), z=1.5*r. Las filas/columnas axiales forman el mismo tablero de NAV, no otro mapa.

| Parte | Geometría y color propuestos | Encaje |
| --- | --- | --- |
| Chasis | Prisma rectangular azul #2563EB, ancho 0.85, alto 0.32, fondo 0.70. Marca triangular blanca en el frente. | Soporte sobre la locomoción; origen común en el suelo. |
| Núcleo | Octaedro amarillo #FACC15, tamaño aproximado 0.20. | Encima del centro, socket core. |
| IA | Cubo cian #22D3EE, lado 0.16. | Parte trasera izquierda, socket ai. |
| Sensor | Cono violeta #A855F7, radio 0.10 y alto 0.20. | Parte superior delantera, socket sensor. |
| Ruedas | Cuatro cilindros gris oscuro #334155, radio 0.18; centros laterales x=+/-0.52, z=+/-0.25, eje X. Cubos naranjas #FB923C en los centros. | Módulo completo en socket drive. |
| Orugas | Dos prismas largos gris oscuro con placas naranjas; ancho 0.20, fondo 0.85, centros laterales x=+/-0.52. Sin cinta animada ni simulación física. | Segundo módulo compatible con drive. |
| Arma | Base rectangular naranja #F97316 y cañón cilíndrico rojo #EF4444 hacia +Z. | weapon-a o weapon-b según equipamiento, sin disparos reales. |
| Suelo | Prisma hexagonal gris claro #CBD5E1 con borde oscuro. | Una instancia por casilla. |
| Obstáculo | Bloque gris #64748B con marca de cruz clara. | Casilla bloqueada recibida de NAV. |

Defensa y utilidad se podrán representar posteriormente con un escudo rectangular verde y una cuña blanca, cuando existan definiciones y mensajes que las requieran. No se introducen estas familias de gameplay ahora.

Dimensiones, paleta y posiciones finas son parámetros de fixture propuestos, verificables en la primera escena y sujetos a ajustes de legibilidad dentro de esta convención. No son balance ni modelos finales.

Sockets del chasis: core, drive, ai, sensor, weapon-a, weapon-b. Cada nombre debe resolver exactamente un nodo y una transformación finita. Las piezas se exportan con un origen de montaje uniforme. Blender trabaja con su convención de ejes y el exportador convierte a glTF: verificar el resultado cargado en Three.js, no inferirlo del viewport de Blender. Los transforms de exportación se aplican una vez; evitar escalas correctivas por instancia.

## Propiedad y fronteras

El actor de datos presentation conserva identidad del contexto/tablero, configuración visual mínima, última vista de mundo y revisiones. Sus únicos cambios lógicos provienen de mensajes. Confirma inicialización mediante APP, consume NavigationWorldReady y NavigationStepResolved y publica una proyección inmutable. No consulta actores ni contiene Scene, Mesh, reloj, callbacks asíncronos o I/O.

El adaptador gráfico conserva escena, cámara, instancias, recursos GPU, tiempo visual y transiciones. Consume únicamente la proyección pública publicada mediante APP. Las fábricas/recetas de ensamblado pueden crear actores; los propietarios no importan implementaciones vecinas. La cámara y los controles del laboratorio no producen órdenes de gameplay.

Las cargas de assets y sus errores son operaciones del adaptador externo. Un fallo visual no emite una confirmación lógica falsa ni detiene/oculta un fallo de simulación. La disponibilidad visual nunca se espera dentro de un handler.

## Contratos propuestos, sin alterar NAV/CAT/APP

| Mensaje | Productor/consumidor y fase | Datos y semántica |
| --- | --- | --- |
| InitializePresentationView v1, comando de arranque | app-coordinator en input, a partir de la raíz app-bootstrap; presentation en action, declarado por la receta APP | Identidad APP y view con boardId y ensamblado mínimo de cada robot: IDs, resourceId, slotId/socketId. Solo datos admitidos y acotados. La fábrica APP declara este comando sin modificar APP-001. |
| NavigationWorldReady v1, evento existente | navigation en input; presentation en action | Inicializa tablero/posiciones. Rechazar identidad distinta o segunda inicialización. |
| NavigationStepResolved v1, evento existente | navigation en movement; presentation en action | Solo accepted=true y duplicate=false cambian posición. Exigir boardRevision consecutiva, robotRevision coherente y origen coincidente. Rechazos/duplicados no generan traslado. |
| PresentationViewPublished v1, evento nuevo | presentation en action; app-output en publication | boardId, contexto, secuencia de publicación, observedTick, mundo completo mínimo, ensamblados y movimientos confirmados del tick con IDs de mensajes/revisiones. Copia inmutable, límites de 144 casillas y 16 robots/movimientos por tick. |

El agregado publicado no mezcla raíces causales ajenas: el loop emite con causas vacías explícitas y conserva IDs de origen como datos de diagnóstico. Confirmaciones de inicialización usan la causalidad normal de APP. Verificar presupuestos UTF-8/envelope/colas existentes; no ampliarlos silenciosamente.

Antes de disponer de mundo válido no se publica una escena operativa. Un hueco lógico en las revisiones falla visiblemente al propietario. Un hueco de muestreo del renderizador se recupera desde la proyección completa más reciente, sin inventar movimientos intermedios. Al cerrar, el controlador invalida la generación visual; las cargas tardías se liberan y no incorporan objetos al encuentro siguiente.

Productores existentes de NAV no cambian. Añadir un consumidor en una receta nueva cambia su manifiesto/rutas de replay; conservar navigation.fixture y sus recordings. Nueva receta presentation.fixture con revisión propia. No cambiar el formato ReplayRecording v1 ni presentar replays de distintas recetas como equivalentes.

## Reloj visual y movimiento: propuesta técnica

- Modo exacto: representar inmediatamente la última posición confirmada. Modo suave: transición desde la pose dibujada hacia la última confirmación, sin predicción.
- Duración inicial 120 ms a 1x, acotada por CD*50 ms y ajustada a la velocidad de reproducción. Para CD1, máximo 50 ms a 1x. No confundir este límite estético con tiempo lógico de tránsito.
- Una transición activa por robot. Confirmaciones recibidas en lote, saltos de revisión observada o reconstrucción de replay sincronizan con el último mundo completo; no mantienen colas visuales sin límite ni acumulan retraso.
- Pausa detiene el tiempo visual, incluidas transformaciones y animaciones. Cámara de inspección puede seguir operativa. Avance manual por operación/fase/tick sincroniza la pose exacta con la última publicación disponible; una fase anterior a publication aún conserva la vista publicada anterior.
- Al cerrar/reemplazar/reproducir, cancelar transiciones y reconstruir desde la proyección vigente. La duración visual, FPS y calidad no entran en la simulación ni alteran sus entradas.

Este reloj usa milisegundos/fracciones fuera del núcleo. El mundo sigue usando ticks y enteros; no migrar ENV para representar interpolación.

## Recursos y carga

Manifest visual estricto separado del catálogo, versionado con resourceId, ubicación local GLB, revisión/digest y sockets esperados. La fixture CAT-002 de presentación añade las referencias visuales de las piezas que hoy no tienen visual, conservando basic-v2 y sus demos. No requiere CAT-003.

Precargar los recursos de la escena visual con errores individualizados. Las piezas faltantes reciben marcador magenta y etiqueta; socket faltante recibe diagnóstico y marcador en una ubicación de diagnóstico, sin fingir encaje correcto. Ninguno cambia el equipamiento ni las posiciones reales. Pérdida del contexto WebGL se informa y permite reconstruir la vista desde los datos públicos.

Recursos compartidos son propiedad del gestor del adaptador: instancias independientes, referencias contabilizadas y liberación final de geometrías/materiales/texturas. No liberar recursos usados por otra instancia. Liberar también handlers, observadores de tamaño, loop gráfico y cargas tardías al cerrar. Ante context loss, liberar la generación gráfica y su renderer mientras el contexto está perdido; retirar su restauración automática. Restaurar el contexto y reconstruir explícitamente desde la vista pública evita disponer buffers antiguos dentro del contexto nuevo. La sesión lógica se conserva.

Optimización verificada: agrupar primitivas rígidas por material, conservando transformaciones y sockets; instanciar suelo y agrupar sus bordes. Geometrías/materiales pertenecen al gestor, matrices y montajes a cada robot. Rótulos con ID usan geometría y texturas propiedad de cada renderer. El limitador de FPS conserva el resto temporal entre callbacks de pantalla (60/90/144 Hz); no redondear el ritmo objetivo a múltiplos enteros de refresco.

Vite tiene root en tests/browser; configurar publicDir explícito para servir public/assets/presentation. No suponer que el public de la raíz ya se sirve. Modificación acotada del servidor; middleware JSONL existente conservado.

## Laboratorio y criterios

Pestaña Presentación 3D independiente que usa una sola sesión para las vistas 2D/3D comparadas. Reutilizar geometría, escenarios y agente NAV de prueba mediante una receta explícita. Controles: exacto/suave, pausa, paso/fase/tick/N ticks, velocidades, FPS de render, cámara/restablecer, sockets/IDs/posición lógica/rutas y leyenda de piezas; editar ensamblado solo antes de un encuentro nuevo.

Casos obligatorios: ruedas/orugas intercambiables; robots armados/desarmados; CD1/10/20/40; FIFO/duplicados/rechazos sin animación falsa; pausa a mitad de transición; avance previo a publication; tandas aceleradas; replay; dos sesiones aisladas; recursos/sockets ausentes; carga que termina tras cierre; pérdida/restauración de contexto gráfico; 12x12/16 robots; cambios de tamaño de viewport; ciclos de abrir/cerrar sin crecimiento persistente del contador de recursos tras calentamiento.

La misma receta y entradas produce la misma traza/proyección lógica con render 15/30/60 FPS, exacto/suave y calidad distinta. Comparar configuración visual separadamente: render no necesita producir píxeles idénticos entre GPUs. 60 FPS es objetivo medido en el equipo declarado, no garantía para todos los equipos.

## Referencias

- [Plan PRE-001](../workflow/presentation-3d-v1.md), [CAT-002](content-catalog-v2.md), [NAV v1](board-navigation-v1.md), [APP-001](application-lifecycle-v1.md).
- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
