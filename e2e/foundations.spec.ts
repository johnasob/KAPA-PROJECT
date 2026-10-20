import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/lib/database.types";

type Settings = Database["public"]["Tables"]["business_settings"]["Row"];
let admin: SupabaseClient<Database>;
let url: string, key: string, original: Settings;
let fixturesReady = false;
const password = `Kapa!${randomUUID()}`;
const run = randomUUID();
const email = {
  john: `john-${run}@kapa.test`,
  sebas: `sebas-${run}@kapa.test`,
  outsider: `outsider-${run}@kapa.test`,
};
const userIds: string[] = [];
const clients: SupabaseClient<Database>[] = [];

function client() {
  const value = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(value);
  return value;
}
async function login(page: Page, address = email.john) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(address);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar al espacio" }).click();
}
test.beforeAll(async () => {
  const status = JSON.parse(
    execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
  url = status.API_URL;
  key = status.ANON_KEY;
  if (new URL(url).hostname !== "127.0.0.1")
    throw new Error("E2E se limita a Supabase local.");
  admin = createClient<Database>(url, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profiles = await admin.from("user_profiles").select("user_id");
  if (profiles.error) throw profiles.error;
  if (profiles.data.length)
    throw new Error(
      "E2E requiere socios sin asignar. No se modificaron perfiles existentes.",
    );
  const settings = await admin.from("business_settings").select("*").single();
  if (settings.error) throw settings.error;
  original = settings.data;
  for (const who of ["john", "sebas", "outsider"] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email[who],
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    if (who === "outsider") continue;
    const partner = await admin
      .from("partners")
      .select("id")
      .eq("code", who)
      .single();
    if (partner.error) throw partner.error;
    const insert = await admin.from("user_profiles").insert({
      user_id: data.user.id,
      partner_id: partner.data.id,
      display_name: who === "john" ? "John" : "Sebas",
    });
    if (insert.error) throw insert.error;
  }
  fixturesReady = true;
});
test.afterAll(async () => {
  if (!admin || !userIds.length) return;
  // Solo elimina fixtures creados por esta ejecución. La auditoría se conserva,
  // pero sus FK deben liberar las cuentas de prueba antes de eliminarlas.
  try {
    if (original && fixturesReady) {
      const john = client();
      const signedIn = await john.auth.signInWithPassword({
        email: email.john,
        password,
      });
      if (signedIn.error) throw signedIn.error;
      const current = await john
        .from("business_settings")
        .select("version")
        .single();
      if (current.error) throw current.error;
      const {
        business_name,
        default_deposit_percent,
        low_stock_grams,
        critical_stock_grams,
        reference_filament_kg_cost,
        energy_kwh_cost,
        labor_hour_cost,
      } = original;
      const restore = await john.rpc("update_business_settings", {
        p_changes: {
          business_name,
          default_deposit_percent,
          low_stock_grams,
          critical_stock_grams,
          reference_filament_kg_cost,
          energy_kwh_cost,
          labor_hour_cost,
        },
        p_expected_version: current.data.version,
        p_request_id: randomUUID(),
      });
      if (restore.error) throw restore.error;
    }
  } finally {
    for (const c of clients) await c.auth.signOut();
    const profiles = await admin
      .from("user_profiles")
      .delete()
      .in("user_id", userIds);
    if (profiles.error) throw profiles.error;
    // audit_log y mutation_requests conservan FK intencionalmente: limpieza de
    // fixtures desde el propietario SQL, únicamente en esta base local de pruebas.
    const quoted = userIds.map((id) => `'${id}'`).join(",");
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_KAPA-PROJECT",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `delete from private.mutation_requests where actor_id in (${quoted}); delete from public.audit_log where actor_id in (${quoted}) or (entity='user_profiles' and record_id in (${quoted}));`,
      ],
      { stdio: "ignore" },
    );
    for (const id of userIds) {
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) throw result.error;
    }
  }
});

test("John inicia sesión, persiste una configuración y consulta el historial", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Hola, John." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, John." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Configuración", exact: true }).click();
  await page
    .getByLabel("Nombre del negocio")
    .fill("KAPA 3D · Prueba de persistencia");
  await page.getByLabel("Tarifa de energía / kWh (COP)").fill("850.25");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cambios" }).click();
  await expect(
    page.getByText("Configuración guardada y registrada en el historial."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nombre del negocio")).toHaveValue(
    "KAPA 3D · Prueba de persistencia",
  );
  await expect(page.getByLabel("Tarifa de energía / kWh (COP)")).toHaveValue(
    "850.25",
  );
  await page.getByRole("link", { name: "Actividad", exact: true }).click();
  await expect(page.getByText("Actualización · John")).toBeVisible();
  await page.getByText("Ver detalle del cambio").first().click();
  await expect(
    page.getByText(/KAPA 3D · Prueba de persistencia/).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/actividad-desktop.png",
    fullPage: true,
  });
  await expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Qué bueno verte de nuevo." }),
  ).toBeVisible();
});

test("Sebas ve cambios compartidos, navega desde celular y no hay desbordamiento", async ({
  page,
}) => {
  const current = await admin
    .from("business_settings")
    .select("business_name")
    .single();
  if (current.error) throw current.error;
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, email.sebas);
  await expect(
    page.getByRole("heading", { name: "Hola, Sebas." }),
  ).toBeVisible();
  await expect(page.locator(".breadcrumb")).toContainText(
    current.data.business_name,
  );
  await page.screenshot({
    path: "test-results/inicio-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Socios y equipo" }).click();
  await expect(
    page.getByRole("heading", { name: "Dos socios. Una visión." }),
  ).toBeVisible();
  await expect(page.getByText("Acceso habilitado")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});

test("una cuenta autenticada sin asignación no accede a los datos ni puede escribir", async ({
  page,
}) => {
  await login(page, email.outsider);
  await expect(
    page.getByRole("heading", { name: "Tu acceso aún no está habilitado." }),
  ).toBeVisible();
  const outsider = client();
  const loginResult = await outsider.auth.signInWithPassword({
    email: email.outsider,
    password,
  });
  expect(loginResult.error).toBeNull();
  const read = await outsider.from("business_settings").select("*");
  expect(read.error).toBeNull();
  expect(read.data).toEqual([]);
  const write = await outsider.rpc("update_business_settings", {
    p_changes: { business_name: "Intrusión" },
    p_expected_version: 1,
    p_request_id: randomUUID(),
  });
  expect(write.error?.code).toBe("42501");
});

test("un usuario se registra con tres campos, queda protegido y un socio lo habilita desde la app", async ({
  page,
  browser,
}) => {
  // La cuenta de Sebas de esta ejecución se desasigna temporalmente para
  // comprobar la aprobación del segundo socio. Nunca se tocan cuentas reales.
  const unbind = await admin
    .from("user_profiles")
    .delete()
    .eq("user_id", userIds[1]);
  if (unbind.error) throw unbind.error;
  const registeredEmail = `registro-${run}@kapa.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Crea tu cuenta." }),
  ).toBeVisible();
  await expect(page.locator(".auth-form input")).toHaveCount(3);
  await page.getByLabel("Nombre", { exact: true }).fill("Sebas registro");
  await page.getByLabel("Correo electrónico").fill(registeredEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu acceso aún no está habilitado." }),
  ).toBeVisible();
  const users = await admin.auth.admin.listUsers();
  if (users.error) throw users.error;
  const created = users.data.users.find(
    (user) => user.email === registeredEmail,
  );
  if (!created) throw new Error("El registro no creó el usuario en Supabase.");
  userIds.push(created.id);
  expect(created.user_metadata.display_name).toBe("Sebas registro");
  const registration = await admin
    .from("registration_requests")
    .select("*")
    .eq("user_id", created.id)
    .single();
  expect(registration.data?.display_name).toBe("Sebas registro");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5174",
  });
  try {
    const owner = await context.newPage();
    await login(owner);
    await expect(
      owner.getByRole("heading", { name: "Hola, John." }),
    ).toBeVisible();
    await owner.getByRole("link", { name: "Socios y equipo" }).click();
    const row = owner
      .locator(".registration-row")
      .filter({ hasText: registeredEmail });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Habilitar acceso" }).click();
    await owner.getByRole("button", { name: "Confirmar acceso" }).click();
    await expect(
      owner.getByText(/Acceso habilitado para Sebas registro/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Comprobar acceso" }).click();
    await expect(
      page.getByRole("heading", { name: "Hola, Sebas registro." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Hola, Sebas registro." }),
    ).toBeVisible();
  } finally {
    await context.close();
    const removed = await admin
      .from("user_profiles")
      .delete()
      .eq("user_id", created.id);
    if (removed.error) throw removed.error;
    const partner = await admin
      .from("partners")
      .select("id")
      .eq("code", "sebas")
      .single();
    if (partner.error) throw partner.error;
    const restored = await admin
      .from("user_profiles")
      .insert({
        user_id: userIds[1],
        partner_id: partner.data.id,
        display_name: "Sebas",
      });
    if (restored.error) throw restored.error;
  }
});

test("API real aplica idempotencia, auditoría única y control de versión entre socios", async () => {
  const john = client(),
    sebas = client();
  expect(
    (await john.auth.signInWithPassword({ email: email.john, password })).error,
  ).toBeNull();
  expect(
    (await sebas.auth.signInWithPassword({ email: email.sebas, password }))
      .error,
  ).toBeNull();
  const settings = await john.from("business_settings").select("*").single();
  if (settings.error) throw settings.error;
  const args = {
    p_changes: { labor_hour_cost: "10000.50" },
    p_expected_version: settings.data.version,
    p_request_id: randomUUID(),
  };
  const first = await john.rpc("update_business_settings", args);
  expect(first.error).toBeNull();
  const retry = await john.rpc("update_business_settings", args);
  expect(retry.error).toBeNull();
  expect(retry.data).toEqual(first.data);
  const stale = await sebas.rpc("update_business_settings", {
    ...args,
    p_changes: { labor_hour_cost: "1" },
    p_request_id: randomUUID(),
  });
  expect(stale.error?.code).toBe("PT409");
  const latest = await sebas.from("business_settings").select("*").single();
  expect(latest.data?.labor_hour_cost).toBe(10000.5);
  const audits = await john
    .from("audit_log")
    .select("*")
    .eq("entity", "business_settings");
  expect(
    audits.data?.filter(
      (row) =>
        row.new_record &&
        typeof row.new_record === "object" &&
        "version" in row.new_record &&
        row.new_record.version === first.data?.version,
    ),
  ).toHaveLength(1);
});

test("recupera contraseña con un correo real del buzón local y un enlace de un solo uso", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(email.outsider);
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText(/Si el correo tiene una cuenta/)).toBeVisible();
  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        "http://127.0.0.1:54324/api/v1/messages",
      );
      const inbox = (await response.json()) as {
        messages: { ID: string; To: { Address: string }[] }[];
      };
      messageId = inbox.messages.find((message) =>
        message.To.some((to) => to.Address === email.outsider),
      )?.ID;
      return !!messageId;
    })
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${messageId}`,
  );
  const message = (await response.json()) as { Text: string; HTML: string };
  const link = (message.Text || message.HTML)
    .match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0]
    ?.replaceAll("&amp;", "&");
  if (!link || new URL(link).origin !== "http://127.0.0.1:54321")
    throw new Error(
      "El correo no contiene el enlace de recuperación local esperado.",
    );
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Tu contraseña" }),
  ).toBeVisible();
  const nextPassword = `Kapa!${randomUUID()}`;
  await page.getByLabel("Nueva contraseña").fill(nextPassword);
  await page.getByLabel("Confirmar contraseña").fill(nextPassword);
  await page.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(
    page.getByText("Contraseña actualizada correctamente."),
  ).toBeVisible();
  const recovered = client();
  expect(
    (
      await recovered.auth.signInWithPassword({
        email: email.outsider,
        password: nextPassword,
      })
    ).error,
  ).toBeNull();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu acceso aún no está habilitado." }),
  ).toBeVisible();
});
