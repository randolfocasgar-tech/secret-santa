import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminAssignments,
  asUser,
  createExchange,
  createTestDatabase,
  createUser,
  expectDbError,
  join,
  participantIds,
  rpc,
  type TestDb,
} from "./helpers";

let db: TestDb;
let organizer: string; // organiza y NO participa
let ana: string;
let beto: string;
let caro: string;
let outsider: string;
let exchange: { id: string; code: string };

beforeAll(async () => {
  db = await createTestDatabase("santa_privacy");
  organizer = await createUser(db, "Organizador");
  ana = await createUser(db, "Ana");
  beto = await createUser(db, "Beto");
  caro = await createUser(db, "Caro");
  outsider = await createUser(db, "Intrusa");
  exchange = await createExchange(db, organizer, { participates: false });
  await join(db, ana, exchange.code, "Ana");
  await join(db, beto, exchange.code, "Beto");
  await join(db, caro, exchange.code, "Caro");
  await rpc(db, organizer, "draw_exchange", [exchange.id]);
});
afterAll(async () => {
  await db?.close();
});

describe("cada participante ve solo su propia asignación", () => {
  it("get_my_assignment devuelve exactamente una fila: la de quien llama", async () => {
    const parts = await participantIds(db, exchange.id);
    const byUser = new Map(parts.map((p) => [p.user_id, p]));
    const truth = await adminAssignments(db, exchange.id);

    for (const user of [ana, beto, caro]) {
      const rows = await rpc<{ receiver_name: string; wishlist: string }>(db, user, "get_my_assignment", [exchange.id, false]);
      expect(rows).toHaveLength(1);
      const me = byUser.get(user)!;
      const expectedReceiver = parts.find((p) => p.id === truth.find((t) => t.giver_id === me.id)!.receiver_id)!;
      expect(rows[0].receiver_name).toBe(expectedReceiver.display_name);
      expect(rows[0].receiver_name).not.toBe(me.display_name);
      // Recibe las preferencias de su destinatario.
      expect(rows[0].wishlist).toBe(`Ideas de ${expectedReceiver.display_name}`);
    }
  });

  it("SELECT directo sobre assignments solo devuelve la fila propia", async () => {
    const parts = await participantIds(db, exchange.id);
    const anaPid = parts.find((p) => p.user_id === ana)!.id;
    const rows = await asUser(db, ana, async (c) => (await c.query("select * from public.assignments")).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0].giver_id).toBe(anaPid);
  });

  it("no se pueden leer las preferencias de otros participantes directamente", async () => {
    const rows = await asUser(db, ana, async (c) =>
      (await c.query("select * from public.participant_preferences")).rows,
    );
    const parts = await participantIds(db, exchange.id);
    const anaPid = parts.find((p) => p.user_id === ana)!.id;
    expect(rows.map((r) => r.participant_id)).toEqual([anaPid]);
  });

  it("no se puede escribir directamente en assignments ni cambiar el estado del intercambio", async () => {
    const parts = await participantIds(db, exchange.id);
    const err1 = await expectDbError(asUser(db, ana, (c) =>
      c.query(
        "insert into public.assignments (exchange_id, draw_version, giver_id, receiver_id) values ($1, 99, $2, $3)",
        [exchange.id, parts[0].id, parts[1].id],
      ),
    ));
    expect(err1.code).toBe("42501"); // permission denied
    const err2 = await expectDbError(asUser(db, ana, (c) => c.query("delete from public.assignments")));
    expect(err2.code).toBe("42501");
    const err3 = await expectDbError(asUser(db, organizer, (c) =>
      c.query("update public.exchanges set status = 'open' where id = $1", [exchange.id]),
    ));
    expect(err3.code).toBe("42501");
  });

  it("las funciones internas del sorteo no se pueden invocar", async () => {
    for (const user of [organizer, ana]) {
      const err = await expectDbError(asUser(db, user, (c) =>
        c.query("select * from public._compute_draw($1)", [exchange.id]),
      ));
      expect(err.code).toBe("42501");
    }
  });
});

describe("el organizador administra pero no ve asignaciones", () => {
  it("no participa → no ve ninguna asignación por ninguna vía", async () => {
    const direct = await asUser(db, organizer, async (c) => (await c.query("select * from public.assignments")).rows);
    expect(direct).toHaveLength(0);
    expect(await rpc(db, organizer, "get_my_assignment", [exchange.id, false])).toHaveLength(0);
    // El sorteo solo devuelve un resumen, nunca parejas.
    const [check] = await rpc<{ feasible: boolean; message: string }>(db, organizer, "check_draw_feasibility", [exchange.id]);
    expect(Object.keys(check).sort()).toEqual(["code", "feasible", "message"]);
    // Progreso agregado sin parejas.
    const [progress] = await rpc<{ revealed: number; total: number }>(db, organizer, "get_reveal_progress", [exchange.id]);
    expect(progress.total).toBe(3);
  });

  it("puede ver la lista de participantes (nombres) y las exclusiones", async () => {
    const parts = await asUser(db, organizer, async (c) =>
      (await c.query("select display_name from public.participants where exchange_id = $1", [exchange.id])).rows,
    );
    expect(parts.map((p) => p.display_name).sort()).toEqual(["Ana", "Beto", "Caro"]);
  });

  it("el organizador que además participa solo ve su propia asignación", async () => {
    const org2 = await createUser(db, "Org Participante");
    const ex2 = await createExchange(db, org2, { participates: true });
    const u1 = await createUser(db, "U1");
    const u2 = await createUser(db, "U2");
    await join(db, u1, ex2.code, "U1");
    await join(db, u2, ex2.code, "U2");
    await rpc(db, org2, "draw_exchange", [ex2.id]);
    const rows = await asUser(db, org2, async (c) =>
      (await c.query("select * from public.assignments where exchange_id = $1", [ex2.id])).rows,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("personas ajenas y enlaces de invitación", () => {
  it("una persona ajena no ve el intercambio, sus participantes ni sus resultados", async () => {
    const result = await asUser(db, outsider, async (c) => ({
      exchanges: (await c.query("select * from public.exchanges where id = $1", [exchange.id])).rows,
      participants: (await c.query("select * from public.participants where exchange_id = $1", [exchange.id])).rows,
      assignments: (await c.query("select * from public.assignments where exchange_id = $1", [exchange.id])).rows,
    }));
    expect(result.exchanges).toHaveLength(0);
    expect(result.participants).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
    expect(await rpc(db, outsider, "get_my_assignment", [exchange.id, false])).toHaveLength(0);
  });

  it("una persona ajena no puede sortear, repetir ni administrar", async () => {
    for (const [fn, args] of [
      ["draw_exchange", [exchange.id]],
      ["redraw_exchange", [exchange.id, 1, true]],
      ["reopen_exchange", [exchange.id, 1, true]],
      ["delete_exchange", [exchange.id]],
      ["check_draw_feasibility", [exchange.id]],
    ] as const) {
      const err = await expectDbError(rpc(db, outsider, fn, [...args]));
      expect(err.message).toBe("NOT_FOUND_OR_FORBIDDEN");
    }
    // Un participante tampoco puede administrar.
    const err = await expectDbError(rpc(db, ana, "redraw_exchange", [exchange.id, 1, true]));
    expect(err.message).toBe("NOT_FOUND_OR_FORBIDDEN");
  });

  it("el código de invitación solo muestra una vista previa, sin participantes ni resultados", async () => {
    const preview = await rpc<Record<string, unknown>>(db, outsider, "get_invite_preview", [exchange.code]);
    expect(preview).toHaveLength(1);
    expect(Object.keys(preview[0]).sort()).toEqual([
      "budget", "currency", "exchange_id", "gift_date", "is_member", "is_participant",
      "name", "organizer_name", "participant_count", "rules", "status",
    ]);
    expect(preview[0].is_member).toBe(false);
    // Conocer el id del intercambio (vía la vista previa) no da acceso.
    const rows = await asUser(db, outsider, async (c) =>
      (await c.query("select * from public.participants where exchange_id = $1", [preview[0].exchange_id])).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("sin sesión (anon) no se puede leer ninguna tabla ni llamar a la API", async () => {
    for (const table of ["exchanges", "participants", "assignments", "participant_preferences", "exclusions", "profiles"]) {
      const err = await expectDbError(asUser(db, null, (c) => c.query(`select * from public.${table}`)));
      expect(err.code).toBe("42501");
    }
    const err = await expectDbError(rpc(db, null, "get_my_assignment", [exchange.id, false]));
    expect(err.code).toBe("42501");
    // La vista previa de invitación sí está disponible sin sesión.
    expect(await rpc(db, null, "get_invite_preview", [exchange.code])).toHaveLength(1);
  });

  it("cada quien solo puede leer y editar su propio perfil", async () => {
    const rows = await asUser(db, ana, async (c) => (await c.query("select id from public.profiles")).rows);
    expect(rows.map((r) => r.id)).toEqual([ana]);
    const updated = await asUser(db, ana, async (c) =>
      (await c.query("update public.profiles set display_name = 'Hack' where id = $1", [beto])).rowCount,
    );
    expect(updated).toBe(0);
  });
});
