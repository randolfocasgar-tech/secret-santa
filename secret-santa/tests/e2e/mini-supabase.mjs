// =====================================================================
// EMULADOR MÍNIMO DE SUPABASE — SOLO PARA PRUEBAS E2E LOCALES
//
// No forma parte de la aplicación ni la sustituye. Existe porque en el
// entorno de desarrollo donde se construyó esta app no fue posible levantar
// la pila oficial de Supabase (Docker sin acceso a los registros de imágenes).
//
// Implementa únicamente el subconjunto de las APIs HTTP de Supabase Auth
// (/auth/v1) y PostgREST (/rest/v1) que usa la app, sobre un PostgreSQL REAL
// con las migraciones REALES (RLS, funciones y triggers incluidos). Cada
// petición REST se ejecuta como lo hace PostgREST: en una transacción con
// SET LOCAL ROLE authenticated/anon y los claims del JWT.
//
// Para usar Supabase de verdad (local con la CLI o en la nube) ver README.
// =====================================================================
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Igual que PostgREST: las columnas "date" se devuelven como texto YYYY-MM-DD.
pg.types.setTypeParser(1082, (v) => v);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.MINI_SUPABASE_PORT ?? 54329);
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const DB_NAME = process.env.MINI_SUPABASE_DB ?? "santa_e2e";
export const JWT_SECRET = process.env.MINI_SUPABASE_JWT_SECRET ?? "solo-para-pruebas-e2e-no-usar-en-produccion";

// ---------------------------------------------------------------- JWT HS256
const b64url = (buf) => Buffer.from(buf).toString("base64url");
export function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
function verifyJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
export const ANON_KEY = signJwt({ role: "anon", iss: "mini-supabase", iat: 1700000000, exp: 4102444800 });

// ---------------------------------------------------------------- Base de datos
async function setupDatabase() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB_NAME} with (force)`);
  await admin.query(`create database ${DB_NAME}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 20 });
  await pool.query(readFileSync(path.join(ROOT, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(ROOT, "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(path.join(dir, f), "utf8"));
  }
  return pool;
}

// ---------------------------------------------------------------- Utilidades HTTP
function send(res, status, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "x-supabase-api-version": "2024-01-01",
    "access-control-allow-origin": "*",
    ...headers,
  });
  res.end(payload);
}
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : {};
}
function bearer(req) {
  const h = req.headers.authorization ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}
const IDENT = /^[a-z_][a-z0-9_]*$/;

// ---------------------------------------------------------------- Auth (/auth/v1)
const users = new Map(); // email -> { id, email, hash, salt, meta, created_at }
const refreshTokens = new Map(); // token -> userId

function hashPassword(password, salt) {
  return scryptSync(password, salt, 32).toString("hex");
}
function userObject(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.created_at,
    confirmed_at: u.created_at,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: u.meta,
    identities: [],
    created_at: u.created_at,
    updated_at: u.created_at,
  };
}
function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const access = signJwt({
    sub: u.id,
    role: "authenticated",
    aud: "authenticated",
    email: u.email,
    iat: now,
    exp: now + expiresIn,
    session_id: randomUUID(),
    user_metadata: u.meta,
  });
  const refresh = randomBytes(24).toString("hex");
  refreshTokens.set(refresh, u.id);
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: refresh,
    user: userObject(u),
  };
}
const authError = (res, status, code, msg) => send(res, status, { code, error_code: code, msg, message: msg });

async function handleAuth(pool, req, res, url) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  if (route === "/signup" && req.method === "POST") {
    const body = await readJson(req);
    const email = String(body.email ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(res, 400, "email_address_invalid", "Invalid email");
    if (String(body.password ?? "").length < 6) return authError(res, 422, "weak_password", "Password should be at least 6 characters");
    if (users.has(email)) return authError(res, 422, "user_already_exists", "User already registered");
    const salt = randomBytes(8).toString("hex");
    const meta = body.data ?? {};
    const { rows } = await pool.query(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id, created_at",
      [email, meta],
    );
    const u = { id: rows[0].id, email, salt, hash: hashPassword(body.password, salt), meta, created_at: rows[0].created_at };
    users.set(email, u);
    return send(res, 200, sessionFor(u)); // equivalente a "autoconfirm" activado
  }
  if (route === "/token" && req.method === "POST") {
    const body = await readJson(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = users.get(String(body.email ?? "").toLowerCase());
      if (!u || hashPassword(String(body.password ?? ""), u.salt) !== u.hash) {
        return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      }
      return send(res, 200, sessionFor(u));
    }
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(body.refresh_token);
      const u = [...users.values()].find((x) => x.id === userId);
      if (!u) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, sessionFor(u));
    }
    return authError(res, 400, "unsupported_grant_type", "Unsupported grant type");
  }
  if (route === "/user" && req.method === "GET") {
    const claims = bearer(req) ? verifyJwt(bearer(req)) : null;
    const u = claims?.sub ? [...users.values()].find((x) => x.id === claims.sub) : null;
    if (!u) return authError(res, 403, "bad_jwt", "invalid JWT");
    return send(res, 200, userObject(u));
  }
  if (route === "/logout" && req.method === "POST") {
    res.writeHead(204);
    return res.end();
  }
  return authError(res, 404, "not_found", `Ruta de auth no emulada: ${req.method} ${route}`);
}

// ---------------------------------------------------------------- PostgREST (/rest/v1)
async function withRole(pool, req, fn) {
  const token = bearer(req);
  const claims = token ? verifyJwt(token) : null;
  if (token && !claims) {
    const e = new Error("JWT inválido");
    e.http = 401;
    e.code = "PGRST301";
    throw e;
  }
  const role = claims?.role === "authenticated" ? "authenticated" : "anon";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? { role: "anon" })]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function parseFilters(url) {
  const where = [];
  const values = [];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (!IDENT.test(key)) throw Object.assign(new Error(`columna inválida ${key}`), { http: 400 });
    const m = value.match(/^eq\.(.*)$/s);
    if (!m) throw Object.assign(new Error(`operador no emulado: ${value}`), { http: 400 });
    values.push(m[1]);
    where.push(`"${key}" = $${values.length}`);
  }
  return { where, values };
}

async function handleRest(pool, req, res, url) {
  const route = url.pathname.replace(/^\/rest\/v1\//, "");
  try {
    if (route.startsWith("rpc/") && req.method === "POST") {
      const fn = route.slice(4);
      if (!IDENT.test(fn)) return send(res, 404, { code: "PGRST202", message: "función no encontrada" });
      const args = await readJson(req);
      const { rows: meta } = await pool.query(
        `select p.proretset, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype
         where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
        [fn],
      );
      if (!meta.length) return send(res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
      const names = Object.keys(args);
      if (!names.every((n) => IDENT.test(n))) return send(res, 400, { code: "PGRST100", message: "argumento inválido" });
      const callArgs = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
      const values = names.map((n) => (args[n] !== null && typeof args[n] === "object" ? JSON.stringify(args[n]) : args[n]));
      const { proretset, typname } = meta[0];
      const result = await withRole(pool, req, async (c) => {
        if (proretset) return (await c.query(`select * from public.${fn}(${callArgs})`, values)).rows;
        const { rows } = await c.query(`select public.${fn}(${callArgs}) as v`, values);
        return typname === "void" ? undefined : rows[0].v;
      });
      if (result === undefined) {
        res.writeHead(204);
        return res.end();
      }
      return send(res, 200, result);
    }

    const table = route;
    if (!IDENT.test(table)) return send(res, 404, { code: "42P01", message: "tabla no encontrada" });
    const { where, values } = parseFilters(url);
    const whereSql = where.length ? ` where ${where.join(" and ")}` : "";

    if (req.method === "GET") {
      const select = url.searchParams.get("select") ?? "*";
      const cols = select === "*" ? "*" : select.split(",").map((c) => {
        if (!IDENT.test(c)) throw Object.assign(new Error(`columna inválida ${c}`), { http: 400 });
        return `"${c}"`;
      }).join(", ");
      let orderSql = "";
      const order = url.searchParams.get("order");
      if (order) {
        orderSql = " order by " + order.split(",").map((o) => {
          const [col, dir = "asc"] = o.split(".");
          if (!IDENT.test(col) || !["asc", "desc"].includes(dir)) throw Object.assign(new Error("orden inválido"), { http: 400 });
          return `"${col}" ${dir}`;
        }).join(", ");
      }
      const rows = await withRole(pool, req, async (c) =>
        (await c.query(`select ${cols} from public."${table}"${whereSql}${orderSql}`, values)).rows,
      );
      return send(res, 200, rows);
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const keys = Object.keys(body);
      if (!keys.every((k) => IDENT.test(k))) return send(res, 400, { code: "PGRST100", message: "columna inválida" });
      const sets = keys.map((k, i) => `"${k}" = $${values.length + i + 1}`).join(", ");
      await withRole(pool, req, (c) =>
        c.query(`update public."${table}" set ${sets}${whereSql}`, [...values, ...keys.map((k) => body[k])]),
      );
      res.writeHead(204);
      return res.end();
    }

    return send(res, 405, { code: "PGRST000", message: `método no emulado: ${req.method}` });
  } catch (e) {
    const status = e.http ?? (e.code === "42501" ? 403 : 400);
    return send(res, status, { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
  }
}

// ---------------------------------------------------------------- Servidor
export async function startMiniSupabase() {
  const pool = await setupDatabase();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    try {
      if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(pool, req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(pool, req, res, url);
      return send(res, 404, { message: "no encontrado" });
    } catch (e) {
      console.error("[mini-supabase]", e);
      return send(res, 500, { message: String(e?.message ?? e) });
    }
  });
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${PORT}`,
    anonKey: ANON_KEY,
    pool,
    close: async () => {
      await new Promise((r) => server.close(r));
      await pool.end();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const s = await startMiniSupabase();
  console.log(`mini-supabase escuchando en ${s.url}`);
  console.log(`ANON_KEY=${s.anonKey}`);
}
