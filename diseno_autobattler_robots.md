# Proyecto de videojuego: Auto-battler de robots modulares

> **Documento de diseño conceptual (GDD) — Versión 0.1**  
> **Fecha:** 9 de octubre de 2026  
> **Estado:** borrador de trabajo. Incluye el concepto planteado por los creadores y propuestas para debatir; **no** todas las mecánicas están aprobadas.

---

## 1. Visión general

Un videojuego de **combate táctico automático sobre un tablero hexagonal**, protagonizado por **robots construidos a partir de componentes intercambiables**.

El jugador crea y mantiene un escuadrón de robots en su hangar. Cada robot combina un chasis, una unidad de movilidad, un núcleo energético, un módulo de IA, armas y otros sistemas. Las partes definen **estadísticas, capacidades, limitaciones y comportamiento**.

La experiencia gira alrededor de tres actividades relacionadas:

1. **Construcción:** conseguir piezas, combinarlas y diseñar robots con funciones específicas.
2. **Estrategia previa:** elegir el equipo, configurar su equipamiento y posicionarlo en un campo hexagonal.
3. **Expediciones de farmeo:** recorrer rutas ramificadas de combates y eventos, al estilo *Slay the Spire*, para obtener partes y progresar.

La premisa fundamental es que **las batallas se resuelven automáticamente**. La habilidad del jugador se expresa principalmente **antes** del combate: diseño de máquinas, sinergias del equipo, posicionamiento y, quizás, directivas de conducta.

### 1.1. Diferenciación buscada

El protagonista no es un catálogo cerrado de personajes como en muchos auto-battlers. **El jugador construye sus propias unidades.** Dos robots de aspecto o estadísticas similares podrían combatir de forma muy distinta según sus armas, su movilidad, su IA o su función dentro del equipo.

### 1.2. Principios de diseño propuestos

- **Decisiones significativas:** una pieza debe cambiar lo que el robot *puede hacer*, no limitarse siempre a sumar números.
- **Combate legible:** el jugador debe poder entender por qué ganó o perdió.
- **Profundidad emergente:** distintas combinaciones de piezas y módulos producen estrategias nuevas.
- **Personalización visible:** equipar partes cambia, en la medida de lo posible, el aspecto del robot.
- **Progresión gratificante:** una expedición más profunda supone más riesgo y mejores oportunidades de recompensa.
- **Sin microgestión:** las acciones se ejecutan automáticamente durante la batalla.

---

## 2. Bucle principal de juego

```text
HANGAR
  ↓ Construir y equipar robots
PREPARACIÓN DE EXPEDICIÓN
  ↓ Elegir escuadrón
MAPA DE RUTAS
  ↓ Elegir un camino / nodo
PREPARACIÓN DEL COMBATE
  ↓ Observar enemigos y terreno, desplegar robots, definir directivas (opcional)
BATALLA AUTOMÁTICA
  ↓ Resultado
RECOMPENSAS Y/O DESGASTE
  ↓ Piezas, materiales, mejoras, reparaciones
SIGUIENTE NODO O RETIRADA
  ↓
FIN DE EXPEDICIÓN
  ↓ Gestionar botín, mejorar hangar y escuadrón
HANGAR
```

La decisión acerca de **qué se conserva al morir o retirarse** está abierta y será importante para el tono del farmeo.

---

## 3. Identidad física de los robots

### 3.1. Pregunta inicial

¿Los robots deberían ser humanoides, tanques, vehículos con ruedas, cuadrúpedos, drones flotantes u otra cosa?

### 3.2. Propuesta de dirección

**No limitarse a una sola silueta.** Utilizar **familias de chasis y locomoción** que permitan robots reconociblemente distintos, pero que compartan un sistema modular de piezas.

| Familia | Identidad jugable sugerida | Posibles debilidades |
|---|---|---|
| **Bípedo** | Flexible; diversas armas y maniobras | Menos especializado que otras opciones |
| **Orugas / tanque** | Blindaje, estabilidad, armamento pesado | Giro y desplazamiento restringidos |
| **Cuadrúpedo** | Agilidad, persecución y adaptación al terreno | Menor resistencia o carga que un tanque pesado |
| **Ruedas** | Alta velocidad en terreno favorable | Dificultad con obstáculos o terrenos irregulares |
| **Flotante / propulsado** | Movilidad especial, evasión y rutas alternativas | Fragilidad, consumo energético o limitaciones de carga |

**Decisión de diseño pendiente:** determinar si la locomoción es una pieza independiente del chasis, una familia fija de chasis o un híbrido. Es recomendable que **no todas las combinaciones sean compatibles**.

### 3.3. Representación visual

Cada pieza equipada debería reflejarse en el modelo siempre que resulte viable: cañones visibles, placas de blindaje, propulsores, sensores, sistemas defensivos, ruedas o patas. La apariencia debe comunicar capacidades sin necesidad de abrir una ficha.

Si se emplean modelos 3D, conviene definir puntos de montaje comunes por familia de chasis y tamaños normalizados para evitar una explosión de combinaciones artísticas difíciles de mantener.

---

## 4. Anatomía modular de un robot

Se propone organizar el equipamiento en **ocho categorías principales**.

| Categoría | Qué determina | Ejemplos de atributos o capacidades |
|---|---|---|
| **Chasis** | Arquitectura, resistencia, tamaño y slots | Integridad, armadura base, carga máxima, cantidad/tipo de montajes |
| **Núcleo energético** | Presupuesto energético y alimentación de sistemas | Potencia disponible, reserva, recarga, sobrecarga |
| **Módulo de IA** | Cómo decide y ejecuta acciones automáticas | Selección de objetivos, distancia preferida, actitud ofensiva/defensiva |
| **Locomoción** | Desplazamiento y navegación | Velocidad, evasión, capacidad de giro, interacción con terreno |
| **Armas** | Ataques y presión ofensiva | Daño, cadencia, alcance, perforación, área, estados |
| **Defensas** | Supervivencia y protección | Blindaje, escudos, resistencias, mitigación, interceptación |
| **Sensores** | Percepción y adquisición de objetivos | Precisión, alcance de detección, identificación de amenazas |
| **Utilidad** | Soporte, control y funciones especiales | Reparación, interferencia, buffs, trampas, control de posición |

### 4.1. El chasis como arquitectura, no solo como estadística

Un chasis debería determinar:

- Cantidad y naturaleza de slots (armas ligeras/pesadas, defensa, utilidad, etc.).
- Peso o capacidad de carga total.
- Integridad y perfil defensivo inicial.
- Tamaño/ocupación en el tablero, si finalmente se adopta esa regla.
- Movilidades compatibles y eventualmente restricciones de terreno.

**Ejemplo ilustrativo: Chasis Bastión (pesado)**

| Parámetro | Valor ilustrativo |
|---|---:|
| Integridad base | 1.200 |
| Carga máxima | 80 |
| Movilidad base | 2 |
| Slots de núcleo / IA / locomoción | 1 / 1 / 1 |
| Slots de armas | 2 |
| Slots de defensa | 2 |
| Slots de sensor | 1 |
| Slots de utilidad | 1 |

**Importante:** estos valores no están balanceados ni implican un diseño aprobado. Un chasis ligero podría sacrificar defensa y carga para obtener velocidad y más slots de utilidad; uno ofensivo podría disponer de más montajes de armas.

### 4.2. Núcleo energético: compromiso de ingeniería

En lugar de permitir que cualquier robot instale todas las mejores piezas, el núcleo impone un **presupuesto de potencia**. Ejemplo hipotético:

- Potencia disponible: **100**.
- Cañón pesado: requiere **45**.
- Escudo energético: requiere **35**.
- Motor de alta velocidad: requiere **30**.
- Total requerido: **110** → configuración inválida o penalizada, según la regla que se elija.

El jugador deberá mejorar el núcleo o cambiar componentes. El **límite de peso/carga** puede funcionar como una segunda restricción.

**Mecánica opcional futura:** calor. Las armas y núcleos podrían acumular temperatura, sufrir penalizaciones de cadencia o activar enfriamiento. **Recomendación para prototipo:** no añadir calor hasta comprobar la diversión con potencia y carga, para no sobrecargar el balance.

### 4.3. Módulo de IA: identidad del comportamiento

El módulo de IA **no necesita ejecutar una red neuronal real**. Puede ser un conjunto reproducible de reglas, prioridades y estados que determinen sus decisiones.

**Ejemplo: mismo robot físico, distintas IA**

| Aspecto | IA Cazadora | IA Centinela |
|---|---|---|
| Objetivo | Enemigos vulnerables o aislados | Amenazas cercanas a aliados |
| Movimiento | Flanquear, perseguir | Mantener zona, cubrir flancos |
| Habilidad principal | Conseguir eliminaciones | Interrumpir y proteger |
| Riesgo asumido | Alto | Bajo o moderado |

Posibles arquetipos adicionales:

- **Artillera:** busca una buena posición de tiro y conserva distancia.
- **Interventora:** prioriza interrumpir ataques peligrosos.
- **Soporte:** mantiene alcance de reparación y protege unidades clave.
- **Hostigadora:** busca objetivos aislados y evita quedarse trabada.
- **Táctica:** responde a amenazas situacionales con reglas más complejas.

Para que estas IA sean componentes interesantes, deberían influir de forma **observable y consistente** sobre el resultado de las batallas.

### 4.4. Sensores y sistemas auxiliares

Los sensores deberían poder introducir nuevas capacidades, no solamente precisión: detectar objetivos ocultos, fijar blancos a mayor distancia, identificar enemigos heridos o habilitar ataques indirectos con armas compatibles.

Los sistemas de utilidad pueden crear roles enteros: reparación, interferencia electrónica, mejora de aliados, generadores de cobertura o redes de detección.

---

## 5. Sistema de estadísticas

### 5.1. Estadísticas base tentativas

El conjunto exacto debería ser **lo bastante pequeño para ser entendible** pero permitir diferencias tácticas reales.

| Estadística | Uso |
|---|---|
| Integridad (HP) | Daño que soporta antes de quedar destruido |
| Armadura | Mitigación de ciertos daños |
| Escudo | Absorción defensiva con reglas distintas de la armadura |
| Daño | Poder del ataque o del arma |
| Cadencia / tiempo de recarga | Frecuencia de ataque |
| Alcance | Distancia de ataque sobre hexágonos |
| Precisión | Probabilidad o efectividad de impactar, si se usa ese sistema |
| Velocidad de movimiento | Hexágonos recorridos por unidad de tiempo o turno |
| Evasión | Capacidad de evitar ataques, si se incorpora |
| Potencia disponible / consumida | Restricción de construcción o recurso de batalla |
| Peso / carga | Restricción de equipamiento y potencial modificador de movilidad |

No conviene mantener estadísticas redundantes que el jugador no pueda interpretar. Por ejemplo, **precisión y evasión** deberían existir únicamente si se diseña claramente su interacción.

### 5.2. Qué aporta cada parte

Una pieza puede tener tres capas de valor:

1. **Estadísticas numéricas:** más vida, daño, armadura, alcance, etc.
2. **Mecánica propia:** escudo regenerativo, ataque en área, reparación, empuje, detección.
3. **Interacciones/sinergias:** ventajas al combinarla con otras piezas o unidades.

**Meta de diseño:** evitar que todas las piezas sean simples sumandos. Un módulo que habilita disparos indirectos puede ser más valioso estratégicamente que uno que agrega daño bruto.

---

## 6. Tipos, rarezas y progresión del equipamiento

Separar tres dimensiones distintas:

- **Tipo / función:** qué hace la pieza (láser, misil, escudo, orugas, reparación, IA Cazadora, etc.).
- **Rareza:** cuán excepcional es la pieza y qué rango de atributos o efectos adicionales puede tener.
- **Nivel tecnológico / tier:** qué tan avanzada es y en qué punto de la progresión suele obtenerse.

La rareza no tiene por qué equivaler automáticamente a «más fuerte en todo». Una pieza común de nivel tecnológico alto podría superar en números a una legendaria de nivel bajo, mientras la legendaria mantiene una propiedad especial.

### 6.1. Escala tentativa de rareza

Común → Poco común → Rara → Épica → Legendaria.

**Ejemplo puramente ilustrativo de arma:**

| Variante | Daño | Alcance | Potencia requerida | Propiedad |
|---|---:|---:|---:|---|
| Cañón de pulsos común | 85 | 3 | 20 | Ataque convencional |
| Cañón de pulsos épico | 108 | 3 | 23 | Puede perforar escudos |

### 6.2. Afijos y propiedades especiales

Opciones a investigar:

- Modificadores aleatorios dentro de rangos controlados.
- Propiedades únicas propias del modelo de pieza.
- Especializaciones según tipo de daño o función.
- Mejoras obtenidas mediante talleres y materiales.

**Riesgo:** una combinación de muchos afijos, tiers y rarezas puede dificultar enormemente el balance y hacer ilegibles las recompensas. Conviene comenzar con pocas variables y efectos inequívocos.

---

## 7. Sinergias y construcción de escuadrones

Las sinergias deberían surgir principalmente de la **función real de las piezas**, no solo de coleccionar componentes con una misma etiqueta.

| Combinación | Efecto propuesto |
|---|---|
| Arma eléctrica + conductor | Los disparos encadenan daño a objetivos cercanos |
| Orugas + estabilizador | Más precisión con armamento pesado |
| IA Centinela + escudo proyector | Intercepta ataques contra aliados protegidos |
| Sensor avanzado + misiles | Ataca objetivos detectados sin visión directa, si las reglas lo permiten |
| Piernas veloces + arma cuerpo a cuerpo | Bonificación al golpear tras desplazarse |
| Robot explorador + artillería aliada | Identificación de blancos a larga distancia |

### 7.1. Roles emergentes

Un mismo chasis podría transformarse en una unidad distinta cambiando sus partes:

- Tanque / protector.
- Francotirador / artillería.
- Asesino / perseguidor.
- Control de área.
- Reparador / soporte.
- Interferidor / neutralizador de sistemas.
- Explorador / detector de blancos.

Es deseable que existan **contraestrategias**: un equipo de largo alcance vulnerable a flanqueos, escudos fuertes contra cierto daño pero débiles frente a armas especializadas, unidades rápidas contrarrestadas por control de movimiento, etc.

---

## 8. Sistema de combate auto-battler

### 8.1. Regla central

**No se toman decisiones durante el combate en la concepción inicial.** El jugador diseña la configuración y el despliegue; la simulación ejecuta el enfrentamiento.

### 8.2. Fases

1. **Hangar:** ensamblar, equipar, comparar estadísticas y probar sinergias.
2. **Preparación de batalla:** conocer —en la medida que el diseño lo permita— terreno, enemigos y objetivos; elegir robots y ubicarlos.
3. **Directivas previas (opcional):** establecer una instrucción simple por robot.
4. **Combate automático:** cada robot percibe, selecciona objetivos, navega, ataca, se defiende y activa sistemas según sus reglas.
5. **Resultados:** victoria/derrota, daños, recompensas y explicaciones útiles.

### 8.3. Directivas antes del combate

Si se incorporan, deben ser **pocas, fáciles de interpretar y no obligatorias**. Ejemplos:

- Mantener posición.
- Atacar enemigos con menor integridad.
- Priorizar unidades de soporte.
- Proteger al aliado más cercano.
- Conservar distancia del enemigo.

**Distinción relevante:** la directiva define *qué se intenta conseguir*; el módulo de IA define *cómo* intenta conseguirlo. Un módulo básico y uno avanzado podrían ejecutar la misma directiva de formas distintas.

### 8.4. Lógica de simulación sugerida

Una arquitectura inicial podría ser:

1. Observar estado del combate (unidades visibles, distancias, obstáculos, cooldowns).
2. Evaluar prioridades definidas por la IA y la directiva.
3. Elegir objetivo.
4. Determinar si debe atacar, desplazarse, proteger o utilizar habilidad.
5. Resolver interacciones y actualizar estado.
6. Repetir hasta una condición de fin.

Es recomendable que la lógica sea **determinista para una misma semilla y estado inicial** o, como mínimo, reproducible: permitirá replays, depuración y mejor balance.

### 8.5. Legibilidad y velocidad

- Mostrar objetivos actuales y motivación básica de la IA al inspeccionar un robot.
- Señalizar alcances, disparos, bloqueos, estados y habilidades importantes.
- Permitir acelerar o repetir el combate más adelante.
- Registrar datos útiles: daño causado/recibido, protección, curación, eliminaciones, habilidades activadas.

---

## 9. Tablero hexagonal

### 9.1. Fundamentos

El combate ocurre en un tablero de **casillas hexagonales**. Las posiciones deben afectar realmente el resultado.

Posibles factores:

- Distancia y alcance medidos en hexágonos.
- Línea de visión.
- Obstáculos infranqueables o destructibles.
- Cobertura.
- Terrenos que alteren movilidad o precisión.
- Casillas de despliegue inicial.
- Bloqueo de paso por unidades (si se considera deseable).
- Altura, tamaño de unidad o ocupación de múltiples hexágonos (posibles ampliaciones futuras).

### 9.2. Ejemplo táctico

Un robot pesado ocupa la primera línea y bloquea un acceso; detrás se posiciona un robot de artillería; a un costado, una unidad de soporte se mantiene dentro del radio de reparación. Si el rival utiliza movilidad para rodear, la configuración puede fallar a pesar de tener más estadísticas.

### 9.3. Cuestiones a definir

- ¿Combate en tiempo real con pausas internas de IA, o en ticks/turnos simulados automáticamente?
- ¿Cuántas unidades admite un equipo?
- ¿Cuál es el tamaño del tablero?
- ¿Se conocen los enemigos antes de desplegar?
- ¿Existen condiciones de victoria más allá de destruir todas las unidades?
- ¿Cuánto debería durar una batalla promedio?

---

## 10. Expediciones de farmeo al estilo *Slay the Spire*

### 10.1. Concepto original

El jugador inicia una **run** y avanza por un mapa de rutas alternativas. Va peleando, farmeando y recolectando partes para equipar sus robots. **Cuanto más lejos llegue, mejores serán las recompensas.**

La ruta elegida puede influir en qué tipos de enemigos, piezas y riesgos encuentra.

### 10.2. Tipos de nodo propuestos

| Nodo | Qué sucede |
|---|---|
| **Combate** | Encuentro estándar; piezas y materiales |
| **Élite** | Encuentro más difícil; mejores recompensas |
| **Depósito / saqueo** | Selección de piezas entre distintas opciones |
| **Taller** | Reparar o mejorar componentes, quizá cambiar configuración |
| **Evento** | Decisión de riesgo/recompensa con consecuencias para la run |
| **Jefe** | Encuentro que obliga a revisar la composición y las contraestrategias |
| **Salida / retirada** | Finalizar anticipadamente y asegurar una parte del botín, si se adopta esa regla |

### 10.3. Recompensas

- Componentes completos equipables.
- Materiales de fabricación o mejora.
- Moneda del hangar o recursos de expedición.
- Esquemas/planos de tecnología, si se añade fabricación.
- Recompensas de mayor tier o mayor probabilidad de rareza al progresar.

### 10.4. Riesgo y desgaste

Para que elegir ruta importe, se consideran:

- Daño persistente entre encuentros.
- Reparaciones limitadas.
- Recursos consumibles de expedición.
- Decisión de retirarse con el botín o arriesgarse a seguir.
- Pérdida parcial, y no necesariamente total, de recompensas al morir.

**Pendiente especialmente importante:** concretar el modelo de retención del botín para que el jugador sienta progresión sin que el riesgo desaparezca.

### 10.5. Dos capas de progresión

**Progresión permanente (hangar):** inventario de piezas, colección de chasis, planos, desbloqueos y capacidades de fabricación o mejoras, según lo que se apruebe.

**Progresión de la run:** beneficios temporales, condiciones del mapa, botín todavía no asegurado y estado actual del escuadrón.

La propuesta inicial más coherente con la fantasía de ingeniería es que los **robots del hangar sean persistentes** y no se reconstruyan desde cero en cada expedición. Sin embargo, esta decisión todavía debe validarse.

---

## 11. Equilibrio y evitar el simple *stat-check*

### Problema a evitar

Si un robot veterano tiene diez veces más vida y daño que uno inicial, el equipamiento inteligente, la IA y el despliegue pueden volverse irrelevantes.

### Mecanismos posibles

- Fortalezas y debilidades específicas, no solo números crecientes.
- Contraarmas y sistemas defensivos especializados.
- Costos reales de carga, slots y consumo de potencia.
- Modos de combate que favorezcan composiciones diferentes.
- Enemigos con estrategias reconocibles.
- Retornos decrecientes en ciertas estadísticas si el balance lo requiere.
- Restricciones o normalización de equipamiento si eventualmente existe PvP.

**Principio de balance:** una configuración más costosa puede tener ventaja, pero no debería ser invulnerable a una estrategia bien diseñada.

---

## 12. Modos de juego: definidos y potenciales

### 12.1. Definido conceptualmente: farmeo PvE

Campaña o expediciones repetibles con mapa ramificado, encuentros automáticos, recompensas y progresión de componentes.

### 12.2. Potenciales, no confirmados

- **PvP directo:** escuadrones preparados por jugadores; requeriría reglas de equivalencia de poder y emparejamiento.
- **PvP asincrónico:** enfrentamiento contra configuraciones guardadas de otros jugadores.
- **Desafíos tácticos:** resolver un escenario con piezas limitadas o restricciones específicas.
- **Arena de pruebas:** combatir contra un escuadrón de referencia para comparar builds.

No se recomienda asumir que habrá PvP desde la primera versión. Sí conviene que el motor de combate pueda reproducir escenarios de forma consistente.

---

## 13. Prototipo mínimo jugable (vertical slice)

**Objetivo:** demostrar que el juego es divertido por **la preparación, la construcción y el posicionamiento** antes de desarrollar una gran progresión.

| Elemento | Alcance inicial sugerido |
|---|---|
| Combate | **3 vs. 3** |
| Chasis | **3** arquetipos distintos |
| IA | **3** comportamientos claramente diferentes |
| Componentes | Aproximadamente **30** piezas |
| Campo de batalla | **1** tablero hexagonal con obstáculos |
| Rutas | **1** mini-expedición de unos **10** nodos |
| Sistema de partes | Slots, restricciones de carga y energía |
| Equipamiento | Inspección y reemplazo de piezas en hangar |
| Recompensas | Botín básico + riesgo/recompensa simple |

Estas cantidades son **objetivos tentativos de prototipado**, no requisitos cerrados.

### 13.1. Primera prueba de diseño

Crear tres configuraciones de robots con estadísticas brutas similares pero distintas IA, movilidad o armas. Enfrentarlas a los mismos enemigos desde posiciones diferentes.

**Hipótesis a comprobar:** el resultado y el desarrollo del combate cambian sensiblemente por la construcción, las sinergias y el despliegue, no solo por el daño y la vida acumulados.

### 13.2. Orden sugerido de implementación

1. Hexágonos, movimiento, obstáculos, distancia y línea de visión.
2. Motor de combate reproducible: objetivos, ataques, daño y fin de batalla.
3. Chasis y sistema de slots/componentes.
4. IA diferenciadas y una primera interfaz para comparar decisiones.
5. Pantalla de hangar y despliegue.
6. Sistema de sinergias y habilidades especiales.
7. Generación del mapa de expedición, nodos y recompensas.
8. Progresión persistente, reparaciones y balance inicial.
9. Pulido visual, telemetría y experiencia de usuario.

---

## 14. Riesgos de diseño y mitigaciones

| Riesgo | Por qué importa | Posible respuesta |
|---|---|---|
| Exceso de combinaciones | Difícil balancear miles de builds | Familias de slots, costos y prototipos pequeños |
| Piezas que solo suman números | Poca profundidad táctica | Capacidades y sinergias funcionales |
| IA incomprensible | Las derrotas parecen arbitrarias | Comportamiento visible, directivas simples, replays |
| Interfaz de hangar compleja | Se tarda demasiado entre combates | Filtros, comparación de piezas, presets y alertas |
| Combates lentos de observar | El jugador no controla la acción | Ritmo ágil, velocidad acelerable y señales claras |
| Farmeo repetitivo | La progresión pierde sorpresa | Encuentros y mapas variados, objetivos y piezas distintas |
| Equipamiento muy superior | La estrategia deja de importar | Contraestrategias y límites de presupuesto |
| Producción artística costosa | Cada combinación de partes debe encajar | Estándares de chasis, sockets y módulos visuales |

---

## 15. Decisiones abiertas para la siguiente sesión de diseño

Se recomienda debatirlas **en este orden**, porque unas condicionan a las siguientes.

### A. Identidad de las unidades

1. ¿El chasis y la locomoción serán sistemas independientes o estarán vinculados?
2. ¿Cuántas familias visuales de robot habrá al lanzamiento?
3. ¿Cada chasis tendrá una arquitectura de slots diferente? **Propuesta recomendada: sí.**
4. ¿Los robots ocuparán siempre un hexágono o algunos serán más grandes?

### B. Arquitectura de componentes

5. ¿Cuáles de las ocho categorías serán obligatorias y cuáles opcionales?
6. ¿El presupuesto de energía solo valida la build o también se consume en batalla?
7. ¿Habrá restricciones de peso por locomoción?
8. ¿El calor se posterga para versiones futuras?
9. ¿Las piezas estarán ligadas a un robot o se intercambiarán libremente en el hangar?

### C. Combate

10. ¿Tiempo real o pasos discretos automatizados?
11. ¿3v3, 4v4, 5v5 u otro tamaño de escuadrón?
12. ¿Directivas antes de cada batalla, o solo IA equipada?
13. ¿Se podrá reposicionar todo el escuadrón entre nodos de una run?
14. ¿Qué objetivos alternativos existirán además de eliminar enemigos?

### D. Farmeo y progresión

15. ¿Los robots son permanentes entre runs? **Propuesta recomendada: sí.**
16. ¿Qué botín se conserva al abandonar una run y qué se pierde al morir?
17. ¿Hay reparaciones y daño persistente durante una expedición?
18. ¿Cómo se desbloquean nuevas tecnologías y chasis?
19. ¿Qué combinación de profundidad/rareza/tier determina la calidad del botín?

### E. Alcance y producto

20. ¿Inicialmente solo PvE o se proyecta PvP?
21. ¿PC, móvil o web como plataforma objetivo?
22. ¿Estética industrial realista, caricaturesca, low-poly u otra?
23. ¿Duración buscada de una batalla y de una run?

---

## 16. Ideas adicionales para explorar más adelante

Estas ideas **no forman parte del alcance comprometido** y solo deberían incorporarse cuando el núcleo ya sea divertido:

- Robots híbridos, drones auxiliares o unidades que ocupen varios hexágonos.
- Fabricación de piezas a partir de planos y materiales recuperados.
- Daño localizado: destruir armas, movilidad o sensores antes del chasis completo.
- Guerra electrónica y engaño de sensores.
- Sistemas de calor y refrigeración.
- Directivas más expresivas y programación limitada de IA.
- Ecosistemas de enemigos especializados que obliguen a revisar la build.
- Inventario de builds y plantillas compartibles.
- Replays y herramientas para estudiar decisiones del motor de combate.

---

## 17. Resumen de estado de las ideas

| Elemento | Estado |
|---|---|
| Robots como protagonistas | **Concepto original planteado** |
| Robots armados con partes intercambiables | **Concepto original planteado** |
| Chasis, IA, armas, defensa y movilidad | **Concepto original planteado** |
| Rareza y estadísticas provenientes de piezas | **Concepto original planteado** |
| Batallas automáticas en tablero hexagonal | **Concepto original planteado** |
| Estrategia basada en construcción y posicionamiento | **Concepto original planteado** |
| Farmeo en runs de caminos ramificados | **Concepto original planteado** |
| Recompensas mejores cuanto más lejos se llega | **Concepto original planteado** |
| Directivas previas de batalla | **Posibilidad planteada** |
| Múltiples siluetas y chasis con slots diferentes | **Propuesta para evaluar** |
| Núcleo energético, sensores y utilidad | **Propuesta para evaluar** |
| IA como componente de comportamiento | **Propuesta para desarrollar** |
| Sinergias funcionales entre piezas | **Propuesta para desarrollar** |
| Progresión persistente y botín parcial | **Propuesta para decidir** |
| PvP, daño localizado, calor avanzado | **Ideas futuras, no definidas** |

---

## 18. Visión en una frase

**Un auto-battler táctico de robots modulares donde la victoria se diseña en el hangar, se prepara sobre un tablero hexagonal y se financia mediante expediciones roguelite de farmeo.**

> **Próximo paso sugerido:** acordar la arquitectura de chasis y componentes, definir tres módulos de IA muy distintos y prototipar un combate automático 3v3 antes de expandir el contenido.
