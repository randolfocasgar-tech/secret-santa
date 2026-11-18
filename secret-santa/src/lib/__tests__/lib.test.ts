import { describe, expect, it } from "vitest";
import { translateAuthError, translateDbError } from "@/lib/errors";
import { isIsoDate, isUuid, parseBudget, validateExchangeForm } from "@/lib/form";
import { CURRENCY_CODES, daysUntil, describeDaysUntil, formatGiftDate, formatMoney } from "@/lib/format";
import { extractInviteCode, inviteUrl } from "@/lib/invite";
import { safeNextPath } from "@/lib/safe-redirect";

describe("extractInviteCode", () => {
  it("acepta un enlace completo o solo el código", () => {
    expect(extractInviteCode("https://ejemplo.com/unirme/AbC123_-xyZ987qq")).toBe("AbC123_-xyZ987qq");
    expect(extractInviteCode("  AbC123_-xyZ987qq ")).toBe("AbC123_-xyZ987qq");
    expect(extractInviteCode("http://localhost:3000/unirme/AbC123_-xyZ987qq?x=1")).toBe("AbC123_-xyZ987qq");
  });
  it("rechaza entradas no válidas", () => {
    expect(extractInviteCode("")).toBeNull();
    expect(extractInviteCode("corto")).toBeNull();
    expect(extractInviteCode("<script>alert(1)</script>")).toBeNull();
    expect(extractInviteCode("../../etc/passwd")).toBeNull();
  });
  it("arma el enlace de invitación", () => {
    expect(inviteUrl("https://a.com/", "abc12345")).toBe("https://a.com/unirme/abc12345");
  });
});

describe("safeNextPath", () => {
  it("solo permite rutas internas", () => {
    expect(safeNextPath("/unirme/abc")).toBe("/unirme/abc");
    expect(safeNextPath("https://malo.com")).toBe("/intercambios");
    expect(safeNextPath("//malo.com")).toBe("/intercambios");
    expect(safeNextPath("/\\malo.com")).toBe("/intercambios");
    expect(safeNextPath("/auth/confirm")).toBe("/intercambios");
    expect(safeNextPath(null, "/")).toBe("/");
  });
});

describe("validación de formularios", () => {
  it("interpreta presupuestos en formatos comunes", () => {
    expect(parseBudget("500")).toBe(500);
    expect(parseBudget("1,500.50")).toBe(1500.5);
    expect(parseBudget("1.500,50")).toBe(1500.5);
    expect(parseBudget("250,5")).toBe(250.5);
    expect(parseBudget("0")).toBe(0);
    expect(parseBudget("-5")).toBeNull();
    expect(parseBudget("abc")).toBeNull();
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("1.234")).toBe(1234);
  });
  it("valida fechas y uuid", () => {
    expect(isIsoDate("2026-12-24")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("24/12/2026")).toBe(false);
    expect(isUuid("6f1c1b8e-6a3a-4b5e-9c1d-1a2b3c4d5e6f")).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
  });
  it("devuelve errores por campo en español", () => {
    const fd = new FormData();
    fd.set("name", "");
    fd.set("gift_date", "2020-01-01");
    fd.set("budget", "mucho");
    fd.set("currency", "XXX");
    const { fieldErrors, data } = validateExchangeForm(fd, CURRENCY_CODES, "2026-11-18");
    expect(data).toBeUndefined();
    expect(Object.keys(fieldErrors!).sort()).toEqual(["budget", "currency", "gift_date", "name"]);
    expect(fieldErrors!.gift_date).toMatch(/pasado/);
  });
  it("acepta un formulario correcto", () => {
    const fd = new FormData();
    fd.set("name", " Navidad ");
    fd.set("gift_date", "2026-12-24");
    fd.set("budget", "500");
    fd.set("currency", "mxn");
    const { data } = validateExchangeForm(fd, CURRENCY_CODES, "2026-11-18");
    expect(data).toEqual({ name: "Navidad", giftDate: "2026-12-24", budget: 500, currency: "MXN", rules: "" });
  });
});

describe("formato", () => {
  it("formatea fechas de calendario sin desfase de zona horaria", () => {
    expect(formatGiftDate("2026-12-24")).toMatch(/24 de diciembre de 2026/);
  });
  it("formatea montos", () => {
    expect(formatMoney(500, "MXN")).toMatch(/500/);
  });
  it("cuenta los días", () => {
    const today = new Date(2026, 10, 18);
    expect(daysUntil("2026-11-18", today)).toBe(0);
    expect(daysUntil("2026-12-24", today)).toBe(36);
    expect(describeDaysUntil(0)).toBe("¡Es hoy!");
    expect(describeDaysUntil(1)).toBe("Falta 1 día");
    expect(describeDaysUntil(-3)).toBe("Fue hace 3 días");
  });
});

describe("mensajes de error", () => {
  it("usa el texto específico del servidor cuando existe", () => {
    expect(translateDbError({ message: "IMPOSSIBLE_CONSTRAINTS", hint: "Ana no puede regalarle a nadie." })).toBe(
      "Ana no puede regalarle a nadie.",
    );
  });
  it("traduce códigos conocidos y oculta errores internos", () => {
    expect(translateDbError({ message: "ALREADY_DRAWN" })).toMatch(/ya se realizó/);
    expect(translateDbError({ message: "duplicate key value violates unique constraint \"x\"" })).toMatch(/inesperado/);
    expect(translateDbError({ message: "permission denied", code: "42501" })).toMatch(/permiso/);
  });
  it("traduce errores de autenticación", () => {
    expect(translateAuthError({ message: "Invalid login credentials", code: "invalid_credentials" })).toBe(
      "Correo o contraseña incorrectos.",
    );
    expect(translateAuthError({ message: "x", code: "user_already_exists" })).toMatch(/Ya existe una cuenta/);
  });
});
