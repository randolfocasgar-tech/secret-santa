import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client, Pool, type PoolClient } from "pg";

/**
 * Las pruebas de base de datos usan un PostgreSQL real. Se crea una base de
 * datos nueva por archivo de pruebas, se aplica una réplica mínima del
 * entorno de Supabase (tests/db/supabase-stub.sql) y luego las migraciones
 * reales de supabase/migrations, en orden.
 *
 * Cada "petición" se ejecuta igual que la ejecutaría PostgREST: en una
 * transacción con SET LOCAL ROLE authenticated/anon y los claims del JWT.
 */
const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";

const ROOT = path.resolve(__dirname, "../..");

export type TestDb = {
  pool: Pool;
  name: string;
  close: () => Promise<void>;
};

export async function createTestDatabase(prefix: string): Promise<TestDb> {
  const name = `${prefix}_${process.pid}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 12 });

  const stub = readFileSync(path.join(ROOT, "tests/db/supabase-stub.sql"), "utf8");
  await pool.query(stub);
  const migrationsDir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(path.join(migrationsDir, file), "utf8"));
  }

  return {
    pool,
    name,
    close: async () => {
      await pool.end();
      const a = new Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export async function createUser(db: TestDb, displayName: string): Promise<string> {
  const { rows } = await db.pool.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${displayName.toLowerCase().replace(/\W+/g, ".")}.${Math.random().toString(36).slice(2)}@example.test`,
      { display_name: displayName }],
  );
  return rows[0].id;
}

/** Ejecuta fn como el usuario indicado (o anónimo si userId es null). */
export async function asUser<T>(
  db: TestDb,
  userId: string | null,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    if (userId) {
      await client.query("set local role authenticated");
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
    } else {
      await client.query("set local role anon");
    }
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Llama a una función RPC como el usuario dado y devuelve las filas. */
export async function rpc<T = Record<string, unknown>>(
  db: TestDb,
  userId: string | null,
  fn: string,
  args: unknown[] = [],
): Promise<T[]> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return asUser(db, userId, async (c) => {
    const { rows } = await c.query(`select * from public.${fn}(${placeholders})`, args);
    return rows as T[];
  });
}

export async function expectDbError(promise: Promise<unknown>): Promise<{ message: string; hint?: string; code?: string }> {
  try {
    await promise;
  } catch (error) {
    const e = error as { message: string; hint?: string; code?: string };
    return { message: e.message, hint: e.hint, code: e.code };
  }
  throw new Error("Se esperaba un error de base de datos y la operación tuvo éxito");
}

/** Lectura administrativa (equivale a mirar la BD directamente; solo para verificar). */
export async function adminAssignments(db: TestDb, exchangeId: string) {
  const { rows } = await db.pool.query<{ giver_id: string; receiver_id: string; draw_version: number }>(
    `select giver_id, receiver_id, draw_version from public.assignments where exchange_id = $1`,
    [exchangeId],
  );
  return rows;
}

export async function participantIds(db: TestDb, exchangeId: string) {
  const { rows } = await db.pool.query<{ id: string; user_id: string | null; display_name: string }>(
    `select id, user_id, display_name from public.participants where exchange_id = $1 order by joined_at, display_name`,
    [exchangeId],
  );
  return rows;
}

export const FUTURE_DATE = "2099-12-24";

export async function createExchange(
  db: TestDb,
  organizerId: string,
  opts: { participates?: boolean; isDemo?: boolean; name?: string } = {},
) {
  const [row] = await rpc<{ create_exchange: string }>(db, organizerId, "create_exchange", [
    opts.name ?? "Intercambio de prueba",
    FUTURE_DATE,
    500,
    "MXN",
    "Sin reglas",
    opts.participates ?? true,
    null,
    opts.isDemo ?? false,
  ]);
  const id = row.create_exchange;
  const { rows } = await db.pool.query<{ invite_code: string }>(
    `select invite_code from public.exchanges where id = $1`,
    [id],
  );
  return { id, code: rows[0].invite_code };
}

export async function join(db: TestDb, userId: string, code: string, name: string) {
  await rpc(db, userId, "join_exchange", [code, name, `Ideas de ${name}`, `Gustos de ${name}`, `Evitar ${name}`]);
}
