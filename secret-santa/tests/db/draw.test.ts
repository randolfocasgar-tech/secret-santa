import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminAssignments,
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

beforeAll(async () => {
  db = await createTestDatabase("santa_draw");
});
afterAll(async () => {
  await db?.close();
});

/** Crea un intercambio con el organizador participando + (n-1) personas. */
async function setupExchange(n: number) {
  const organizer = await createUser(db, "Organizadora");
  const ex = await createExchange(db, organizer);
  const users = [organizer];
  for (let i = 1; i < n; i++) {
    const u = await createUser(db, `Persona ${i}`);
    await join(db, u, ex.code, `Persona ${i}`);
    users.push(u);
  }
  const parts = await participantIds(db, ex.id);
  return { organizer, ex, users, parts };
}

function assertValidDerangement(
  rows: { giver_id: string; receiver_id: string }[],
  participantIdsList: string[],
) {
  expect(rows).toHaveLength(participantIdsList.length);
  const givers = new Set(rows.map((r) => r.giver_id));
  const receivers = new Set(rows.map((r) => r.receiver_id));
  // Cada persona regala exactamente una vez y recibe exactamente una vez.
  expect(givers.size).toBe(participantIdsList.length);
  expect(receivers.size).toBe(participantIdsList.length);
  expect([...givers].sort()).toEqual([...participantIdsList].sort());
  expect([...receivers].sort()).toEqual([...participantIdsList].sort());
  // Nadie se regala a sí mismo.
  for (const r of rows) expect(r.giver_id).not.toBe(r.receiver_id);
}

describe("reglas del sorteo", () => {
  it("exige al menos 3 participantes", async () => {
    const { organizer, ex } = await setupExchange(2);
    const err = await expectDbError(rpc(db, organizer, "draw_exchange", [ex.id]));
    expect(err.message).toBe("NOT_ENOUGH_PARTICIPANTS");
    expect(err.hint).toMatch(/al menos 3/);
    expect(await adminAssignments(db, ex.id)).toHaveLength(0);
  });

  it.each([3, 4, 5, 8, 15, 40])(
    "con %i participantes: nadie se asigna a sí mismo y no hay destinatarios repetidos",
    async (n) => {
      const { organizer, ex, parts } = await setupExchange(n);
      const ids = parts.map((p) => p.id);
      const rounds = n <= 8 ? 30 : 8;
      let version = 0;
      for (let i = 0; i < rounds; i++) {
        if (version === 0) {
          const [res] = await rpc<{ draw_exchange: { draw_version: number; participants: number } }>(
            db, organizer, "draw_exchange", [ex.id],
          );
          expect(res.draw_exchange.participants).toBe(n);
          version = res.draw_exchange.draw_version;
        } else {
          const [res] = await rpc<{ redraw_exchange: { draw_version: number } }>(
            db, organizer, "redraw_exchange", [ex.id, version, true],
          );
          version = res.redraw_exchange.draw_version;
        }
        const rows = await adminAssignments(db, ex.id);
        assertValidDerangement(rows, ids);
        expect(new Set(rows.map((r) => r.draw_version))).toEqual(new Set([version]));
      }
    },
  );

  it("el resultado es aleatorio (no siempre el mismo) y estable al consultarlo varias veces", async () => {
    const { organizer, ex, users } = await setupExchange(6);
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    const first = await rpc<{ receiver_name: string }>(db, users[2], "get_my_assignment", [ex.id, false]);
    for (let i = 0; i < 5; i++) {
      const again = await rpc<{ receiver_name: string }>(db, users[2], "get_my_assignment", [ex.id, true]);
      expect(again[0].receiver_name).toBe(first[0].receiver_name);
    }

    const seen = new Set<string>();
    let version = 1;
    for (let i = 0; i < 25; i++) {
      const [res] = await rpc<{ redraw_exchange: { draw_version: number } }>(
        db, organizer, "redraw_exchange", [ex.id, version, true],
      );
      version = res.redraw_exchange.draw_version;
      const rows = await adminAssignments(db, ex.id);
      seen.add(rows.map((r) => `${r.giver_id}>${r.receiver_id}`).sort().join("|"));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("respeta exclusiones en ambas direcciones", async () => {
    const { organizer, ex, parts } = await setupExchange(5);
    const [a, b] = parts;
    await rpc(db, organizer, "add_exclusion", [ex.id, a.id, b.id, true]);
    let version = 0;
    for (let i = 0; i < 40; i++) {
      if (version === 0) {
        await rpc(db, organizer, "draw_exchange", [ex.id]);
        version = 1;
      } else {
        await rpc(db, organizer, "redraw_exchange", [ex.id, version, true]);
        version++;
      }
      const rows = await adminAssignments(db, ex.id);
      assertValidDerangement(rows, parts.map((p) => p.id));
      for (const r of rows) {
        expect(r.giver_id === a.id && r.receiver_id === b.id).toBe(false);
        expect(r.giver_id === b.id && r.receiver_id === a.id).toBe(false);
      }
    }
  });

  it("una exclusión en una sola dirección prohíbe A→B pero permite B→A", async () => {
    const { organizer, ex, parts } = await setupExchange(4);
    const [a, b] = parts;
    await rpc(db, organizer, "add_exclusion", [ex.id, a.id, b.id, false]);
    let sawBtoA = false;
    let version = 0;
    for (let i = 0; i < 60; i++) {
      if (version === 0) {
        await rpc(db, organizer, "draw_exchange", [ex.id]);
        version = 1;
      } else {
        await rpc(db, organizer, "redraw_exchange", [ex.id, version, true]);
        version++;
      }
      const rows = await adminAssignments(db, ex.id);
      assertValidDerangement(rows, parts.map((p) => p.id));
      for (const r of rows) {
        expect(r.giver_id === a.id && r.receiver_id === b.id).toBe(false);
        if (r.giver_id === b.id && r.receiver_id === a.id) sawBtoA = true;
      }
    }
    expect(sawBtoA).toBe(true);
  });

  it("respeta muchas exclusiones simultáneas (parejas)", async () => {
    const { organizer, ex, parts } = await setupExchange(8);
    // 4 parejas: (0,1) (2,3) (4,5) (6,7)
    for (let i = 0; i < 8; i += 2) {
      await rpc(db, organizer, "add_exclusion", [ex.id, parts[i].id, parts[i + 1].id, true]);
    }
    const partnerOf = new Map<string, string>();
    for (let i = 0; i < 8; i += 2) {
      partnerOf.set(parts[i].id, parts[i + 1].id);
      partnerOf.set(parts[i + 1].id, parts[i].id);
    }
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    for (let v = 1; v <= 20; v++) {
      const rows = await adminAssignments(db, ex.id);
      assertValidDerangement(rows, parts.map((p) => p.id));
      for (const r of rows) expect(partnerOf.get(r.giver_id)).not.toBe(r.receiver_id);
      await rpc(db, organizer, "redraw_exchange", [ex.id, v, true]);
    }
  });

  it("detecta restricciones imposibles, no guarda nada y permite corregirlas", async () => {
    // Con 3 personas solo hay dos ciclos posibles: A→B→C→A y A→C→B→A.
    // Excluir A↔B en ambas direcciones elimina los dos.
    const { organizer, ex, parts } = await setupExchange(3);
    const [a, b] = parts;
    const [exclusion] = await rpc<{ add_exclusion: string }>(db, organizer, "add_exclusion", [ex.id, a.id, b.id, true]);

    const [check] = await rpc<{ feasible: boolean; code: string; message: string }>(
      db, organizer, "check_draw_feasibility", [ex.id],
    );
    expect(check.feasible).toBe(false);
    expect(check.code).toBe("IMPOSSIBLE_CONSTRAINTS");

    const err = await expectDbError(rpc(db, organizer, "draw_exchange", [ex.id]));
    expect(err.message).toBe("IMPOSSIBLE_CONSTRAINTS");
    expect(err.hint).toMatch(/imposible|ninguna combinación/);
    expect(await adminAssignments(db, ex.id)).toHaveLength(0);
    const { rows } = await db.pool.query(`select status from public.exchanges where id = $1`, [ex.id]);
    expect(rows[0].status).toBe("open");

    // Corregir: quitar la exclusión y volver a sortear.
    await rpc(db, organizer, "remove_exclusion", [exclusion.add_exclusion]);
    const [check2] = await rpc<{ feasible: boolean }>(db, organizer, "check_draw_feasibility", [ex.id]);
    expect(check2.feasible).toBe(true);
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    assertValidDerangement(await adminAssignments(db, ex.id), parts.map((p) => p.id));
  });

  it("explica quién queda sin opciones", async () => {
    const { organizer, ex, parts } = await setupExchange(3);
    const [a, b, c] = parts;
    await rpc(db, organizer, "add_exclusion", [ex.id, a.id, b.id, false]);
    await rpc(db, organizer, "add_exclusion", [ex.id, a.id, c.id, false]);
    const err = await expectDbError(rpc(db, organizer, "draw_exchange", [ex.id]));
    expect(err.message).toBe("IMPOSSIBLE_CONSTRAINTS");
    expect(err.hint).toContain(`${a.display_name} no puede regalarle a nadie`);
  });

  it("no permite exclusiones duplicadas, consigo mismo ni con personas de otro intercambio", async () => {
    const { organizer, ex, parts } = await setupExchange(3);
    const other = await setupExchange(3);
    await rpc(db, organizer, "add_exclusion", [ex.id, parts[0].id, parts[1].id, true]);
    expect((await expectDbError(rpc(db, organizer, "add_exclusion", [ex.id, parts[1].id, parts[0].id, false]))).message)
      .toBe("DUPLICATE_EXCLUSION");
    expect((await expectDbError(rpc(db, organizer, "add_exclusion", [ex.id, parts[0].id, parts[0].id, true]))).message)
      .toBe("INVALID_EXCLUSION");
    expect((await expectDbError(rpc(db, organizer, "add_exclusion", [ex.id, parts[0].id, other.parts[1].id, true]))).message)
      .toBe("INVALID_EXCLUSION");
  });
});

describe("bloqueo después del sorteo", () => {
  it("bloquea participantes y exclusiones; reabrir exige confirmación", async () => {
    const { organizer, ex, users, parts } = await setupExchange(4);
    await rpc(db, organizer, "draw_exchange", [ex.id]);

    const latecomer = await createUser(db, "Tardío");
    expect((await expectDbError(join(db, latecomer, ex.code, "Tardío"))).message).toBe("EXCHANGE_LOCKED");
    expect((await expectDbError(rpc(db, users[1], "leave_exchange", [ex.id]))).message).toBe("EXCHANGE_LOCKED");
    expect((await expectDbError(rpc(db, organizer, "remove_participant", [parts[2].id]))).message).toBe("EXCHANGE_LOCKED");
    expect((await expectDbError(rpc(db, organizer, "add_exclusion", [ex.id, parts[0].id, parts[1].id, true]))).message)
      .toBe("EXCHANGE_LOCKED");
    expect((await expectDbError(
      rpc(db, users[1], "update_my_participation", [ex.id, "Nombre Nuevo", "a", "b", "c"]),
    )).message).toBe("EXCHANGE_LOCKED");
    // Las preferencias sí se pueden seguir editando (sin cambiar el nombre).
    await rpc(db, users[1], "update_my_participation", [ex.id, parts[1].display_name, "Nueva idea", "b", "c"]);

    // Un segundo sorteo directo no se permite.
    expect((await expectDbError(rpc(db, organizer, "draw_exchange", [ex.id]))).message).toBe("ALREADY_DRAWN");

    // Repetir/reabrir sin confirmación explícita falla y no toca nada.
    const before = await adminAssignments(db, ex.id);
    expect((await expectDbError(rpc(db, organizer, "redraw_exchange", [ex.id, 1, false]))).message)
      .toBe("CONFIRMATION_REQUIRED");
    expect((await expectDbError(rpc(db, organizer, "reopen_exchange", [ex.id, 1, false]))).message)
      .toBe("CONFIRMATION_REQUIRED");
    expect(await adminAssignments(db, ex.id)).toEqual(before);

    // Con confirmación: se invalidan los resultados y se puede editar.
    await rpc(db, organizer, "reopen_exchange", [ex.id, 1, true]);
    expect(await adminAssignments(db, ex.id)).toHaveLength(0);
    expect(await rpc(db, users[1], "get_my_assignment", [ex.id, false])).toHaveLength(0);
    await join(db, latecomer, ex.code, "Tardío");
    const [res] = await rpc<{ draw_exchange: { draw_version: number } }>(db, organizer, "draw_exchange", [ex.id]);
    expect(res.draw_exchange.draw_version).toBe(2);
    expect(await adminAssignments(db, ex.id)).toHaveLength(5);
  });

  it("se puede borrar un intercambio ya sorteado", async () => {
    const { organizer, ex } = await setupExchange(3);
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    await rpc(db, organizer, "delete_exchange", [ex.id]);
    const { rows } = await db.pool.query(`select count(*)::int as n from public.participants where exchange_id = $1`, [ex.id]);
    expect(rows[0].n).toBe(0);
  });
});

describe("unirse", () => {
  it("una cuenta no puede unirse dos veces y los nombres no se repiten", async () => {
    const organizer = await createUser(db, "Org");
    const ex = await createExchange(db, organizer, { participates: false });
    const u = await createUser(db, "Luis");
    await join(db, u, ex.code, "Luis");
    expect((await expectDbError(join(db, u, ex.code, "Luis Otra Vez"))).message).toBe("ALREADY_JOINED");
    const u2 = await createUser(db, "Otro Luis");
    expect((await expectDbError(join(db, u2, ex.code, "  luis "))).message).toBe("DUPLICATE_NAME");
    expect((await expectDbError(join(db, u2, "codigo-falso", "X"))).message).toBe("INVALID_INVITE");
    const parts = await participantIds(db, ex.id);
    expect(parts).toHaveLength(1);
  });

  it("el organizador puede no participar y unirse después con el mismo enlace", async () => {
    const organizer = await createUser(db, "Org2");
    const ex = await createExchange(db, organizer, { participates: false });
    expect(await participantIds(db, ex.id)).toHaveLength(0);
    await join(db, organizer, ex.code, "Org2");
    expect(await participantIds(db, ex.id)).toHaveLength(1);
  });

  it("el modo demo crea 4 participantes ficticios marcados como demo", async () => {
    const organizer = await createUser(db, "Demo Org");
    const ex = await createExchange(db, organizer, { isDemo: true });
    const parts = await participantIds(db, ex.id);
    expect(parts).toHaveLength(5);
    expect(parts.filter((p) => p.user_id === null).every((p) => p.display_name.endsWith("(demo)"))).toBe(true);
    await rpc(db, organizer, "draw_exchange", [ex.id]);
    const mine = await rpc<{ receiver_name: string }>(db, organizer, "get_my_assignment", [ex.id, true]);
    expect(mine).toHaveLength(1);
    expect(mine[0].receiver_name).toMatch(/\(demo\)$/);
  });

  it("solo los intercambios demo admiten participantes ficticios", async () => {
    const { organizer, ex } = await setupExchange(3);
    expect((await expectDbError(rpc(db, organizer, "add_demo_participant", [ex.id, "Falso"]))).message).toBe("NOT_DEMO");
  });
});
