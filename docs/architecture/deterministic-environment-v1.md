# Entorno determinista v1

Revisión: 1.0.0. Encargo aprobado [ENV-001](../workflow/deterministic-environment-v1.md), 13 de octubre de 2026. Infraestructura y fixtures, sin fórmulas de combate ni reloj autónomo.

## Contrato y propiedad

`SimulationEnvironment` es un contrato JSON inmutable declarado por el ensamblador mediante `SessionOptions.environment`. El constructor valida y copia sus datos; el entorno validado se incluye como `manifest.environment` al iniciar. `createSimulationEnvironment(seed, declarations, systems)` construye el perfil aprobado. `validateEnvironment(environment, systems)` rechaza otros perfiles, estados iniciales alterados, campos extra y valores que no sean datos, sin ejecutar getters.

| Campo | Valor v1 |
| --- | --- |
| version | 1 |
| tickRate | 20 |
| quantityScale / probabilityScale | 1000 / 10000 |
| numericProfile | safe-integer-v1 |
| damageRounding / durationRounding | floor / ceil |
| rngAlgorithm | xoshiro128**-1.1 |
| seedDerivation | fnv1a64-splitmix64-v1 |
| masterSeed | 16 dígitos hexadecimales minúsculos, explícitos |
| streams | Hasta 256 parejas únicas systemId/purpose y sus snapshots iniciales |

Cada propietario debe ser un sistema de simulación registrado, no un adaptador. Identificadores: 1..128 unidades UTF-16 bien formadas; no normalizar Unicode, caso ni espacios. Orden canónico: systemId y purpose, comparados con operadores JS, sin localeCompare. Rechazar duplicados, estados cero y colisiones detectadas de estados derivados entre parejas distintas. El dato completo queda sujeto al presupuesto de manifiesto de 1 MiB.

El ensamblador entrega a cada propietario su snapshot inicial como datos. Cada sorteo devuelve otro snapshot: el propietario sustituye su propio estado, nunca el de otro sistema. El bus conserva únicamente la declaración inicial para verificar el entorno; no administra RNG vivo ni restaura estado privado. Las utilidades no crean capacidades de publicación, inspección o avance.

## Tiempo y números

20 ticks/s equivale a 50 ms/tick. `msToTicks` admite milisegundos enteros no negativos y redondea hacia arriba; `ticksToMs` convierte ticks no negativos y comprueba desbordamiento. 125 ms → 3 ticks → 150 ms. Cero no permite reentrada: siguen vigentes las fases y entregas diferidas.

`parseScaledDecimal` admite texto decimal con signo negativo opcional y hasta tres decimales, sin exponentes, espacios, signo positivo, coma ni redondeo implícito. Ejemplo: `"12.345"` → 12345 unidades. La interfaz transforma entradas localizadas antes de usarlo. Probabilidades se pasan directamente como enteros de 0..10000 (12,5 % → 1250); los porcentajes de fórmulas pueden superar 100 % si su contrato lo permite. No usar el parser de cantidades como parser genérico de porcentajes.

`checkedInteger`, `checkedAdd`, `checkedSubtract` y `checkedMultiply` admiten enteros seguros Number y normalizan -0. `divideRounded(a,b,round)` exige divisor distinto de cero y redondeo explícito floor/ceil/trunc, incluidos operandos negativos. Calcula primero el resto y el cociente entero, evitando que la división flotante cerca de 2^53 oculte una fracción. `mulDiv` comprueba el producto antes de dividir: se rechaza un producto inseguro aunque el cociente final fuese pequeño. No hay saturación silenciosa ni BigInt en mensajes.

Daño no negativo se redondeará hacia abajo al finalizar su fórmula; este módulo no define esa fórmula ni sus atributos. Cada fórmula futura debe especificar unidades y cómo conservar fracciones entre operaciones. La presentación puede usar floats sin decidir la simulación.

## Semillas y extracciones

La semilla nunca se infiere de reloj, runtime, UUID o initialState. La clave exacta es UTF-8 del JSON del array `["env-v1", masterSeed, systemId, purpose]`. FNV-1a64: offset 0xcbf29ce484222325, prima 0x100000001b3, XOR byte antes de multiplicar, módulo 2^64. SplitMix64 usa incremento 0x9e3779b97f4a7c15 y mezclas con 0xbf58476d1ce4e5b9 y 0x94d049bb133111eb. Dos salidas sucesivas forman palabras baja/alta, baja/alta. BigInt solo realiza esta preparación exacta de 64 bits.

`RngSnapshot`: version 1, algorithm xoshiro128**-1.1, cuatro words uint32 no todas cero, draws entero seguro no negativo. El entorno solo admite estados iniciales derivados con draws=0. `rngSnapshot(words,draws)` permite copiar/validar un snapshot retenido; no implementa almacenamiento ni captura de checkpoints.

`nextU32(state)` devuelve `{value,state}` congelado. La versión 1.1 utiliza la segunda palabra para la salida; no usar la revisión histórica 1.0. Operaciones uint32 explícitas con Math.imul, shifts y rotación. No se modifica el snapshot de entrada.

`nextInt(state,min,maxExclusive)` admite 0 ≤ min < maxExclusive ≤ 2^32. Rechaza muestras ≥ `2^32 - (2^32 % width)` antes de aplicar módulo; cada descarte avanza el estado y draws. `chance(state,threshold)` compara `nextInt(state,0,10000)` con threshold incluso para 0 o 10000. Argumentos inválidos no devuelven estado avanzado. Una decisión válida conserva su consumo aunque otra autoridad rechace luego la intención.

Sorteos solo en decisiones lógicas del propietario. Render, logs, diagnóstico y comparación no extraen de sus streams vivos. Secuencias distintas son reproducibles e independientes respecto del consumo y orden de registro; la derivación por hash no constituye una garantía matemática de segmentos sin solapamiento.

## Fallos y compatibilidad

Errores tipados ProtocolError: NUMERIC_INVALID, NUMERIC_OVERFLOW, RNG_INVALID, RNG_EXHAUSTED y ENVIRONMENT_INVALID. Los helpers puros lanzan sin modificar la entrada. Un error no resuelto que sale del callback falla la sesión mediante la política existente. Capturarlo para resolver un rechazo de negocio es responsabilidad del propietario; no constituye rollback de mutaciones previas.

El entorno es opcional exclusivamente para compatibilidad con el núcleo/fixtures previos. Ausencia conserva el manifiesto anterior; no certifica el perfil numérico o RNG. No usar esa ausencia en los futuros consumidores de ENV-001. No completar defaults desde una grabación antigua.

ReplayRecording sigue en v1. Ausencia/presencia, semilla, streams o perfil distintos son incompatibles; la comparación estricta conserva runtime, revisión, estado inicial, catálogo y límites. Un perfil no soportado se rechaza como ENVIRONMENT_INVALID antes de iniciar. No hay migración automática ni importador de replay entre runtimes.

## Consumidores, alternativas y verificación

| Productor/consumidor | Impacto |
| --- | --- |
| Ensamblador | Construye perfil, declara streams y entrega datos iniciales a propietarios |
| Session / manifiesto / debug | Valida y conserva declaración inicial; no administra estado RNG vivo |
| Replay | Mantiene formato e igualdad estricta; añade entorno cuando está declarado |
| Fixtures anteriores / editor manual del bus | Sin environment; conservan conducta y manifests |
| Fixture Alpha/Beta/Observador y panel ENV-001 | Consumidores nuevos del perfil, con estado privado y mensajes |
| Gameplay / persistencia / red | Todavía no implementados; requieren contratos y encargos posteriores |

Frente a ticks variables, 20 Hz fijo facilita reproducción y cuantiza duraciones a 50 ms; su rendimiento con combate real queda pendiente. Frente a floats o BigInt permanente, enteros escalados mantienen JSON y operaciones simples, a cambio de presupuestos de rango explícitos. Frente a RNG global, streams por propietario/propósito evitan que un sistema cambie sorteos ajenos, a cambio de conservar más snapshots. El entorno opcional mantiene las fixtures anteriores; volverlo obligatorio rompería sus manifiestos sin aportar datos válidos a sus grabaciones históricas.

La evidencia `robots-environment-evidence-v1` compara configuración lógica completa (incluido manifiesto sin su campo runtime), cálculos, estados y entradas de traza. Runtime se conserva separado en el reporte. Esto es un comparador de fixture, no una modificación del loader de replay. Ver guía y entrega ENV-001 para versiones efectivamente verificadas; no extrapolar a otros navegadores, Electron ni gameplay.

Referencias primarias: [xoshiro128**](https://prng.di.unimi.it/xoshiro128starstar.c), [SplitMix64](https://prng.di.unimi.it/splitmix64.c), [FNV-1a — RFC 9923 informativa](https://www.rfc-editor.org/rfc/rfc9923.html). Vectores independientes conservados en tests/core/reference-vectors.json; generador/oráculo Python en reference-vectors.py.
