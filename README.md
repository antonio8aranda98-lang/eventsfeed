# Eventsfeed

Centro de operaciones para eventos de fútbol de hasta 300 jugadores presentes. La web tiene acceso público por URL; los datos reales requieren un código de administrador, equipo o speaker.

## Flujo del evento

1. Antonio entra con su código y crea un evento con nombre, fecha y campo.
2. Importa el CSV de inscritos: en Google Sheets, **Archivo → Descargar → Valores separados por comas**. La importación permite revisar y asignar las columnas. También puede leer un enlace exportable sin autenticación. No es necesario hacer pública una hoja privada.
3. En **Check-in**, marca Asiste / No asiste para todos. Elige de 2 a 10 equipos y pulsa **Organizar equipos**. También puedes mover a un jugador manualmente después. Los nuevos jugadores entran como pendientes. Se pueden añadir y editar fichas manualmente.
4. En **Accesos de las tablets**, genera un código por equipo y otro para el speaker. Cada dispositivo abre la misma web e introduce su código. No necesita cuenta de ChatGPT.
5. Cada entrenador ve solo a los jugadores presentes de su equipo, registra comentarios, notas de 1 a 10 en Físico, Imagen, Técnico y Táctico, y una categoría recomendada. **Guardar valoración** la envía a la base compartida.
6. Los entrenadores registran goles, partidos sin encajar y noticias redactadas para megafonía. El speaker ve la cola y marca cada noticia como anunciada.
7. Antonio exporta un CSV con los resultados, cierra el evento y puede crear el siguiente conservando el histórico.

Las 11 categorías solicitadas están incluidas. La categoría de inscripción y la recomendada son campos distintos. Una valoración completa tiene cuatro notas y categoría; se pueden guardar valoraciones parciales.

## Campo 4-3-3 por equipo

En **Equipos**, Antonio selecciona una tarjeta de equipo y el entrenador accede directamente al suyo. El campo muestra los jugadores presentes compatibles con cada uno de los once puestos del 4-3-3. Tocar un nombre abre la misma ficha de valoración.

Es una vista de disponibilidad por puesto: un DFC aparece en ambos puestos de central, un MC/MCO en ambos interiores y una posición múltiple como `LI / EI` en ambos puestos. Las posiciones específicas, como `central izquierdo`, conservan su lado. Los jugadores con posiciones vacías o no reconocidas aparecen en **Posición por revisar**, donde se puede abrir la ficha y corregirlas. Las actualizaciones de posición, asistencia y equipo se reflejan con la sincronización habitual.

## Sincronización y permisos

- Actualización de datos desde el servidor cada **3 segundos**; requiere internet.
- El navegador no guarda registros reales en localStorage. Un formulario abierto conserva su borrador en memoria si falla el envío. No hay cola de escrituras sin conexión; no cierres la ficha o recargues hasta guardar.
- Los formularios de valoración requieren guardar explícitamente. La asistencia y el equipo se guardan al cambiar su selector.
- Control de versión en fichas y valoraciones para evitar sobrescribir cambios concurrentes. Las valoraciones acompañan al jugador al cambiar de equipo.
- El entrenador puede editar posición y dorsal. Antonio puede editar los datos de inscripción y la asignación.
- El speaker no recibe teléfonos, fichas personales ni comentarios de evaluación. Solo las noticias redactadas para anunciar.
- Códigos y sesiones almacenados con SHA-256; códigos aleatorios, cookies HttpOnly y SameSite=Strict, Secure en HTTPS, sesiones de 12 horas y límite de intentos de inicio de sesión. Renovar un código revoca las sesiones de ese equipo en el evento.
- El modo de ejemplo es ficticio, de solo lectura, y no utiliza los datos de la hoja de referencia.
- Importación adicional: omite coincidencias de nombre normalizado y año sin sobrescribir datos ni valoraciones. Si hay dos jugadores con el mismo nombre y año, añádelos manualmente con una distinción en el nombre.

## Desarrollo

Node.js >=22.13; las pruebas usan `node:sqlite` (Node 24 recomendado).

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Crea un `.dev.vars` **ignorado por Git** con `ADMIN_PASSWORD=<código largo y aleatorio>`. El administrador de producción se configura como secreto en el hosting, separado del archivo local.

Para aplicar el esquema a la base local, primero construye y ejecuta:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_public_rogue.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_damp_reaper.sql
npm run dev
```

El servidor se inicia en la URL local indicada por Vinext. La base local y la de producción son independientes.

## Arquitectura y publicación

React 19 + TypeScript, Vinext/Vite y Cloudflare Workers con D1. Las migraciones versionadas están en `drizzle/`; el esquema está en `db/schema.ts`; las operaciones y permisos en `lib/server.ts`. El código está preparado para GitHub; el servidor y la base compartida requieren un hosting que ejecute Workers. **GitHub Pages por sí solo no ejecuta este backend.**

La publicación inicial se gestiona con Sites. `.openai/hosting.json` conserva el identificador de la web y el binding `DB`. Los helpers de Sites empaquetan el build y publican las migraciones. GitHub conserva el código; un push a GitHub por sí solo no publica en Sites.

No se deben subir datos de jugadores, exportaciones, contraseñas ni `.dev.vars` al repositorio. La hoja de ejemplo solo se inspeccionó para reconocer cabeceras; no está copiada en este código.

## Validación

`npm test` ejecuta el servidor contra SQLite en memoria y comprueba acceso anónimo, permisos entre equipos/eventos, privacidad del speaker, persistencia de valoraciones, conflictos de edición, reasignaciones, renovación de accesos, cierre de eventos, importaciones y exportación CSV segura. El test solo usa jugadores ficticios.

## Icono de pantalla de inicio

El símbolo de campo y balón tiene versiones PNG opacas para iPhone/iPad (`apple-touch-icon`, 180 px), navegador (32 px) y otras instalaciones (192/512 px y versión maskable). El manifiesto define el nombre Eventsfeed y la apertura independiente. El SVG original está en `public/icons/eventsfeed-mark-v3.svg`; `node scripts/generate-icons.mjs` regenera las versiones PNG usando Sharp, disponible en el entorno del proyecto.

En un iPhone con un acceso anterior, elimina ese acceso y vuelve a añadir la dirección pública desde Safari → Compartir → Añadir a pantalla de inicio para que el acceso nuevo use el icono configurado.

## Organización automática por posiciones

Antonio confirma todas las asistencias, elige de **2 a 10 equipos** y pulsa **Organizar equipos**. La sugerencia usa aproximadamente 20 jugadores por equipo: 50 presentes → 3 equipos (17/17/16), 80 → 4 de 20 y 100 → 5 de 20. El número elegido siempre lo decide Antonio. No se aplica ningún reparto por sí solo al desplegar esta función.

El algoritmo de flujo de coste mínimo asigna a cada asistente exactamente una vez y fija tamaños con diferencia máxima de un jugador. Busca cubrir los once puestos del 4-3-3 con jugadores distintos, prioriza los porteros y penaliza acumular jugadores en un mismo puesto. Respeta posiciones específicas y usa a los polivalentes donde ayudan al reparto; conserva la posición original de la ficha. Se muestran puestos sin cubrir y posiciones desconocidas, cuyos jugadores se distribuyen por tamaño. El equilibrio se basa en posiciones y número de jugadores, sin asumir un nivel deportivo que no se haya evaluado.

El servidor comprueba que no queden asistencias pendientes, que el evento esté abierto y que la revisión del check-in siga vigente. Guarda todas las asignaciones y el número de equipos en una sola transacción. Si cambia la lista durante el cálculo o falla el guardado, no aplica un reparto parcial. La migración añade el número de equipos (4 por defecto para eventos existentes) y la revisión de la lista; no modifica jugadores ni valoraciones.

Los equipos nuevos tienen su propio acceso desde **Accesos de las tablets**. Los códigos y sesiones de los equipos eliminados se revocan; los de equipos que siguen existiendo se conservan. Se puede utilizar un móvil o una tablet por entrenador. Las valoraciones permanecen asociadas al jugador al reorganizar o moverlo manualmente.

`npm test` incluye pruebas de tamaños, cobertura, porteros escasos, polivalencia, concurrencia, rollback de la transacción, permisos, conservación de valoraciones y revocación de accesos. `node tests/local-smoke.mjs` prueba el flujo completo contra la base **local**, usando solo jugadores ficticios.
