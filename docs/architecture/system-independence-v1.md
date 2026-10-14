# Paquetes independientes — IND-001

Revisión: **1.0.0**, 14 de octubre de 2026. Implementación local autorizada en `codex/independent-systems`, desde main e05aac9. [Plan y evidencia](../workflow/system-independence-v1.md), [investigación previa](system-independence-proposal.md).

## Dónde vive el código

Todo continúa en **C:/dev/robots**. `packages/` contiene los paquetes del mismo repositorio; no hace falta abrir otra carpeta Git. Cada paquete tiene `package.json`, exports explícitos, configuración de tipos autónoma y fuentes propias. Sus tsconfig no heredan archivos fuera del paquete. npm workspaces enlaza sus nombres públicos. `src/` conserva entradas antiguas como reexports, sin una segunda implementación.

| Paquete | Responsabilidad | Dependencias de ejecución permitidas |
| --- | --- | --- |
| `system-api` | Actor, Publisher, mensajes, esquemas, fases y ProtocolError único | Ninguna |
| `values` | Copias inmutables, validación JSON, aritmética/RNG y geometría puros | system-api |
| `protocol` | DTO, esquemas y definiciones públicas por dominio/versión | system-api, values |
| `runtime` | Bus, catálogo, scheduler, sesión y traza | system-api, values |
| `navigation` | Estado propio del tablero y resolución de pasos | system-api, protocol, values |
| `presentation` | Proyección inmutable de los mensajes recibidos | system-api, protocol, values |
| `presentation-three` | Adaptador visual, recursos, movimiento y cadencia | protocol, Three.js |
| `content` | Validación y preparación puras de contenido | system-api, protocol, values |
| `application-host` | Preparación de sesión, permisos, ciclo de arranque y recursos externos | system-api, protocol, values, runtime, content |

Los actores NAV/PRE no importan runtime, host ni implementaciones de vecinos, directamente o a través de una biblioteca común. El host genérico recibe fábricas; las recetas del laboratorio seleccionan los actores y el adaptador que montan. `content` es una biblioteca pura, sin actor, estado compartido ni ciclo de vida: el host puede usarla para preparar datos antes de iniciar una sesión.

## Contratos públicos y estado privado

`World`, `Result`, `Step`, tablero y sus esquemas están en `@robots/protocol/navigation/v1`. Describen datos del dominio de navegación que pueden intercambiar múltiples implementaciones. No pertenecen al actor concreto. Presentación importa ese protocolo y construye su propia vista; no llama a navegación ni lee su estado.

Entradas comunes:

```typescript
import type { Actor, Publisher } from "@robots/system-api";
import type { World, Result } from "@robots/protocol/navigation/v1";
import type { View } from "@robots/protocol/presentation/v1";
```

El paquete protocol también contiene application/v1, content/v2 y presentation/manifest-v1. Sus subpaths públicos evitan depender de una implementación para resolver tipos o esquemas. Un protocolo compartido sigue siendo una dependencia semántica: modificarlo exige analizar productores y consumidores. Compartir su ubicación no cambia esa responsabilidad.

Los perfiles de copia anteriores se conservan: JSON del bus, datos enteros de navegación y datos enteros congelados de presentación mantienen restricciones, presupuestos y códigos de error propios. No se unificaron esas validaciones cambiando lo que aceptan.

## Autorización en el host

`MessageDefinition` contiene `type`, `version`, `kind` y `fields`. Las definiciones no enumeran fixtures ni conceden permisos de sesión. `Contract` añade `producers` con sus fases y, para comandos, `responsibleSystemId`.

El host usa `@robots/application-host/bindings`:

```typescript
import { bindNavigationContracts } from "@robots/application-host/bindings";

const contracts = bindNavigationContracts({
  navigationId: "navigation",
  requestProducers: [{ systemId: "decision-a", phases: ["decision"] }]
});
```

`decision-a` debe registrarse como participante en esa composición. Otro host puede autorizar `decision-b` sin editar navegación. El helper conserva el ID estable del actor actual, `navigation`, y sus fases originales; renombrar actores o soportar varias instancias dentro de la misma sesión queda fuera de este cambio.

`bindMessage` permite componer directamente otras definiciones y bindings. Toma una copia inmutable; modificar después los arrays del llamador no cambia los permisos. El runtime valida registro, fases, responsable y rutas antes de empezar. La barrera de inicialización/activación continúa usando mensajes diferidos.

La función histórica `navigationContracts()` de `src/navigation/contracts.ts` conserva el permiso de `navigation-agent-fixture` por compatibilidad con consumidores antiguos. Es un preset obsoleto del laboratorio que llama al binder del host; no forma parte de las definiciones neutrales ni de las dependencias del paquete navigation. Los consumidores migrados declaran sus permisos explícitamente.

## Existir sin un proveedor

Un contrato conocido puede tener `producers: []`. Esto permite instalar consumidores que permanecen esperando. Nadie puede emitirlo: un intento sigue rechazándose como `SOURCE_INVALID`. Un comando conserva su responsable único y una sola suscripción aunque no haya quien lo envíe. Productores desconocidos, fases inválidas y comandos sin responsable siguen siendo errores.

- Presentación puede inicializarse y activarse sin navegación instalada; mientras no recibe mundo, no publica una vista inventada.
- Navegación puede inicializar su tablero y publicar eventos sin consumidores. Con el comando vinculado a cero productores, espera órdenes sin necesitar un actor de decisión.
- Un productor alternativo puede aportar mensajes públicos conformes. Las pruebas alimentan presentación con datos sintéticos y comprueban revisiones, causalidad, duplicados, inmutabilidad y contradicciones.

El catálogo sigue fijo durante una sesión activa. Agregar proveedores requiere preparar otra composición. La independencia no elimina requisitos de datos de una receta: el host puede rechazar una preparación incompleta y un actor puede rechazar mensajes contradictorios.

## Comprobar independencia

Desde la raíz:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck:packages
npm run test:isolated
npm test
npm run typecheck
```

Para trabajar en un solo sistema:

```powershell
npm run typecheck --workspace @robots/navigation
npm test --workspace @robots/navigation
npm run typecheck --workspace @robots/presentation
npm test --workspace @robots/presentation
```

La prueba aislada crea carpetas temporales, copia únicamente el paquete y su cierre de dependencias declaradas, comprueba tipos con `--noEmit`, importa todas sus entradas públicas y ejecuta sus pruebas propias cuando las tiene. No copia el checkout ni crea enlaces hacia sus fuentes. Usa el compilador instalado como herramienta externa; las bibliotecas y tipos usados por los paquetes sí se copian. Para NAV/PRE comprueba además que importar al vecino falla por ausencia real del paquete. No demuestra una instalación desde un registro npm.

El control de arquitectura analiza imports, reexports, importaciones de tipos, subpaths, rutas relativas, dependencias declaradas y ciclos. Su lista de dependencias permitidas es independiente de package.json: declarar una dependencia indebida no permite usarla. Incluye controles negativos que deben detectar violaciones deliberadas.

## Compatibilidad y límites

La migración conserva nombres/versiones/payloads de mensajes y el montaje de las recetas existentes. Antes de extraer se registraron 17 casos APP/NAV/PRE, 26 ticks por caso, con hashes de la traza y observación completas; después se comparan esa referencia, avance mixto y replay con propietarios nuevos. Así se comprueban resultados, manifiesto, orden, fases, IDs y causalidad conjuntamente, sin regenerar la referencia desde la implementación nueva.

Los paquetes privados usan fuentes TypeScript locales con Node 24 y Vite dev. Se comprobó resolución, ejecución y tipos por separado. **No se ejecutaron builds ni se generaron JS/.d.ts de distribución**; empaquetado/publicación npm y comprobación de esos artefactos quedan pendientes de autorización. La comprobación de tipos no se presenta como compilación de distribución.

Se conserva el fallo global de sesión ante excepción de un actor o violación del protocolo. Procesos separados, reinicio de actores, aislamiento de fallos, hot-plug y rollback no fueron implementados. El adaptador Three.js requiere un entorno gráfico para dibujar; comprobar sus imports y tipos aisladamente no sustituye la ejecución WebGL en navegador.
