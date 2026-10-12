import { expect, test, type Page } from "@playwright/test";

type Attempt = { path: string; url: URL; body: Record<string, unknown> };
async function fakeAuth(page: Page, response: { status: number; body: unknown }, delay = 0) {
  const attempts: Attempt[] = [];
  await page.route("http://127.0.0.1:57999/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "http://127.0.0.1:4349",
        "access-control-allow-headers": "*", "access-control-allow-methods": "*",
      } });
      return;
    }
    const url = new URL(request.url());
    attempts.push({ path: url.pathname, url, body: request.postDataJSON() ?? {} });
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({ status: response.status, json: response.body, headers: { "access-control-allow-origin": "http://127.0.0.1:4349" } });
  });
  return attempts;
}

async function access(page: Page, query = "") {
  await page.goto(`/acceso${query}`);
  await page.waitForLoadState("networkidle");
}

test("email-based Auth is not offered when Supabase tries to send a message", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 429, body: { code: "over_email_send_rate_limit", msg: "email rate limit exceeded" } });
  await access(page);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Persona Ficticia");
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Ficticia123!");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Confirm Email");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("email rate limit exceeded");
  expect(attempts).toHaveLength(1);
});

test("invalid credentials preserve inputs without offering email recovery", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 400, body: { code: "invalid_credentials", msg: "Invalid login credentials" } });
  await access(page);
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  // Existing passwords must not be rejected by signup's new-password length rule.
  await page.getByLabel("Contraseña", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).last().click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Revisa ambos datos");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("Invalid login credentials");
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("ficticia@example.invalid");
  await expect(page.getByText("Esta web no envía correos de recuperación.")).toBeVisible();
  await expect(page.getByRole("button", { name: "¿Has olvidado tu contraseña?" })).toHaveCount(0);
  expect(attempts).toHaveLength(1);
});

test("signup fails clearly when hosted Auth still requires confirmation", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 200, body: { user: { id: "fictitious", identities: [] }, session: null } });
  await access(page, "?next=%2Fcheckout%3Fpaso%3D2");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Persona Ficticia");
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Ficticia123!");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Supabase todavía exige confirmación");
  await expect(page.getByText("Se activa al instante; no enviaremos correos.")).toBeVisible();
  expect(attempts).toHaveLength(1);
  expect(attempts[0].url.searchParams.has("redirect_to")).toBe(false);
  expect(attempts[0].path).not.toBe("/auth/v1/resend");
});

test("the old recovery entry does not send email or expose a recovery form", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 200, body: {} });
  await access(page, "?modo=recuperar&next=https%3A%2F%2Fevil.invalid");
  await expect(page.getByRole("heading", { name: "Qué bueno verte." })).toBeVisible();
  await expect(page.getByText("Esta web no envía correos de recuperación.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toHaveCount(0);
  expect(attempts).toHaveLength(0);
});

test("expired callback gives a safe error without offering another email", async ({ page }) => {
  await fakeAuth(page, { status: 200, body: {} });
  await page.goto("/auth/callback?error=access_denied&error_code=otp_expired&error_description=private-token&next=%2Facceso%3Fmodo%3Dactualizar");
  await expect(page.getByRole("heading", { name: "Qué bueno verte." })).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toContainText("Inicia sesión de nuevo");
  expect(page.url()).not.toContain("private-token");
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toHaveCount(0);
});

test("password update without a session gives a route back to sign-in", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 200, body: {} });
  await access(page, "?modo=actualizar");
  await page.getByLabel("Nueva contraseña").fill("Ficticia123!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("sesión ha caducado");
  await expect(page.getByRole("button", { name: "Solicitar un nuevo enlace de recuperación" })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver a iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Qué bueno verte." })).toBeVisible();
  expect(attempts).toHaveLength(0);
});
