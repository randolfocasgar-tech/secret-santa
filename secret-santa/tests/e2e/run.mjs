// Prueba E2E: levanta el emulador de Supabase (solo pruebas), arranca la app
// ya compilada (next start) y recorre el flujo completo con varios usuarios.
//
// Uso:  npm run test:e2e   (compila con las variables del emulador y ejecuta)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMiniSupabase } from "./mini-supabase.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3456);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const SHOTS = process.env.E2E_SCREENSHOTS ?? path.join(ROOT, "tests/e2e/screenshots");
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
/** Espera (hasta 8 s) a que el elemento sea visible. */
const visible = (locator) => locator.first().waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);

function check(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`);
  }
}

const supa = await startMiniSupabase();
const appEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supa.url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supa.anonKey,
  NEXT_PUBLIC_SITE_URL: BASE,
};
if (!process.env.E2E_SKIP_BUILD) {
  // Las variables NEXT_PUBLIC_* se incrustan al compilar: se compila con las del emulador.
  console.log("Compilando la app para la prueba E2E…");
  const build = spawn(process.execPath, [require.resolve("next/dist/bin/next", { paths: [ROOT] }), "build"], {
    cwd: ROOT,
    env: appEnv,
    stdio: "inherit",
  });
  const code = await new Promise((r) => build.on("exit", r));
  if (code !== 0) {
    await supa.close();
    process.exit(1);
  }
}
const NEXT_BIN = require.resolve("next/dist/bin/next", { paths: [ROOT] });
const app = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(APP_PORT), "-H", "127.0.0.1"], {
  cwd: ROOT,
  env: appEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
app.stderr.on("data", (d) => process.stderr.write(`[app] ${d}`));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

// Calentamiento: la primera petición a cada ruta tras arrancar puede ser lenta.
for (const route of ["/", "/registro", "/iniciar-sesion", "/unirme", "/unirme/codigo-de-prueba", "/intercambios"]) {
  await fetch(`${BASE}${route}`).catch(() => {});
}

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function newUser(name, opts = {}) {
  const context = await browser.newContext({ ...mobile, ...opts });
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    failures++;
    console.log(`  ✗ error de JavaScript en la página (${name}): ${e.message}`);
  });
  return { name, context, page, email: `${name.toLowerCase()}@ejemplo.test` };
}

async function register(u, startUrl = `${BASE}/registro`) {
  await u.page.goto(startUrl);
  await u.page.getByLabel("Tu nombre").fill(u.name);
  await u.page.getByLabel("Correo electrónico").fill(u.email);
  await u.page.getByLabel("Contraseña").fill("contraseña-segura");
  await u.page.getByRole("button", { name: "Crear cuenta" }).click();
}

async function joinViaInvite(u, inviteUrl, shot) {
  await u.page.goto(inviteUrl);
  await u.page.getByRole("link", { name: "Crear cuenta" }).last().click();
  await u.page.waitForURL(/\/registro/);
  await register(u, u.page.url());
  await u.page.waitForURL(/\/unirme\//);
  await u.page.getByLabel("Ideas de regalo").fill(`Un libro para ${u.name}`);
  await u.page.getByLabel("Gustos").fill(`Café (${u.name})`);
  await u.page.getByLabel("Prefiero evitar").fill(`Perfumes (${u.name})`);
  if (shot) await u.page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  await u.page.getByRole("button", { name: "Unirme al intercambio" }).click();
  await u.page.waitForURL(/\/intercambios\/[0-9a-f-]+\?bienvenida=1/);
}

async function reveal(u, exchangeId, shot) {
  await u.page.goto(`${BASE}/intercambios/${exchangeId}/mi-amigo-secreto`);
  await u.page.getByRole("button", { name: "Ver a quién me tocó" }).waitFor();
  const html = await u.page.content();
  await u.page.getByRole("button", { name: "Ver a quién me tocó" }).click();
  const heading = u.page.locator("h2[tabindex='-1']");
  await heading.waitFor({ timeout: 10_000 });
  const name = (await heading.textContent()).trim();
  if (shot) await u.page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  return { name, htmlBefore: html };
}

try {
  console.log("Inicio y registro del organizador");
  const org = await newUser("Olga");
  await org.page.goto(BASE);
  await org.page.screenshot({ path: path.join(SHOTS, "01-inicio.png"), fullPage: true });
  check(await visible(org.page.getByRole("link", { name: "Crear intercambio" })), "botón «Crear intercambio» en inicio");
  check(await visible(org.page.getByRole("link", { name: "Unirme" }).first()), "botón «Unirme» en inicio");

  await org.page.goto(`${BASE}/intercambios`);
  check(org.page.url().includes("/iniciar-sesion"), "ruta protegida redirige a iniciar sesión");

  await register(org);
  await org.page.waitForURL(/\/intercambios$/);
  check(await visible(org.page.getByText("Todavía no tienes intercambios")), "estado vacío de «Mis intercambios»");
  await org.page.screenshot({ path: path.join(SHOTS, "02-mis-intercambios-vacio.png"), fullPage: true });

  console.log("Crear intercambio (con validación)");
  await org.page.goto(`${BASE}/intercambios/nuevo`);
  await org.page.getByRole("button", { name: "Crear intercambio" }).click();
  check(await visible(org.page.getByText("Escribe un nombre para el intercambio.")), "errores de validación visibles");
  await org.page.getByLabel("Nombre del intercambio").fill("Navidad en familia");
  await org.page.getByLabel("Fecha de entrega de regalos").fill("2099-12-24");
  await org.page.getByLabel("Presupuesto por regalo").fill("500");
  await org.page.getByLabel("Mensaje o reglas").fill("Cena a las 8 pm.\nEnvuelve el regalo sin nombre.");
  await org.page.screenshot({ path: path.join(SHOTS, "03-crear-intercambio.png"), fullPage: true });
  await org.page.getByRole("button", { name: "Crear intercambio" }).click();
  await org.page.waitForURL(/\/organizar\?creado=1/);
  const exchangeId = org.page.url().match(/intercambios\/([0-9a-f-]+)\//)[1];
  const inviteUrl = await org.page.locator("#invite-url").inputValue();
  check(/\/unirme\/[A-Za-z0-9_-]{16}$/.test(inviteUrl), `enlace de invitación generado (${inviteUrl})`);
  await org.page.screenshot({ path: path.join(SHOTS, "04-panel-recien-creado.png"), fullPage: true });

  console.log("Participantes se unen con el enlace");
  const ana = await newUser("Ana");
  const beto = await newUser("Beto", { reducedMotion: "reduce" });
  const caro = await newUser("Caro");
  await ana.page.goto(inviteUrl);
  await ana.page.screenshot({ path: path.join(SHOTS, "05-invitacion-sin-sesion.png"), fullPage: true });
  await joinViaInvite(ana, inviteUrl, "06-formulario-unirse.png");
  await joinViaInvite(beto, inviteUrl);
  await joinViaInvite(caro, inviteUrl);
  check(true, "Ana, Beto y Caro se unieron");

  await ana.page.goto(inviteUrl);
  check(await visible(ana.page.getByText("Ya estás en este intercambio")), "la misma cuenta no puede unirse dos veces");

  await ana.page.goto(`${BASE}/intercambios/${exchangeId}`);
  await ana.page.screenshot({ path: path.join(SHOTS, "07-detalle-participante.png"), fullPage: true });
  await ana.page.goto(`${BASE}/intercambios/${exchangeId}/organizar`);
  check(await visible(ana.page.getByText("No encontramos esta página")), "un participante no puede abrir el panel del organizador");

  console.log("Exclusiones y restricciones imposibles");
  const panel = `${BASE}/intercambios/${exchangeId}/organizar`;
  const exclusionCount = () => org.page.getByRole("button", { name: "Quitar exclusión" }).count();
  async function addExclusion(a, b, both = true) {
    const before = await exclusionCount();
    const form = org.page.getByRole("form", { name: "Agregar exclusión" });
    await form.getByLabel("Persona", { exact: true }).selectOption({ label: a });
    await form.getByLabel("No debe tocarle con").selectOption({ label: b });
    await form.getByLabel(both ? /En ambas direcciones/ : /Solo en una dirección/).check();
    await form.getByRole("button", { name: "Agregar exclusión" }).click();
    await org.page.waitForFunction(
      (n) => document.querySelectorAll("button").length && [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Quitar exclusión")).length === n,
      before + 1,
    );
  }
  async function removeExclusionOf(label) {
    const before = await exclusionCount();
    const row = org.page.locator("li").filter({ hasText: label }).filter({ has: org.page.getByRole("button", { name: "Quitar exclusión" }) });
    await row.getByRole("button", { name: "Quitar exclusión" }).click();
    await org.page.waitForFunction(
      (n) => [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Quitar exclusión")).length === n,
      before - 1,
    );
  }
  await org.page.goto(panel);
  await addExclusion("Ana", "Beto");
  check(await visible(org.page.getByText("Las exclusiones permiten un sorteo válido")), "con Ana ⇄ Beto el sorteo es posible");
  await addExclusion("Caro", "Olga");
  await addExclusion("Caro", "Ana");
  await addExclusion("Caro", "Beto", false);
  // Caro → Beto en una dirección + Caro ⇄ Olga + Caro ⇄ Ana: Caro no puede regalarle a nadie.
  const impossible = org.page.getByText(/Caro no puede regalarle a nadie/).first();
  check(await visible(impossible), "se muestra un mensaje claro (quién queda sin opciones) cuando el sorteo es imposible");
  check(await org.page.getByRole("button", { name: "Realizar sorteo" }).isDisabled(), "el botón de sortear se deshabilita");
  check(await visible(org.page.getByText("Caro no le regala a Beto")), "la exclusión de una dirección se explica como tal");
  await org.page.screenshot({ path: path.join(SHOTS, "08-panel-imposible.png"), fullPage: true });
  // Corregir: quitar las exclusiones de Caro.
  await removeExclusionOf("Caro no le regala a Beto");
  await removeExclusionOf(/Caro.*Ana/);
  await removeExclusionOf(/Caro.*Olga/);
  check((await exclusionCount()) === 1, "queda solo la exclusión Ana ⇄ Beto");
  check(await visible(org.page.getByText("Las exclusiones permiten un sorteo válido")), "tras corregir, el sorteo vuelve a ser posible");

  console.log("Sorteo (con doble clic)");
  await org.page.getByRole("button", { name: "Realizar sorteo" }).click();
  const confirm = org.page.getByRole("button", { name: "Sortear ahora" });
  await confirm.click();
  await confirm.click({ timeout: 1000 }).catch(() => {}); // segundo clic: el botón ya está deshabilitado
  await org.page.getByText("Sorteo realizado", { exact: true }).waitFor({ timeout: 10_000 });
  await org.page.reload();
  check(await visible(org.page.getByText("0 de 4 personas ya vieron")), "un solo sorteo con 4 asignaciones");
  const panelHtml = await org.page.content();
  check(!/le regalas a/i.test(panelHtml), "el panel del organizador no muestra asignaciones");
  check(await org.page.getByRole("form", { name: "Agregar exclusión" }).count() === 0, "exclusiones bloqueadas tras el sorteo");
  await org.page.screenshot({ path: path.join(SHOTS, "09-panel-sorteado.png"), fullPage: true });

  console.log("Cada persona descubre a quién le tocó");
  const results = {};
  for (const [u, shot] of [[ana, "10-revelado.png"], [beto, null], [caro, null], [org, null]]) {
    if (u === ana) {
      await u.page.goto(`${BASE}/intercambios/${exchangeId}/mi-amigo-secreto`);
      await u.page.getByRole("button", { name: "Ver a quién me tocó" }).waitFor();
      await u.page.screenshot({ path: path.join(SHOTS, "10a-antes-de-revelar.png"), fullPage: true });
    }
    const r = await reveal(u, exchangeId, shot);
    results[u.name] = r.name;
  }
  console.log("   resultados (solo para la verificación):", results);
  const names = Object.keys(results);
  check(names.every((n) => results[n] !== n), "nadie se asignó a sí mismo");
  check(new Set(Object.values(results)).size === 4, "no hay destinatarios repetidos");
  check(Object.values(results).every((n) => names.includes(n)), "todos reciben de exactamente una persona");
  check(results.Ana !== "Beto" && results.Beto !== "Ana", "se respetó la exclusión Ana ⇄ Beto");

  const again = await reveal(ana, exchangeId);
  check(again.name === results.Ana, "al actualizar la página el resultado no cambia");
  // Alguien cuyo destinatario llenó preferencias al unirse (Olga no las llenó).
  const byName = { Ana: ana, Beto: beto, Caro: caro };
  const giverName = Object.keys(byName).find((n) => results[n] !== "Olga");
  const check2 = await reveal(byName[giverName], exchangeId);
  check(await visible(byName[giverName].page.getByText(`Un libro para ${check2.name}`)), "se muestran las preferencias del destinatario");
  check(!check2.htmlBefore.includes(`Un libro para ${check2.name}`), "el nombre/preferencias no llegan al navegador antes de pulsar el botón");

  console.log("Personas ajenas y enlace tras el sorteo");
  const intrusa = await newUser("Intrusa");
  await register(intrusa);
  await intrusa.page.waitForURL(/\/intercambios$/);
  await intrusa.page.goto(`${BASE}/intercambios/${exchangeId}/mi-amigo-secreto`);
  check(await visible(intrusa.page.getByText("No encontramos esta página")), "una persona ajena no ve resultados");
  await intrusa.page.goto(`${BASE}/intercambios/${exchangeId}`);
  check(await visible(intrusa.page.getByText("No encontramos esta página")), "una persona ajena no ve el intercambio");
  await intrusa.page.goto(inviteUrl);
  check(await visible(intrusa.page.getByText("El sorteo ya se realizó")), "el enlace no permite unirse después del sorteo");

  console.log("Repetir el sorteo exige confirmación");
  await org.page.goto(panel);
  await org.page.getByRole("button", { name: "Repetir sorteo" }).click();
  await org.page.getByRole("button", { name: "Sí, repetir sorteo" }).click();
  check(await visible(org.page.getByText("Marca la casilla para confirmar")), "sin marcar la casilla no se repite");
  await org.page.screenshot({ path: path.join(SHOTS, "11-repetir-confirmacion.png") });
  await org.page.getByLabel("Entiendo que se invalidarán los resultados anteriores.").first().check();
  await org.page.getByRole("button", { name: "Sí, repetir sorteo" }).click();
  await org.page.getByText(/Sorteo repetido/).waitFor({ timeout: 10_000 });
  check(true, "sorteo repetido con confirmación explícita");

  console.log("Perfil y lista");
  await ana.page.goto(`${BASE}/perfil`);
  await ana.page.getByLabel("Ideas de regalo").fill("Plantas");
  await ana.page.getByRole("button", { name: "Guardar perfil" }).click();
  check(await ana.page.getByText("Perfil actualizado.").waitFor({ timeout: 5000 }).then(() => true, () => false), "perfil guardado");
  await ana.page.screenshot({ path: path.join(SHOTS, "12-perfil.png"), fullPage: true });
  await ana.page.goto(`${BASE}/intercambios`);
  check(await visible(ana.page.getByText("Navidad en familia")), "el intercambio aparece en «Mis intercambios»");
  await ana.page.screenshot({ path: path.join(SHOTS, "13-mis-intercambios.png"), fullPage: true });

  console.log("Escritorio");
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const dp = await desk.newPage();
  await dp.goto(BASE);
  await dp.screenshot({ path: path.join(SHOTS, "14-inicio-escritorio.png"), fullPage: true });
  await desk.close();
} catch (e) {
  failures++;
  console.error("ERROR en la prueba E2E:", e);
} finally {
  await browser.close();
  app.kill("SIGTERM");
  await supa.close();
}

console.log(failures === 0 ? "\nE2E: todo correcto" : `\nE2E: ${failures} comprobaciones fallidas`);
process.exit(failures === 0 ? 0 : 1);
