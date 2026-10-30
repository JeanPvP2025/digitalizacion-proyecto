import { expect, test } from "@playwright/test";

test.describe("NODRIA Chatbot Assistant E2E", () => {
  test("opens assistant, sends question, displays recommendations, and adds to cart", async ({ page }) => {
    // 1. Visit homepage
    await page.goto("/");

    // 2. Chatbot floating launcher is visible
    const launcher = page.getByRole("button", { name: /Asistente NODRIA|Abrir asistente/i });
    await expect(launcher).toBeVisible();

    // 3. Open chatbot
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: "Asistente NODRIA" });
    await expect(dialog).toBeVisible();

    // 4. Initial welcome message contains clean professional header
    await expect(page.getByText("Asistente NODRIA").first()).toBeVisible();
    await expect(page.getByText("Atención al cliente y asesoría técnica").first()).toBeVisible();

    // 5. Ask for PoE standards
    const input = page.getByRole("textbox", { name: /Escribe tu consulta/i });
    await input.fill("¿Qué es PoE?");
    await page.getByRole("button", { name: /Enviar mensaje/i }).click();

    // 6. Verify deterministic response
    await expect(page.getByText(/Power over Ethernet \(PoE\)/i)).toBeVisible();
    await expect(page.getByText(/802\.3af/i)).toBeVisible();

    // 7. Ask for switch recommendation
    await input.fill("Recomiéndame un switch Ubiquiti con PoE");
    await page.getByRole("button", { name: /Enviar mensaje/i }).click();

    // 8. Verify product card renders with real photo and "Añadir al carrito"
    const addToCartButton = page.getByRole("button", { name: /Añadir.*al carrito/i }).first();
    await expect(addToCartButton).toBeVisible();

    // 9. Click "Añadir al carrito" and verify cart increments
    await addToCartButton.click();
    await expect(page.getByRole("link", { name: /Carrito 1/i })).toBeVisible();

    // 10. Close / minimize chatbot
    const minimizeBtn = page.getByRole("button", { name: /Cerrar chat/i });
    await minimizeBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});
