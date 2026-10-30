import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/chatbot/route";

describe("POST /api/chatbot API route", () => {
  it("returns welcome payload on empty message", async () => {
    const req = new Request("http://localhost:3000/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.text).toContain("Asistente NODRIA");
    expect(data.quickReplies).toBeDefined();
  });

  it("returns product recommendations with cards on relevant query", async () => {
    const req = new Request("http://localhost:3000/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Recomiéndame un switch Ubiquiti con PoE" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.products).toBeDefined();
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.products[0].product.brand.toLowerCase()).toContain("ubiquiti");
  });

  it("handles PC Builder Pro queries and links", async () => {
    const req = new Request("http://localhost:3000/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "¿Cómo sé si el procesador es compatible con la placa?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.text).toContain("Socket");
    expect(data.text).toContain("AM5");
  });

  it("rejects oversized message bodies with 400 Bad Request", async () => {
    const req = new Request("http://localhost:3000/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "a".repeat(600) }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
