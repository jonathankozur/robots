# Decisiones y habilitación

Revisión documental: **1.0.0**. Fecha: **9 de octubre de 2026**.

## Base aprobada

La autorización humana de implementar el plan «Protocolo de agentes y arquitectura de mensajería v1» aprueba la creación de esta base documental. No se interpreta como aprobación de mecánicas tentativas del GDD, del bus ejecutable ni de tareas de implementación del juego.

| Decisión | Consecuencia |
| --- | --- |
| Sistemas especializados pequeños dentro del mismo proceso | Estado propio y fronteras por mensajes; sin transporte distribuido inicial. |
| Simulación determinista por ticks con fases | Reloj lógico y entrega diferida; presentación desacoplada del ritmo de simulación. |
| Datos recibidos mediante mensajes | Vistas locales limitadas, actualizadas por contratos explícitos; sin consultas directas a otro sistema. |
| Persistencia en puntos seguros entre encuentros | Snapshots coherentes y confirmados; no se reanuda una batalla a mitad. |
| GitHub público | Preparar revisión cruzada y protecciones cuando existan repositorio y colaboradores. |
| Plan breve aprobado antes de implementar | Aprobación específica del alcance, sin renovarla para acciones ya autorizadas. |
| Revisión humana en cada PR | Otro desarrollador aprueba; las revisiones de agentes son complementarias. |
| Primera entrega: documentación y skills | Sin scripts de control, motor, bus, pruebas de juego ni tareas nuevas. |

El GDD original permanece en [diseno_autobattler_robots.md](../diseno_autobattler_robots.md). Sus propuestas de cantidades, IA, componentes y progresión conservan sus estados originales.

## Requisitos pendientes

| Requisito | Evidencia necesaria para habilitarlo |
| --- | --- |
| Motor y lenguaje | Decisión humana documentada con consecuencias sobre aislamiento, pruebas e integración. |
| Aritmética, precisión, frecuencia de ticks y algoritmo aleatorio | Especificación aprobada del entorno determinista soportado y de sus pruebas. |
| Bus y scheduler v1 | Revisión técnica específica de [mensajería](architecture/messaging-v1.md), contratos y escenarios de aceptación. |
| Controles ejecutables | Implementación y ejecución demostrada de verificaciones de arquitectura, contratos y determinismo. |
| Git y repositorio compartido | Repositorio real, rama base, colaboradores identificados y checkouts separados. |
| Protecciones de GitHub | Configuración comprobada y demostración de que un cambio sin aprobación o verificaciones no se integra. |
| Base de datos | Elección humana y definición de snapshots, almacenamiento, migraciones y operaciones permitidas. |
| Multiplayer | Autoridad, sincronización, autenticación y protocolo externo. La base solo fija el límite del adaptador. |

El primer desarrollo de infraestructura, una vez elegida la tecnología, debe hacer ejecutables los contratos y escenarios del bus. Los sistemas de gameplay se habilitan después de aprobar y verificar esa infraestructura. Esto evita exigir pruebas del bus antes de permitir construir el propio bus.

La prohibición de builds permanece vigente. Si el motor exige compilar para una prueba, esa verificación queda pendiente hasta que el humano autorice explícitamente una excepción; no se la declara exitosa ni se sortea mediante otro comando.

## Registro de decisiones posteriores

Cada decisión posterior debe conservar: identificador, fecha, estado (propuesta/aprobada/sustituida), aprobación humana, contexto, alternativas y consecuencias, sistemas y contratos afectados, y referencia a la decisión que sustituye si corresponde. Una propuesta o un recuerdo del agente no es una aprobación.

## Estado de esta instalación

Al comenzar esta entrega, la carpeta contenía únicamente el GDD y no era un repositorio Git. La creación documental es el bootstrap expresamente solicitado. Las reglas de ramas, PR y controles quedan especificadas; su configuración remota no se realizó en esta entrega.
