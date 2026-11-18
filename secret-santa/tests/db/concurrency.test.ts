import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminAssignments,
  createExchange,
  createTestDatabase,
  createUser,
  join,
  rpc,
  type TestDb,
} from "./helpers";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase("santa_conc");
});
afterAll(async () => {
  await db?.close();
});

async function setup(n: number) {
  const organizer = await createUser(db, "Org");
  const ex = await createExchange(db, organizer);
  for (let i = 1; i < n; i++) {
    const u = await createUser(db, `P${i}`);
    await join(db, u, ex.code, `P${i}`);
  }
  return { organizer, ex };
}

function rejectionMessages(results: PromiseSettledResult<unknown>[]) {
  return results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason as Error).message);
}

describe("solicitudes simultáneas", () => {
  it("10 sorteos simultáneos (doble clic / varias pestañas): solo uno se aplica", async () => {
    const { organizer, ex } = await setup(6);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => rpc(db, organizer, "draw_exchange", [ex.id])),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessages(results)).toEqual(Array(9).fill("ALREADY_DRAWN"));
    const rows = await adminAssignments(db, ex.id);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.draw_version))).toEqual(new Set([1]));
  });

  it("repeticiones simultáneas con la misma versión: solo una se aplica", async () => {
    const { organizer, ex } = await setup(5);
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => rpc(db, organizer, "redraw_exchange", [ex.id, 1, true])),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessages(results)).toEqual(Array(5).fill("STALE_VERSION"));
    const rows = await adminAssignments(db, ex.id);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.draw_version))).toEqual(new Set([2]));
  });

  it("una unión que llega durante el sorteo espera y luego se rechaza", async () => {
    const { organizer, ex } = await setup(4);
    const late = await createUser(db, "Tarde");

    const drawClient = await db.pool.connect();
    try {
      await drawClient.query("begin");
      await drawClient.query("set local role authenticated");
      await drawClient.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: organizer })]);
      await drawClient.query("select public.draw_exchange($1)", [ex.id]);

      // El sorteo tiene la fila bloqueada; la unión queda esperando.
      let settled = false;
      const joinPromise = join(db, late, ex.code, "Tarde").finally(() => {
        settled = true;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(settled).toBe(false);

      await drawClient.query("commit");
      await expect(joinPromise).rejects.toThrow("EXCHANGE_LOCKED");
    } finally {
      drawClient.release();
    }
    expect(await adminAssignments(db, ex.id)).toHaveLength(4);
  });

  it("doble clic en «Unirme» con la misma cuenta: una sola participación", async () => {
    const organizer = await createUser(db, "Org J");
    const ex = await createExchange(db, organizer, { participates: false });
    const u = await createUser(db, "Doble");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => join(db, u, ex.code, "Doble")),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessages(results)).toEqual(Array(4).fill("ALREADY_JOINED"));
  });
});
