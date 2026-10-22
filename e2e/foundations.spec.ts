import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/lib/database.types";
import type { Dashboard } from "../src/lib/operations";

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
    const restored = await admin.from("user_profiles").insert({
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

test("operación completa real: compra financiada, cotización, reservas, producción, cobros, deuda, utilidades y reportes", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const jsErrors: string[] = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  const john = client();
  const signed = await john.auth.signInWithPassword({
    email: email.john,
    password,
  });
  if (signed.error) throw signed.error;
  const previous = await john.from("business_settings").select("*").single();
  if (previous.error) throw previous.error;
  const configured = await john.rpc("update_business_settings", {
    p_changes: { energy_kwh_cost: "1000", labor_hour_cost: "5000" },
    p_expected_version: previous.data.version,
    p_request_id: randomUUID(),
  });
  if (configured.error) throw configured.error;
  const printerName = "Impresora " + run,
    customerName = "Cliente " + run,
    inlineCustomerName = "Cliente en cotización " + run,
    brand = "PLA " + run,
    description = "Llaveros " + run;
  const dialog = (name: string) =>
    page.getByRole("dialog", { name, exact: true });
  async function save(name: string, button = "Guardar operación") {
    const d = dialog(name);
    await d.getByRole("button", { name: button, exact: true }).click();
    await expect(d).not.toBeVisible();
  }
  async function go(label: string) {
    await page.getByRole("link", { name: label, exact: true }).click();
  }
  try {
    expect((await admin.from("cash_entries").select("id")).data).toHaveLength(
      0,
    );
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Hola, John." }),
    ).toBeVisible();
    await go("Finanzas");
    await page
      .getByRole("button", { name: "Registrar ingreso", exact: true })
      .click();
    let d = dialog("Registrar ingreso real");
    await d.getByLabel(/^Categoría/).selectOption("capital");
    await d.getByLabel(/^Valor \(COP\)/).fill("500000");
    await d.getByLabel(/^Descripción/).fill("Capital E2E");
    await save("Registrar ingreso real");
    await go("Inventario");
    await page
      .getByRole("button", { name: "Comprar filamento", exact: true })
      .click();
    d = dialog("Comprar filamento");
    await d.getByLabel(/^Marca/).fill(brand);
    await d.getByLabel(/^Color/).fill("Verde");
    await d.getByLabel(/^Costo total del rollo/).fill("90000");
    await d.getByLabel(/^Pago inicial/).fill("30000");
    await d.getByLabel(/^Número de cuotas/).fill("3");
    await d.getByLabel(/^Primer vencimiento/).fill("2030-01-01");
    await d.getByLabel(/^Interés por cuota/).fill("1000");
    await save("Comprar filamento");
    await expect(
      page.getByText("1.000", { exact: false }).first(),
    ).toBeVisible();
    await go("Impresoras");
    await page
      .getByRole("button", { name: "Agregar impresora", exact: true })
      .click();
    d = dialog("Nueva impresora");
    await d.getByLabel(/^Nombre/).fill(printerName);
    await d.getByLabel(/^Modelo/).fill("A1 Mini de prueba");
    await d.getByLabel(/^Precio de adquisición/).fill("1000000");
    await d.getByLabel(/^Vida útil/).fill("1000");
    await d.getByLabel(/^Potencia estimada/).fill("0.1");
    await save("Nueva impresora");
    await go("Clientes");
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    d = dialog("Nuevo cliente");
    await d.getByLabel(/^Nombre/).fill(customerName);
    await d.getByLabel(/^Teléfono/).fill("3001234567");
    await save("Nuevo cliente");
    const customer = await admin
      .from("customers")
      .select("id")
      .eq("name", customerName)
      .single();
    if (customer.error) throw customer.error;
    const printer = await admin
      .from("printers")
      .select("id")
      .eq("name", printerName)
      .single();
    if (printer.error) throw printer.error;
    const material = await admin
      .from("materials")
      .select("id")
      .eq("brand", brand)
      .single();
    if (material.error) throw material.error;
    const lot = await admin
      .from("inventory_lots")
      .select("id")
      .eq("material_id", material.data.id)
      .single();
    if (lot.error) throw lot.error;
    await go("Costos y cotizaciones");
    await page
      .getByRole("button", { name: "Nueva cotización", exact: true })
      .click();
    d = dialog("Nueva cotización");
    await d.getByLabel(/^Cliente/).selectOption(customer.data.id);
    await d.getByLabel(/^Descripción general/).fill(description);
    await d.getByLabel(/^Descripción del producto/).fill("Llavero verde");
    await d.getByLabel(/^Cantidad/).fill("2");
    await d.getByLabel(/^Impresora/).selectOption(printer.data.id);
    await d.getByLabel(/^Horas de impresión/).fill("2");
    await d.getByLabel(/^Rollo \/ color 1/).selectOption(lot.data.id);
    await d.getByLabel(/^Total de este color/).fill("15");
    await d.getByLabel(/^Precio manual por unidad/).fill("10650");
    await d.getByRole("button", { name: "Crear cliente", exact: true }).click();
    await dialog("Nuevo cliente")
      .getByLabel(/^Nombre/)
      .fill(inlineCustomerName);
    await save("Nuevo cliente");
    await expect(d.getByLabel(/^Horas de impresión/)).toHaveValue("2");
    await expect(d.getByLabel(/^Descripción general/)).toHaveValue(description);
    const inlineCustomer = await admin
      .from("customers")
      .select("id")
      .eq("name", inlineCustomerName)
      .single();
    if (inlineCustomer.error) throw inlineCustomer.error;
    await d.getByLabel(/^Cliente/).selectOption(inlineCustomer.data.id);
    await save("Nueva cotización", "Guardar cotización");
    const quote = await admin
      .from("quotes")
      .select("*")
      .eq("description", description)
      .single();
    expect(quote.error).toBeNull();
    expect(quote.data?.price_total).toBe(21300);
    expect(quote.data?.cost_total).toBe(3370);
    await page
      .getByRole("button", { name: "Convertir en pedido", exact: true })
      .click();
    d = dialog("Crear pedido desde cotización");
    await d.getByLabel(/^Fecha comprometida/).fill("2030-01-10T12:00");
    await save("Crear pedido desde cotización");
    await page.locator(".order-card").filter({ hasText: description }).click();
    await page
      .getByRole("button", { name: "Registrar cobro", exact: true })
      .click();
    d = dialog("Registrar dinero recibido");
    await d.getByLabel(/^Valor recibido/).fill("10650");
    await save("Registrar dinero recibido");
    await page
      .getByRole("button", { name: "Estado y entrega", exact: true })
      .click();
    d = dialog("Estado y fecha de entrega");
    await d.getByLabel(/^Estado/).selectOption("confirmed");
    await save("Estado y fecha de entrega");
    expect(
      (await admin.from("material_reservations").select("grams")).data?.[0]
        .grams,
    ).toBe(30);
    expect(
      (
        await admin
          .from("inventory_lots")
          .select("on_hand_grams")
          .eq("id", lot.data.id)
          .single()
      ).data?.on_hand_grams,
    ).toBe(1000);
    await page
      .getByRole("button", { name: "Reorganizar cola", exact: true })
      .click();
    d = dialog("Reorganizar cola de producción");
    await d.getByLabel(/^Prioridad/).selectOption("2");
    await d.getByRole("button", { name: "Confirmar prioridad" }).click();
    await expect(d).not.toBeVisible();
    await page
      .getByRole("button", { name: "Registrar producción", exact: true })
      .click();
    await save("Registrar producción real", "Registrar consumo y producción");
    expect(
      (
        await admin
          .from("inventory_lots")
          .select("on_hand_grams")
          .eq("id", lot.data.id)
          .single()
      ).data?.on_hand_grams,
    ).toBe(970);
    expect(
      (await admin.from("material_reservations").select("grams")).data?.[0]
        .grams,
    ).toBe(0);
    await page
      .getByRole("button", { name: "Registrar cobro", exact: true })
      .click();
    d = dialog("Registrar dinero recibido");
    await d.getByLabel(/^Valor recibido/).fill("10650");
    await save("Registrar dinero recibido");
    for (const state of ["ready_delivery", "delivered"]) {
      await page
        .getByRole("button", { name: "Estado y entrega", exact: true })
        .click();
      d = dialog("Estado y fecha de entrega");
      await d.getByLabel(/^Estado/).selectOption(state);
      await save("Estado y fecha de entrega");
    }
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/b9sAAAAASUVORK5CYII=",
      "base64",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "referencia-prueba.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page
      .getByRole("button", { name: "Guardar adjunto privado", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "referencia-prueba.png", exact: true }),
    ).toBeVisible();
    const storedFile = await admin
      .from("order_files")
      .select("object_path")
      .eq("created_by", userIds[0])
      .single();
    if (storedFile.error) throw storedFile.error;
    const retrieved = await john.storage
      .from("kapa-order-files")
      .download(storedFile.data.object_path);
    if (retrieved.error) throw retrieved.error;
    expect(Buffer.from(await retrieved.data.arrayBuffer())).toEqual(png);
    const anonymous = client();
    expect(
      (
        await anonymous.storage
          .from("kapa-order-files")
          .download(storedFile.data.object_path)
      ).error,
    ).not.toBeNull();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar formulario" })
      .click();
    await page
      .getByRole("tab", { name: "Tablero Kanban", exact: true })
      .click();
    await expect(page.locator(".order-status-summary > button")).toHaveCount(9);
    await expect(page.locator(".kanban-column")).toHaveCount(1);
    await expect(page.locator(".kanban-column")).toContainText("Entregado");
    await page.getByRole("tab", { name: "Calendario", exact: true }).click();
    await page.getByLabel("Mes del calendario").fill("2030-01");
    await expect(
      page.locator(".calendar-order").filter({ hasText: description }),
    ).toBeVisible();
    await go("Finanzas");
    await page.getByRole("tab", { name: "Deudas y cuotas" }).click();
    await page
      .getByRole("button", { name: "Registrar pago", exact: true })
      .click();
    await save("Pagar cuota o abonar deuda");
    await page.getByRole("tab", { name: "John y Sebas", exact: true }).click();
    await page
      .getByRole("button", { name: "Registrar adelanto", exact: true })
      .click();
    d = dialog("Entregar adelanto a socio");
    const partner = await admin
      .from("partners")
      .select("id")
      .eq("code", "john")
      .single();
    if (partner.error) throw partner.error;
    await d.getByLabel(/^Socio/).selectOption(partner.data.id);
    await d.getByLabel(/^Valor/).fill("2000");
    await d.getByLabel(/^Descripción/).fill("Adelanto E2E");
    await save("Entregar adelanto a socio");
    await page
      .getByRole("button", { name: "Liquidar utilidades", exact: true })
      .click();
    d = dialog("Liquidar utilidades 50 / 50");
    await d.getByLabel(/^Utilidad para reservar/).fill("6930");
    await save("Liquidar utilidades 50 / 50");
    let summary = await john.rpc("business_read", { p_section: "dashboard" });
    if (summary.error) throw summary.error;
    let dashboard = summary.data as unknown as Dashboard;
    expect(dashboard.summary.cumulative_profit).toBe(16930);
    expect(dashboard.summary.business_reserve).toBe(6930);
    expect(dashboard.partners[0].balance).toBe(3000);
    expect(dashboard.partners[1].balance).toBe(5000);
    await page
      .getByRole("button", { name: "Registrar retiro", exact: true })
      .click();
    d = dialog("Pagar retiro de utilidades");
    await d.getByLabel(/^Socio/).selectOption(partner.data.id);
    await d.getByLabel(/^Valor/).fill("3000");
    await d.getByLabel(/^Descripción/).fill("Retiro E2E");
    await save("Pagar retiro de utilidades");
    summary = await john.rpc("business_read", { p_section: "dashboard" });
    dashboard = summary.data as unknown as Dashboard;
    expect(dashboard.partners[0].balance).toBe(0);
    expect(dashboard.summary.cash).toBe(465300);
    expect(dashboard.summary.debt_balance).toBe(40000);
    await go("Reportes");
    await page.locator(".report-controls select").selectOption("cash");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    expect((await download).suggestedFilename()).toContain("KAPA-cash-");
    await page.getByRole("button", { name: "Imprimir / PDF" }).click();
    await expect(page.locator(".print-report")).toContainText("Capital E2E");
    await page.pdf({
      path: "test-results/kapa-reporte-real.pdf",
      format: "A4",
      landscape: true,
    });
    for (const kind of [
      "sales",
      "profitability",
      "costs",
      "consumption",
      "inventory",
      "expenses",
      "debts",
      "partners",
      "products",
      "customers",
    ]) {
      await page.locator(".report-controls select").selectOption(kind);
      await expect(
        page.getByRole("heading", { name: "No pudimos cargar los datos" }),
      ).toHaveCount(0);
      await expect(page.locator(".table-wrap table")).toBeVisible();
    }
    await go("Inicio");
    await expect(page.locator(".chart-container")).toHaveCount(6);
    await page.screenshot({
      path: "test-results/kapa-dashboard-operativo.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/",
      "/inventario",
      "/impresoras",
      "/cotizaciones",
      "/clientes",
      "/pedidos",
      "/finanzas",
      "/reportes",
    ]) {
      await page.goto(path);
      await expect(
        page
          .locator(
            ".business-stats,.resource-grid,.report-controls,.kanban-board",
          )
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
    }
    await page.screenshot({
      path: "test-results/kapa-operativo-mobile.png",
      fullPage: true,
    });
    expect(jsErrors).toEqual([]);
  } finally {
    const uid = userIds[0];
    if (!/^[a-f0-9-]{36}$/.test(uid)) throw Error("Fixture inválida");
    const attachedFiles = await admin
      .from("order_files")
      .select("object_path")
      .eq("created_by", uid);
    if (attachedFiles.data?.length) {
      const removed = await admin.storage
        .from("kapa-order-files")
        .remove(attachedFiles.data.map((f) => f.object_path));
      if (removed.error) throw removed.error;
    }
    const cleanup = `delete from public.advance_compensations where advance_id in(select a.id from public.partner_advances a join public.cash_entries c on c.id=a.cash_entry_id where c.created_by='${uid}');
delete from public.partner_allocations where settlement_id in(select id from public.settlements where created_by='${uid}');delete from public.settlements where created_by='${uid}';
delete from public.partner_advances where cash_entry_id in(select id from public.cash_entries where created_by='${uid}');delete from public.partner_withdrawals where cash_entry_id in(select id from public.cash_entries where created_by='${uid}');
delete from public.order_line_payments where cash_entry_id in(select id from public.cash_entries where created_by='${uid}');delete from public.order_deliveries where created_by='${uid}';delete from public.cash_entries where created_by='${uid}';delete from public.debt_payments where created_by='${uid}';delete from public.debt_installments where debt_id in(select id from public.debts where created_by='${uid}');delete from public.debts where created_by='${uid}';delete from public.purchases where created_by='${uid}';
delete from public.inventory_movements where created_by='${uid}';delete from public.production_runs where created_by='${uid}';delete from public.material_reservations where order_id in(select id from public.orders where created_by='${uid}');delete from public.order_files where created_by='${uid}';delete from public.order_lines where order_id in(select id from public.orders where created_by='${uid}');delete from public.orders where created_by='${uid}';delete from public.quote_lines where quote_id in(select id from public.quotes where created_by='${uid}');delete from public.quotes where created_by='${uid}';delete from public.maintenance_records where created_by='${uid}';
delete from public.inventory_lots where material_id in(select id from public.materials where brand='${brand}');delete from public.materials where brand='${brand}';delete from public.printers where name='${printerName}';delete from public.customers where name in ('${customerName}','${inlineCustomerName}');`;
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
      ],
      { input: cleanup, stdio: ["pipe", "ignore", "pipe"] },
    );
    const now = await john.from("business_settings").select("version").single();
    if (now.error) throw now.error;
    const restored = await john.rpc("update_business_settings", {
      p_changes: {
        energy_kwh_cost: previous.data.energy_kwh_cost,
        labor_hour_cost: previous.data.labor_hour_cost,
      },
      p_expected_version: now.data.version,
      p_request_id: randomUUID(),
    });
    if (restored.error) throw restored.error;
  }
});

test("marca, tarjeta sin caja negativa, saldos iniciales, minutos, insumos, edición y entregas parciales con Excel", async ({
  page,
}) => {
  test.setTimeout(180000);
  const john = client();
  const signed = await john.auth.signInWithPassword({
    email: email.john,
    password,
  });
  if (signed.error) throw signed.error;
  const uid = signed.data.user.id,
    tag = "Refinamiento " + run,
    printerId = randomUUID(),
    customerId = randomUUID();
  const opening = await admin.from("opening_balances").select("*").single();
  if (opening.error) throw opening.error;
  const settings = await john.from("business_settings").select("*").single();
  if (settings.error) throw settings.error;
  async function op(
    action: string,
    data: Database["public"]["Functions"]["business_operate"]["Args"]["p_data"],
  ) {
    const r = await john.rpc("business_operate", {
      p_action: action,
      p_data: data,
      p_request_id: randomUUID(),
    });
    if (r.error) throw r.error;
    return r.data;
  }
  const dialog = (name: string) =>
    page.getByRole("dialog", { name, exact: true });
  async function save(name: string, button = "Guardar operación") {
    const d = dialog(name);
    await d.getByRole("button", { name: button, exact: true }).click();
    await expect(d).not.toBeVisible();
  }
  async function go(label: string) {
    await page.getByRole("link", { name: label, exact: true }).click();
  }
  try {
    const updated = await john.rpc("update_business_settings", {
      p_changes: { energy_kwh_cost: 0, labor_hour_cost: 0 },
      p_expected_version: settings.data.version,
      p_request_id: randomUUID(),
    });
    if (updated.error) throw updated.error;
    await op("printer_save", {
      id: printerId,
      name: tag,
      model: "A1",
      acquisition_cost: 0,
      useful_hours: 1000,
      power_kw: 0,
    });
    await op("customer_save", { id: customerId, name: tag });
    await login(page);
    await go("Finanzas");
    await page
      .getByRole("button", { name: "Modificar saldos iniciales", exact: true })
      .click();
    let d = dialog("Modificar saldos iniciales");
    await d.getByLabel(/^Ingresos iniciales/).fill("2000");
    await d.getByLabel(/^Gastos iniciales/).fill("1000");
    await d.getByLabel(/^Dinero en caja/).fill("1000");
    await d.getByLabel(/^Origen o motivo/).fill("Datos anteriores de prueba");
    await save("Modificar saldos iniciales");
    await go("Inventario");
    await page
      .getByRole("button", { name: "Comprar filamento", exact: true })
      .click();
    d = dialog("Comprar filamento");
    await d.getByLabel(/^Marca/).fill(tag);
    await d.getByLabel(/^Color/).fill("Vinotinto");
    await d.getByLabel(/^Costo total/).fill("90000");
    await d.getByLabel(/^Forma de compra/).selectOption("credit_card");
    await expect(d.getByLabel(/^Pago inicial/)).toHaveValue("0");
    await d.getByLabel(/^Número de cuotas/).fill("3");
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
    }).format(new Date());
    await d.getByLabel(/^Primer vencimiento/).fill(date);
    await save("Comprar filamento");
    const lot = await admin
      .from("inventory_lots")
      .select("id,on_hand_grams,materials!inner(brand)")
      .eq("materials.brand", tag)
      .single();
    if (lot.error) throw lot.error;
    const cash = await john.rpc("business_read", { p_section: "cash" });
    expect(
      (cash.data as unknown as { summary: { cash: number } }).summary.cash,
    ).toBe(1000);
    await page
      .getByRole("tab", { name: "Rollos y existencias", exact: true })
      .click();
    await expect(
      page.getByText("Tarjeta de crédito", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Modificar cantidad actual", exact: true })
      .click();
    d = dialog("Modificar filamento actual");
    await d.getByLabel(/^Filamento actual/).fill("980");
    await d.getByLabel(/^Motivo/).fill("Conteo físico verificado");
    await save("Modificar filamento actual");
    await page
      .getByRole("tab", { name: "Pruebas y fallos", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Registrar prueba o fallo", exact: true })
      .click();
    d = dialog("Registrar prueba o impresión fallida");
    await d.getByLabel("Descripción", { exact: true }).fill(tag);
    await d.getByLabel(/^Impresora/).selectOption(printerId);
    await d.getByLabel("Minutos", { exact: true }).fill("30");
    await d.getByLabel(/^Rollo/).selectOption(lot.data.id);
    await d.getByLabel(/^Gramos consumidos/).fill("2");
    await save(
      "Registrar prueba o impresión fallida",
      "Guardar consumo sin venta",
    );
    expect(
      (
        await admin
          .from("inventory_lots")
          .select("on_hand_grams")
          .eq("id", lot.data.id)
          .single()
      ).data?.on_hand_grams,
    ).toBe(978);
    await go("Costos y cotizaciones");
    await page
      .getByRole("button", { name: "Nueva cotización", exact: true })
      .click();
    d = dialog("Nueva cotización");
    await d.getByLabel(/^Cliente/).selectOption(customerId);
    await d.getByLabel(/^Descripción general/).fill(tag);
    let piece = d.locator(".quote-line-editor").nth(0);
    await piece
      .getByLabel(/^Descripción del producto/)
      .fill("Pieza NFC personalizada");
    await piece.getByLabel(/^Cantidad/).fill("2");
    await piece.getByLabel(/^Impresora/).selectOption(printerId);
    await piece.getByLabel(/^Horas de impresión/).fill("1");
    await piece.getByLabel("Minutos", { exact: true }).fill("30");
    await piece.getByLabel(/^Rollo/).selectOption(lot.data.id);
    await piece.getByLabel(/^Total de este color/).fill("10");
    await piece
      .getByRole("button", { name: "Agregar insumo", exact: true })
      .click();
    await piece.getByLabel("Insumo", { exact: true }).fill("Chip NFC");
    await piece.getByLabel(/^Costo unitario del insumo/).fill("500");
    await d
      .getByRole("button", { name: "Agregar producto", exact: true })
      .click();
    piece = d.locator(".quote-line-editor").nth(1);
    await piece
      .getByLabel(/^Descripción del producto/)
      .fill("Pieza crema personalizada");
    await piece.getByLabel(/^Impresora/).selectOption(printerId);
    await piece.getByLabel(/^Horas de impresión/).fill("0");
    await piece.getByLabel("Minutos", { exact: true }).fill("15");
    await piece.getByLabel(/^Rollo/).selectOption(lot.data.id);
    await piece.getByLabel(/^Total de este color/).fill("5");
    await save("Nueva cotización", "Guardar cotización");
    let quote = await admin
      .from("quotes")
      .select("*")
      .eq("description", tag)
      .single();
    if (quote.error) throw quote.error;
    expect(quote.data.price_total).toBe(9750);
    await page
      .getByRole("button", { name: "Editar cotización", exact: true })
      .click();
    d = dialog("Editar cotización");
    await expect(
      d
        .locator(".quote-line-editor")
        .nth(0)
        .getByLabel("Minutos", { exact: true }),
    ).toHaveValue("30");
    await d.getByLabel(/^Descripción general/).fill(tag + " editada");
    await save("Editar cotización", "Guardar cotización");
    await page
      .getByRole("button", { name: "Convertir en pedido", exact: true })
      .click();
    d = dialog("Crear pedido desde cotización");
    await d.getByLabel(/^Fecha comprometida/).fill("2030-03-01T12:00");
    await save("Crear pedido desde cotización");
    const order = await admin
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .single();
    if (order.error) throw order.error;
    const lines = await admin
      .from("order_lines")
      .select("*")
      .eq("order_id", order.data.id);
    if (lines.error) throw lines.error;
    const line = lines.data.find(
      (l) => l.description === "Pieza NFC personalizada",
    )!;
    await op("order_update", {
      order_id: order.data.id,
      version: order.data.version,
      status: "confirmed",
      confirm_without_deposit: true,
    });
    await op("production_create", {
      line_id: line.id,
      good_units: 1,
      hours: "0.75",
      materials: [{ lot_id: lot.data.id, piece_grams: "10" }],
      extra_items: [{ description: "NFC", quantity: 1, unit_cost: 500 }],
    });
    await page.locator(".order-card").filter({ hasText: tag }).click();
    await page
      .getByRole("button", { name: "Editar pedido", exact: true })
      .click();
    d = dialog("Editar pedido");
    await d.getByLabel(/^Descripción del pedido/).fill(tag + " final");
    await save("Editar pedido");
    const item = page
      .locator(".order-line-list > div")
      .filter({ hasText: "Pieza NFC personalizada" });
    await item
      .getByRole("button", { name: "Entregar / corregir entrega", exact: true })
      .click();
    d = dialog("Entrega de piezas");
    await d.getByLabel(/^Total de unidades entregadas/).fill("1");
    await save("Entrega de piezas");
    await expect(
      item.getByText("1/2 entregadas", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar formulario", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Entregado por cobrar", exact: true })
      .click();
    await expect(
      page.locator(".order-card").filter({ hasText: tag + " final" }),
    ).toBeVisible();
    await go("Reportes");
    await page.locator(".report-controls select").selectOption("deliveries");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar Excel (.xlsx)", exact: true })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
    const path = await file.path();
    if (!path) throw Error("Sin XLSX descargado");
    const fs = await import("node:fs");
    const bytes = fs.readFileSync(path);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    for (const [kind, header] of [
      ["installments", "Financiación"],
      ["experiments", "Tipo"],
      ["opening", "Ingresos iniciales COP"],
    ]) {
      await page.locator(".report-controls select").selectOption(kind);
      await expect(
        page.getByRole("columnheader", { name: header, exact: true }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Todo a la vista.", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/kapa-vinotinto-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/finanzas");
    await expect(page.getByRole("heading", { name: /Este mes/ })).toBeVisible();
    await page.screenshot({
      path: "/tmp/kapa-vinotinto-finanzas.png",
      fullPage: true,
    });
  } finally {
    const cleanup = `delete from public.order_line_payments where cash_entry_id in(select id from public.cash_entries where created_by='${uid}');delete from public.order_deliveries where created_by='${uid}';delete from public.cash_entries where created_by='${uid}';delete from public.debt_payments where created_by='${uid}';delete from public.debt_installments where debt_id in(select id from public.debts where created_by='${uid}');delete from public.debts where created_by='${uid}';delete from public.purchases where created_by='${uid}';delete from public.inventory_movements where created_by='${uid}';delete from public.print_experiments where created_by='${uid}';delete from public.production_runs where created_by='${uid}';delete from public.material_reservations where order_id in(select id from public.orders where created_by='${uid}');delete from public.order_lines where order_id in(select id from public.orders where created_by='${uid}');delete from public.orders where created_by='${uid}';delete from public.quote_lines where quote_id in(select id from public.quotes where created_by='${uid}');delete from public.quotes where created_by='${uid}';delete from public.inventory_lots where material_id in(select id from public.materials where brand='${tag}');delete from public.materials where brand='${tag}';delete from public.printers where id='${printerId}';delete from public.customers where id='${customerId}';update public.opening_balances set income=${opening.data.income},expense=${opening.data.expense},cash_amount=${opening.data.cash_amount},effective_on='${opening.data.effective_on}',notes='',updated_by=null,version=version+1;`;
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
      ],
      { input: cleanup, stdio: ["pipe", "ignore", "pipe"] },
    );
    const current = await john
      .from("business_settings")
      .select("version")
      .single();
    if (current.error) throw current.error;
    const restore = await john.rpc("update_business_settings", {
      p_changes: {
        energy_kwh_cost: settings.data.energy_kwh_cost,
        labor_hour_cost: settings.data.labor_hour_cost,
      },
      p_expected_version: current.data.version,
      p_request_id: randomUUID(),
    });
    if (restore.error) throw restore.error;
  }
});

test("una base anterior muestra la actualización necesaria y recupera el espacio al actualizar", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const old = readFileSync(
      "supabase/migrations/20261021000100_operations.sql",
      "utf8",
    ),
    current = readFileSync(
      "supabase/migrations/20261023000100_easy_operations.sql",
      "utf8",
    );
  function definition(source: string, prefix: string) {
    const start = source.indexOf(prefix);
    const end = source.indexOf("end $$;", start) + 7;
    return (
      source
        .slice(start, end)
        .replace("create function", "create or replace function") +
      "\nnotify pgrst,'reload schema';"
    );
  }
  function sql(text: string) {
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
      ],
      { input: text, stdio: ["pipe", "ignore", "pipe"] },
    );
  }
  try {
    sql(definition(old, "create function public.business_read("));
    await login(page);
    await expect(
      page.getByRole("heading", {
        name: "Actualiza KAPA en Supabase",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Abrir SQL de actualización",
        exact: true,
      }),
    ).toHaveAttribute("href", /KAPA-3D-instalacion.sql$/);
    await expect(
      page.getByRole("link", { name: "Costos y cotizaciones", exact: true }),
    ).toHaveCount(0);
  } finally {
    sql(
      definition(current, "create or replace function public.business_read("),
    );
  }
  await page
    .getByRole("button", {
      name: "Ya ejecuté el SQL · Volver a intentar",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hola, John.", exact: true }),
  ).toBeVisible();
});

test("corregir compra a tarjeta, color resumido, pedido ya impreso sin anticipo y repetir impresión", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const john = client();
  const signed = await john.auth.signInWithPassword({
    email: email.john,
    password,
  });
  if (signed.error) throw signed.error;
  const uid = signed.data.user.id,
    tag = "Operación sencilla " + run,
    printerId = randomUUID(),
    lotId = randomUUID();
  const settings = await john.from("business_settings").select("*").single();
  if (settings.error) throw settings.error;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function op(
    action: string,
    data: Database["public"]["Functions"]["business_operate"]["Args"]["p_data"],
  ) {
    const r = await john.rpc("business_operate", {
      p_action: action,
      p_data: data,
      p_request_id: randomUUID(),
    });
    if (r.error) throw r.error;
    return r.data;
  }
  const dialog = (name: string) =>
    page.getByRole("dialog", { name, exact: true });
  async function save(name: string, button = "Guardar operación") {
    const d = dialog(name);
    await d.getByRole("button", { name: button, exact: true }).click();
    await expect(d).not.toBeVisible();
  }
  async function close() {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar formulario", exact: true })
      .click();
  }
  async function go(name: string) {
    await page.getByRole("link", { name, exact: true }).click();
  }
  try {
    const updated = await john.rpc("update_business_settings", {
      p_changes: { energy_kwh_cost: 0, labor_hour_cost: 0 },
      p_expected_version: settings.data.version,
      p_request_id: randomUUID(),
    });
    if (updated.error) throw updated.error;
    await op("printer_save", {
      id: printerId,
      name: tag,
      model: "A1",
      acquisition_cost: "16810476172.91",
      useful_hours: 1,
      power_kw: 0,
    });
    // Reproduce una compra histórica mal clasificada, sin inventar capital para ocultarla.
    await op("lot_purchase", {
      id: lotId,
      brand: tag,
      kind: "PLA",
      color: "Sin identificar",
      initial_grams: 1000,
      total: 90000,
      paid: 90000,
      financing: "cash",
      description: tag,
      allow_negative_cash: true,
      authorization_reason: "Compra histórica registrada con origen equivocado",
    });
    await login(page);
    await go("Inventario");
    await page
      .getByRole("tab", { name: "Rollos y existencias", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Editar forma de compra", exact: true })
      .click();
    let d = dialog("Corregir compra y financiación");
    await d.getByLabel(/^Forma de compra/).selectOption("credit_card");
    await expect(d.getByLabel(/^Pago inicial/)).toHaveValue("0");
    await d.getByLabel(/^Cuotas pendientes/).fill("3");
    await d.getByLabel(/^Primer vencimiento/).fill("2030-01-01");
    await d
      .getByLabel(/^Motivo/)
      .fill("El filamento se compró realmente con tarjeta");
    await save("Corregir compra y financiación");
    const cash = await john.rpc("business_read", { p_section: "cash" });
    expect(
      (cash.data as unknown as { summary: { cash: number } }).summary.cash,
    ).toBe(0);
    const purchase = await admin
      .from("purchases")
      .select("*")
      .eq("lot_id", lotId)
      .single();
    if (purchase.error) throw purchase.error;
    expect(purchase.data.financing).toBe("credit_card");
    expect(purchase.data.paid_initial).toBe(0);
    const debt = await admin
      .from("debts")
      .select("*")
      .eq("purchase_id", purchase.data.id)
      .single();
    if (debt.error) throw debt.error;
    expect(debt.data.principal).toBe(90000);
    await page
      .getByRole("button", { name: "Editar color y filamento", exact: true })
      .click();
    d = dialog("Editar filamento y color");
    await d.getByLabel(/^Nombre del color/).fill("Vinotinto KAPA");
    await d.getByLabel("Color visual", { exact: true }).fill("#4b081a");
    await save("Editar filamento y color");
    await page
      .getByRole("tab", { name: "Resumen por color", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Vinotinto KAPA", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Color Vinotinto KAPA", { exact: true }),
    ).toHaveCSS("background-color", "rgb(75, 8, 26)");
    await page.screenshot({
      path: "/tmp/kapa-filamento-resumen.png",
      fullPage: true,
    });
    await op("cash_create", {
      category: "capital",
      amount: 50000,
      description: "Aporte real de prueba",
    });
    await op("debt_pay", {
      debt_id: debt.data.id,
      principal: 30000,
      interest: 0,
    });
    await go("Finanzas");
    await page
      .getByRole("tab", { name: "Deudas y cuotas", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Editar deuda / compra", exact: true })
      .click();
    d = dialog("Corregir compra y financiación");
    await expect(d.getByLabel(/^Pago inicial/)).toHaveValue("0");
    await expect(d.getByLabel(/^Cuotas pendientes/)).toHaveValue("2");
    await d.getByLabel(/^Interés por cuota/).fill("50");
    await d
      .getByLabel(/^Motivo/)
      .fill("El banco confirmó dos cuotas pendientes");
    await save("Corregir compra y financiación");
    expect(
      (
        await admin
          .from("debt_payments")
          .select("id")
          .eq("debt_id", debt.data.id)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await admin
          .from("debt_installments")
          .select("id")
          .eq("debt_id", debt.data.id)
          .is("superseded_at", null)
      ).data,
    ).toHaveLength(2);
    const standalone = randomUUID();
    await op("loan_create", {
      id: standalone,
      description: tag + " préstamo",
      amount: 5000,
      installments: 2,
      next_due: "2030-01-01",
    });
    await page.reload();
    await page
      .getByRole("tab", { name: "Deudas y cuotas", exact: true })
      .click();
    await page
      .locator(".resource-card")
      .filter({ hasText: tag + " préstamo" })
      .getByRole("button", { name: "Editar deuda / compra", exact: true })
      .click();
    d = dialog("Editar deuda y cuotas pendientes");
    await d.getByLabel(/^Capital total pactado/).fill("7000");
    await d
      .getByLabel(/^Motivo/)
      .fill("Corrección del capital pactado sin recibir dinero nuevo");
    await save("Editar deuda y cuotas pendientes");
    const corrected = await john.rpc("business_read", { p_section: "cash" });
    expect(
      (corrected.data as unknown as { summary: { cash: number } }).summary.cash,
    ).toBe(25000);
    expect(
      (
        await admin
          .from("debts")
          .select("principal")
          .eq("description", tag + " préstamo")
          .single()
      ).data?.principal,
    ).toBe(7000);
    await go("Pedidos y producción");
    await page
      .getByRole("button", { name: "Nuevo pedido", exact: true })
      .click();
    d = dialog("Nuevo pedido");
    await d.getByLabel(/^Descripción general/).fill(tag);
    await d
      .getByLabel(/^Descripción del producto/)
      .fill("Pieza vinotinto ya impresa");
    await d.getByLabel(/^Impresora/).selectOption(printerId);
    await d.getByLabel(/^Rollo \/ color 1/).selectOption(lotId);
    await d.getByLabel(/^Total de este color/).fill("10");
    await d.getByLabel(/^Horas de impresión/).fill("1");
    await expect(d.getByText(/Amortización.*10/)).toBeVisible();
    await expect(
      d.getByRole("button", { name: /×3.*Recomendado/ }),
    ).toContainText("2.970");
    await d.getByRole("button", { name: "Crear cliente", exact: true }).click();
    await dialog("Nuevo cliente")
      .getByLabel(/^Nombre/)
      .fill(tag);
    await save("Nuevo cliente");
    const customer = await admin
      .from("customers")
      .select("id")
      .eq("name", tag)
      .single();
    if (customer.error) throw customer.error;
    await expect(d.getByLabel(/^Cliente/)).toHaveValue(customer.data.id);
    await expect(d.getByLabel(/^Total de este color/)).toHaveValue("10");
    await d.getByLabel(/^Fecha de entrega/).fill("2030-01-01T12:00");
    await d.getByLabel(/^Estas piezas ya están impresas/).check();
    await d.getByLabel(/^Estado real/).selectOption("delivered");
    await save("Nuevo pedido", "Guardar pedido");
    const order = await admin
      .from("orders")
      .select("*")
      .eq("description", tag)
      .single();
    if (order.error) throw order.error;
    expect(order.data.status).toBe("delivered");
    expect(order.data.price_total).toBe(2970);
    expect(order.data.estimated_cost).toBe(990);
    const production = await admin
      .from("production_runs")
      .select("depreciation_cost,order_lines!inner(order_id)")
      .eq("order_lines.order_id", order.data.id)
      .single();
    if (production.error) throw production.error;
    expect(production.data.depreciation_cost).toBe(90);
    const lot = await admin
      .from("inventory_lots")
      .select("on_hand_grams")
      .eq("id", lotId)
      .single();
    expect(lot.data?.on_hand_grams).toBe(990);
    await expect(
      page.getByRole("dialog").getByText("Pendiente", { exact: true }),
    ).toBeVisible();
    // Corregir el estado de un trabajo ya registrado no devuelve material consumido.
    await page
      .getByRole("button", { name: "Estado y entrega", exact: true })
      .click();
    d = dialog("Estado y fecha de entrega");
    await d.getByLabel(/^Estado/).selectOption("printing");
    await d
      .getByLabel(/^Motivo si corriges/)
      .fill("La entrega se marcó por error al registrar");
    await save("Estado y fecha de entrega");
    await close();
    await expect(
      page.getByRole("button", { name: "Ver quiénes deben", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ver quiénes deben", exact: true })
      .click();
    await expect(
      page.locator(".order-card").filter({ hasText: tag }),
    ).toContainText("Sin anticipo");
    await page.locator(".order-card").filter({ hasText: tag }).click();
    await page
      .getByRole("link", {
        name: "Cotizar otra vez esta impresión",
        exact: true,
      })
      .click();
    d = dialog("Repetir impresión en cotización");
    await expect(d.getByLabel(/^Total de este color/)).toHaveValue("10");
    await d.getByLabel(/^Descripción general/).fill(tag + " repetido");
    await d.getByRole("button", { name: "Repetir pieza", exact: true }).click();
    await expect(d.locator(".quote-line-editor")).toHaveCount(2);
    await save("Repetir impresión en cotización", "Guardar cotización");
    const repeated = await admin
      .from("quotes")
      .select("price_total")
      .eq("description", tag + " repetido")
      .single();
    expect(repeated.data?.price_total).toBe(5940);
    await go("Pedidos y producción");
    await expect(
      page.getByRole("tab", { name: "Tablero Kanban", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator(".kanban-column").filter({ hasText: "Imprimiendo" }),
    ).toContainText(tag);
    await page.screenshot({
      path: "/tmp/kapa-pedidos-tablero.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await go("Inventario");
    await expect(
      page.getByRole("heading", { name: "Vinotinto KAPA", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/kapa-filamento-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    const cleanup = `delete from public.order_line_payments where cash_entry_id in(select id from public.cash_entries where created_by='${uid}');delete from public.order_deliveries where created_by='${uid}';delete from public.cash_entries where created_by='${uid}';delete from public.debt_payments where created_by='${uid}';delete from public.debt_installments where debt_id in(select id from public.debts where created_by='${uid}');delete from public.debts where created_by='${uid}';delete from public.purchases where created_by='${uid}';delete from public.inventory_movements where created_by='${uid}';delete from public.production_runs where created_by='${uid}';delete from public.material_reservations where order_id in(select id from public.orders where created_by='${uid}');delete from public.order_lines where order_id in(select id from public.orders where created_by='${uid}');delete from public.orders where created_by='${uid}';delete from public.quote_lines where quote_id in(select id from public.quotes where created_by='${uid}');delete from public.quotes where created_by='${uid}';delete from public.inventory_lots where id='${lotId}';delete from public.materials where brand='${tag}';delete from public.printers where id='${printerId}';delete from public.customers where name='${tag}';`;
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
      ],
      { input: cleanup, stdio: ["pipe", "ignore", "pipe"] },
    );
    const current = await john
      .from("business_settings")
      .select("version")
      .single();
    if (current.error) throw current.error;
    const restore = await john.rpc("update_business_settings", {
      p_changes: {
        energy_kwh_cost: settings.data.energy_kwh_cost,
        labor_hour_cost: settings.data.labor_hour_cost,
      },
      p_expected_version: current.data.version,
      p_request_id: randomUUID(),
    });
    if (restore.error) throw restore.error;
  }
});
