import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuotePostHandler,
  quoteInquirySchema,
  toQuoteInquiryInsert,
} from "./submit.ts";

const validSubmission = {
  companyName: "  Nodria Demo SL  ",
  contactName: "  Ana Demo  ",
  email: "  ANA.DEMO@EXAMPLE.COM  ",
  phone: "",
  volume: "1–5 equipos",
  message: "Necesitamos renovar varios equipos de oficina.",
  privacyAccepted: true,
};

function makeRequest(body = validSubmission, headers = {}) {
  return new Request("https://nodria.example/api/quotes", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeHandler(overrides = {}) {
  const savedSupabase = [];
  const savedDemo = [];
  const limits = [];
  const handler = createQuotePostHandler({
    mode: "supabase",
    persistSupabase: async (inquiry) => { savedSupabase.push(inquiry); },
    persistDemo: async (inquiry) => { savedDemo.push(inquiry); },
    consumeRateLimit: (...args) => { limits.push(args); return true; },
    now: () => new Date("2026-10-07T12:30:00.000Z"),
    randomUUID: () => "abcd1234-5678-90ab-cdef-112233445566",
    ...overrides,
  });
  return { handler, savedSupabase, savedDemo, limits };
}

test("accepts the form's volume options and normalizes email and names", () => {
  const parsed = quoteInquirySchema.parse(validSubmission);
  assert.equal(parsed.companyName, "Nodria Demo SL");
  assert.equal(parsed.contactName, "Ana Demo");
  assert.equal(parsed.email, "ana.demo@example.com");
  assert.equal(parsed.phone, "");
});

test("maps only anon-insert columns and preserves volume for CRM in message", () => {
  const parsed = quoteInquirySchema.parse(validSubmission);
  const insert = toQuoteInquiryInsert(parsed);
  assert.deepEqual(Object.keys(insert).sort(), ["company", "consent_to_contact", "contact_name", "email", "message", "phone"].sort());
  assert.deepEqual(insert, {
    contact_name: "Ana Demo",
    email: "ana.demo@example.com",
    phone: null,
    company: "Nodria Demo SL",
    message: "Volumen aproximado: 1–5 equipos\n\nNecesitamos renovar varios equipos de oficina.",
    consent_to_contact: true,
  });
});

test("rejects an invalid schema without attempting persistence", async () => {
  const { handler, savedSupabase } = makeHandler();
  const response = await handler(makeRequest({ ...validSubmission, privacyAccepted: false }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).persisted, undefined);
  assert.equal(savedSupabase.length, 0);
});

test("rejects forged CRM fields, unsupported volume values, and oversized form fields", async () => {
  const { handler, savedSupabase } = makeHandler();
  const cases = [
    { ...validSubmission, status: "qualified" },
    { ...validSubmission, volume: "200+" },
    { ...validSubmission, companyName: "N".repeat(121) },
    { ...validSubmission, email: "not-an-email" },
  ];
  for (const body of cases) {
    const response = await handler(makeRequest(body));
    assert.equal(response.status, 400);
  }
  assert.equal(savedSupabase.length, 0);
});

test("rejects filled honeypot without attempting persistence", async () => {
  const { handler, savedSupabase } = makeHandler();
  const response = await handler(makeRequest({ ...validSubmission, website: "https://spam.example" }));
  assert.equal(response.status, 400);
  assert.equal(savedSupabase.length, 0);
});

test("rejects malformed and oversized request bodies", async () => {
  const { handler, savedSupabase } = makeHandler();
  const malformed = await handler(makeRequest("{"));
  const oversized = await handler(makeRequest({ ...validSubmission, unused: "x".repeat(17_000) }));
  assert.equal(malformed.status, 400);
  assert.equal(oversized.status, 413);
  assert.equal(savedSupabase.length, 0);
});

test("applies the rate limit before validation and persistence", async () => {
  const { handler, savedSupabase, limits } = makeHandler({ consumeRateLimit: (...args) => { limits.push(args); return false; } });
  const response = await handler(makeRequest({ invalid: true }));
  assert.equal(response.status, 429);
  assert.equal(limits[0][0], "quote:203.0.113.10");
  assert.equal(limits[0][1], 4);
  assert.equal(limits[0][2], 60_000);
  assert.equal(savedSupabase.length, 0);
});

test("confirms Supabase persistence only after the insert callback succeeds", async () => {
  let confirmInsert;
  const { handler } = makeHandler({
    persistSupabase: () => new Promise((resolve) => { confirmInsert = resolve; }),
  });
  const result = handler(makeRequest());
  await new Promise((resolve) => setImmediate(resolve));
  let settled = false;
  result.finally(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  confirmInsert();
  const response = await result;
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { persisted: true, persistence: "supabase" });
});

test("returns no persisted confirmation when Supabase rejects the insert", async () => {
  const { handler } = makeHandler({ persistSupabase: async () => { throw new Error("permission denied"); } });
  const response = await handler(makeRequest());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).persisted, undefined);
});

test("marks local file persistence as demo and returns its demo reference", async () => {
  const { handler, savedDemo, savedSupabase } = makeHandler({ mode: "local-demo" });
  const response = await handler(makeRequest());
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.persisted, true);
  assert.equal(body.persistence, "local-demo");
  assert.equal(body.quoteId, "DEMO-QIN-2026-ABCD1234");
  assert.equal(savedDemo.length, 1);
  assert.equal(savedDemo[0].email, "ana.demo@example.com");
  assert.equal(savedSupabase.length, 0);
});

test("does not accept persistence when the environment is unavailable", async () => {
  const { handler, savedDemo, savedSupabase, limits } = makeHandler({ mode: "unavailable" });
  const response = await handler(makeRequest());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).persisted, undefined);
  assert.equal(savedDemo.length, 0);
  assert.equal(savedSupabase.length, 0);
  assert.equal(limits.length, 0);
});
