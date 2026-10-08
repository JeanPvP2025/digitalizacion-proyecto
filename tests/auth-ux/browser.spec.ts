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

test("rate limit is Spanish and the email pause survives mode switches without automatic sends", async ({ page }) => {
  await page.clock.install();
  const attempts = await fakeAuth(page, { status: 429, body: { code: "over_email_send_rate_limit", msg: "email rate limit exceeded" } });
  await access(page);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Persona Ficticia");
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Ficticia123!");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("límite de envío");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("email rate limit exceeded");
  await expect(page.getByRole("button", { name: "Crear mi cuenta" })).toBeDisabled();
  await page.getByRole("button", { name: "Confirmar mi correo" }).click();
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("ficticia@example.invalid");
  await expect(page.getByRole("button", { name: "Solicitar enlace de confirmación" })).toBeDisabled();
  await page.getByRole("button", { name: "Volver a iniciar sesión" }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true }).last()).toBeEnabled();
  await page.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toBeEnabled();
  expect(attempts).toHaveLength(1);
});

test("invalid credentials preserve inputs and offer recovery without exposing provider details", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 400, body: { code: "invalid_credentials", msg: "Invalid login credentials" } });
  await access(page);
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  // Existing passwords must not be rejected by signup's new-password length rule.
  await page.getByLabel("Contraseña", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).last().click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Revisa ambos datos");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("Invalid login credentials");
  await page.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("ficticia@example.invalid");
  expect(attempts).toHaveLength(1);
});

test("signup and explicit confirmation retain current-origin callback and a neutral success", async ({ page }) => {
  await page.clock.install();
  const attempts = await fakeAuth(page, { status: 200, body: { user: { id: "fictitious", identities: [] }, session: null } });
  await access(page, "?next=%2Fcheckout%3Fpaso%3D2");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Persona Ficticia");
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Ficticia123!");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Confirma tu correo." })).toBeVisible();
  await expect(page.getByText("Si el registro necesita confirmación", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar enlace de confirmación" })).toBeDisabled();
  const callback = new URL(attempts[0].url.searchParams.get("redirect_to")!);
  expect(callback.origin).toBe("http://127.0.0.1:4349");
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("next")).toBe("/checkout?paso=2");
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Solicitar enlace de confirmación" }).click();
  await expect(page.getByText("Si hay una cuenta pendiente", { exact: false })).toBeVisible();
  expect(attempts[1].path).toBe("/auth/v1/resend");
  expect(attempts[1].body.type).toBe("signup");
  expect(new URL(attempts[1].url.searchParams.get("redirect_to")!).origin).toBe(callback.origin);
});

test("recovery uses a safe password-update callback and does not confirm account existence", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 200, body: {} }, 300);
  await access(page, "?modo=recuperar&next=https%3A%2F%2Fevil.invalid");
  await page.getByLabel("Correo electrónico").fill("ficticia@example.invalid");
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByRole("button", { name: "Un momento…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Volver a iniciar sesión" })).toBeDisabled();
  await expect(page.getByText("Si existe una cuenta para ese correo", { exact: false })).toBeVisible();
  expect(attempts).toHaveLength(1);
  const callback = new URL(attempts[0].url.searchParams.get("redirect_to")!);
  expect(callback.origin).toBe("http://127.0.0.1:4349");
  expect(callback.searchParams.get("next")).toBe("/acceso?modo=actualizar");
  await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toBeDisabled();
});

test("expired recovery callback gives a safe actionable error and unknown reason remains generic", async ({ page }) => {
  await fakeAuth(page, { status: 200, body: {} });
  await page.goto("/auth/callback?error=access_denied&error_code=otp_expired&error_description=private-token&next=%2Facceso%3Fmodo%3Dactualizar");
  await expect(page.getByRole("heading", { name: "Recupera el acceso." })).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toContainText("caducado o ya se ha utilizado");
  await expect(page.getByLabel("Nueva contraseña")).toHaveCount(0);
  expect(page.url()).not.toContain("private-token");
  await access(page, "?error=callback&motivo=private-token");
  await expect(page.locator("form").getByRole("alert")).toContainText("No se pudo completar el enlace");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("private-token");
});

test("password update without a session gives a route back to recovery", async ({ page }) => {
  const attempts = await fakeAuth(page, { status: 200, body: {} });
  await access(page, "?modo=actualizar");
  await page.getByLabel("Nueva contraseña").fill("Ficticia123!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("sesión ha caducado");
  await page.getByRole("button", { name: "Solicitar un nuevo enlace de recuperación" }).click();
  await expect(page.getByRole("heading", { name: "Recupera el acceso." })).toBeVisible();
  expect(attempts).toHaveLength(0);
});
