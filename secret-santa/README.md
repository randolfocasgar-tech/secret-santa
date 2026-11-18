# Amigo Secreto 🎁

Aplicación web para organizar intercambios de regalos (Secret Santa / amigo secreto) sin papelitos.
Una persona crea el intercambio, comparte un enlace, cada participante se une con su cuenta y deja sus
preferencias, y el sorteo se hace en el servidor. Cada quien descubre en privado a quién le regala.

**Stack:** Next.js 16 (App Router, Server Actions, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Auth + Postgres con RLS).

---

## Funciones

- Crear un intercambio: nombre, fecha de entrega, presupuesto y moneda, y un mensaje o reglas opcionales.
- Enlace de invitación con código difícil de adivinar (se puede regenerar; el anterior deja de funcionar).
- Registro e inicio de sesión con correo y contraseña.
- Unirse con nombre, ideas de regalo, gustos y cosas que se prefieren evitar. Una cuenta no puede unirse dos veces
  y no se repiten nombres dentro de un intercambio.
- El organizador puede participar o no, y unirse después.
- Panel del organizador: invitación, participantes (quitar), exclusiones, comprobación de viabilidad, sorteo,
  repetir/anular el sorteo, edición de datos y eliminación.
- Pantalla privada «Descubre a quién te tocó» con una tarjeta de regalo animada y el botón «Ver a quién me tocó».
- Perfil con preferencias de regalo por defecto (se copian al unirte a un intercambio).
- Lista «Mis intercambios».
- **Modo demostración** (claramente marcado): al crear el intercambio se pueden agregar 4 participantes ficticios
  «(demo)» para probar el sorteo con una sola cuenta. Nadie puede iniciar sesión como ellos y sus resultados no son
  visibles para nadie.

### Reglas del sorteo

- Mínimo 3 participantes. Nadie se regala a sí mismo. Cada persona regala a exactamente una y recibe de exactamente una.
- El sorteo se ejecuta **en la base de datos** (función `draw_exchange`) y se guarda en la tabla `assignments`.
  Actualizar la página no cambia el resultado.
- **Exclusiones**:
  - *En ambas direcciones (⇄)*: ninguna de las dos personas le regala a la otra (ideal para parejas).
  - *En una sola dirección (→)*: la primera no le regala a la segunda, pero la segunda sí podría regalarle a la primera.
- Si las exclusiones hacen imposible el sorteo, se muestra un mensaje claro (por ejemplo, «Caro no puede regalarle a
  nadie») y el botón se deshabilita hasta corregirlas. Las restricciones nunca se ignoran.
- Algoritmo: emparejamiento perfecto en un grafo bipartito (caminos aumentantes), que siempre encuentra una solución
  si existe, seguido de intercambios aleatorios válidos para que el resultado sea aleatorio. Usa el generador
  criptográfico de `pgcrypto`.
- Concurrencia: la función bloquea la fila del intercambio (`SELECT … FOR UPDATE`). Dos solicitudes simultáneas
  (doble clic, dos pestañas) producen un solo sorteo; la otra recibe «El sorteo ya se realizó». Una persona que intenta
  unirse durante el sorteo espera y luego es rechazada.
- Tras el sorteo, los participantes y las exclusiones quedan bloqueados (también por triggers en la base de datos).
  Las preferencias de regalo sí pueden seguir actualizándose.
- Repetir o anular el sorteo exige marcar una confirmación explícita y avisa que los resultados anteriores se
  invalidan. Se valida la versión del sorteo para que un doble clic no provoque dos re-sorteos.

### Privacidad y acceso

- Cada participante solo puede consultar **su propia** asignación (`get_my_assignment` usa `auth.uid()`; la política
  RLS de `assignments` solo devuelve la fila donde la persona es quien regala).
- El organizador no tiene ninguna pantalla, endpoint ni función que liste las asignaciones.
- La lista de asignaciones nunca se envía al navegador. El nombre y las preferencias de tu destinatario solo se piden
  al pulsar «Ver a quién me tocó».
- Las preferencias de cada participante solo las ve esa persona y, tras el sorteo, quien le regala.
- Los enlaces de invitación solo sirven para unirse: muestran una vista previa (nombre, fecha, presupuesto, número
  de participantes), nunca participantes ni resultados.
- Los roles `anon` y `authenticated` no tienen permisos de escritura directa sobre las tablas (salvo editar su propio
  perfil); todo cambio pasa por funciones que validan sesión, permisos y estado.
- **Límites honestos:** esta privacidad no protege frente a quien administra la infraestructura o la base de datos
  (rol `postgres`, clave `service_role`, panel de Supabase), que puede leer cualquier tabla. Además, en grupos muy
  pequeños o con muchas exclusiones, las combinaciones posibles son pocas y alguien podría deducir parte del resultado
  (por ejemplo, con 3 personas, conocer tu propia asignación determina las demás).

---

## Estructura

```
src/
  app/
    page.tsx                         Inicio («Crear intercambio» / «Unirme»)
    (auth)/iniciar-sesion, registro  Autenticación
    auth/confirm/route.ts            Confirmación de correo (code o token_hash)
    unirme/ y unirme/[code]/         Unirse con enlace o código
    intercambios/                    Mis intercambios
    intercambios/nuevo/              Crear intercambio
    intercambios/[id]/               Detalle + mis preferencias
    intercambios/[id]/organizar/     Panel del organizador
    intercambios/[id]/mi-amigo-secreto/  «Descubre a quién te tocó»
    perfil/                          Preferencias por defecto
    actions/                         Server Actions
  components/                        UI accesible (diálogos nativos, formularios, alertas)
  lib/                               Supabase, acceso a datos, validación, formato
  proxy.ts                           Refresco de sesión y redirección de rutas protegidas
supabase/
  migrations/                        Esquema, RLS, funciones del sorteo
  templates/confirmation.html        Correo de confirmación en español
  config.toml                        Configuración para la CLI local
tests/
  db/                                Pruebas de base de datos (sorteo, privacidad, concurrencia)
  e2e/                               Prueba de punta a punta con Playwright
```

---

## Instalación y ejecución local

Requisitos: Node.js 20.9+ (probado con 22) y npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

### Opción A: Supabase local con la CLI (requiere Docker)

```bash
npx supabase start
```

La CLI aplica `supabase/migrations` automáticamente y muestra la URL de la API y la clave *publishable*
(o *anon*). Cópialas en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave publishable o anon>
SITE_URL=http://localhost:3000
```

En local la confirmación de correo está desactivada (`enable_confirmations = false`); los correos se pueden ver en
Mailpit (`http://127.0.0.1:54324`).

```bash
npm run dev
```

Abre http://localhost:3000.

### Opción B: proyecto de Supabase en la nube

1. Crea un proyecto en https://supabase.com.
2. Aplica la migración: con la CLI (`npx supabase link --project-ref <ref>` y luego `npx supabase db push`) o pegando
   el contenido de `supabase/migrations/20261118000000_secret_santa.sql` en el SQL Editor.
3. En **Project Settings → API**, copia la URL y la clave *publishable* (o *anon*) a `.env.local`.
4. En **Authentication → URL Configuration**:
   - *Site URL*: la URL pública de tu app (por ejemplo, `https://tu-app.vercel.app`).
   - *Redirect URLs*: agrega `https://tu-app.vercel.app/auth/confirm` (y `http://localhost:3000/auth/confirm` para
     desarrollo).
5. Recomendado: en **Authentication → Email Templates → Confirm signup**, usa el contenido de
   `supabase/templates/confirmation.html`. Ese enlace (`token_hash`) funciona aunque el correo se abra en otro
   dispositivo. Con la plantilla por defecto también funciona, pero solo en el mismo navegador donde se hizo el registro.
6. Para producción configura un SMTP propio (Authentication → SMTP): el servicio de correo incluido tiene un límite
   muy bajo de envíos por hora.

> La app **no** usa la clave `service_role`/secret. No la pongas en las variables de entorno.

### Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Clave pública *publishable* (o `NEXT_PUBLIC_SUPABASE_ANON_KEY` en proyectos antiguos). Se incrusta al compilar. |
| `SITE_URL` | Recomendada | URL pública, usada en enlaces de invitación y correos. Si falta, se deduce de la petición. |
| `TEST_DATABASE_URL` | Solo pruebas | PostgreSQL con superusuario para `npm run test:db` y `npm run test:e2e`. |

---

## Comprobaciones y pruebas

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

Pruebas unitarias de validación, formato, enlaces y mensajes de error.

```bash
npm run test:db
```

Aplica las migraciones reales sobre un PostgreSQL (≥ 15) con una réplica mínima del entorno de Supabase
(`tests/db/supabase-stub.sql`: roles `anon`/`authenticated`, `auth.uid()`, permisos por defecto) y ejecuta cada
operación como lo hace PostgREST (`SET LOCAL ROLE` + claims del JWT). Cubre:

- 3 a 40 participantes en cientos de sorteos: nadie se asigna a sí mismo, sin destinatarios repetidos, todos dan y reciben.
- Exclusiones en ambas direcciones y en una sola, parejas múltiples, restricciones imposibles y su corrección.
- Privacidad: el organizador (participe o no) no puede ver asignaciones ajenas; personas ajenas y sin sesión no
  pueden leer nada; no se pueden invocar las funciones internas ni escribir directamente en las tablas.
- Concurrencia: 10 sorteos simultáneos → uno solo; re-sorteos simultáneos → uno solo; unión durante el sorteo →
  rechazada; doble clic en «Unirme» → una sola participación.
- Bloqueo tras el sorteo y confirmación obligatoria para repetir o anular.

```bash
npm run test:e2e
```

Prueba de punta a punta con Playwright (Chromium) y varios usuarios: registro, creación, invitación, unión,
exclusiones imposibles y su corrección, sorteo con doble clic, revelado (incluye reducción de movimiento),
resultado estable al recargar, accesos indebidos y repetición con confirmación. Guarda capturas en
`tests/e2e/screenshots/`.

> **Nota sobre la E2E:** para poder ejecutarse sin Docker, usa `tests/e2e/mini-supabase.mjs`, un **emulador de
> pruebas** del subconjunto de las APIs HTTP de Supabase Auth y PostgREST que usa la app, sobre PostgreSQL real con
> las migraciones y RLS reales. No forma parte de la app. Para validar contra Supabase real, sigue la opción A o B y
> recorre el flujo manualmente.

Todo junto (excepto E2E):

```bash
npm run check
```

---

## Despliegue (Vercel u otro host de Node.js)

1. Aplica la migración al proyecto de Supabase de producción (ver opción B).
2. Configura en el host `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SITE_URL`.
   Las variables `NEXT_PUBLIC_*` se incrustan durante el build: si cambian, vuelve a desplegar.
3. Despliega (en Vercel: importa el repositorio; el comando de build es `npm run build`).
4. Actualiza *Site URL* y *Redirect URLs* en Supabase con el dominio final.

Otros hosts: `npm run build` y `npm start` (puerto 3000 por defecto).

---

## Decisiones de esta primera versión

- Sin pagos, chat ni notificaciones por correo de los resultados: cada persona entra a su cuenta para verlos.
- Máximo 200 participantes por intercambio.
- Los datos del intercambio (nombre, fecha, presupuesto, reglas) pueden editarse después del sorteo; los participantes
  y las exclusiones no.
- No hay recuperación de contraseña en la interfaz; puede añadirse con `supabase.auth.resetPasswordForEmail`.
