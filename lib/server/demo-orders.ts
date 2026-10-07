import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertLocalDemoMode } from "@/lib/server/data-mode";

export type DemoOrderRecord = {
  id: string;
  orderNumber: string;
  idempotencyKey: string;
  createdAt: string;
  status: "confirmed" | "payment_processing" | "pending";
  paymentStatus: "approved" | "declined" | "invalid" | "insufficient_funds" | "processing" | "temporary_error";
  currency: "EUR";
  items: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; source: "catalogue" | "pc_builder" }>;
  customer: { name: string; email: string; phone: string; address: string; postalCode: string; city: string; province: string };
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  paymentAttempt: { id: string; method: string; status: string; createdAt: string };
  timeline: Array<{ event: string; label: string; createdAt: string }>;
};

const dataDirectory = join(process.cwd(), ".data");
const dataFile = join(dataDirectory, "orders.json");
let writeQueue: Promise<unknown> = Promise.resolve();

async function readRecords(): Promise<DemoOrderRecord[]> {
  assertLocalDemoMode();
  try {
    const contents = await readFile(dataFile, "utf8");
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed as DemoOrderRecord[] : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function persistDemoOrder(order: DemoOrderRecord): Promise<DemoOrderRecord> {
  assertLocalDemoMode();
  const operation = writeQueue.then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    const records = await readRecords();
    const existing = records.find((record) => record.idempotencyKey === order.idempotencyKey);
    if (existing) return existing;
    const next = [order, ...records];
    const temporaryFile = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(next, null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temporaryFile, dataFile);
    return order;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function getDemoOrderCount(): Promise<number> {
  assertLocalDemoMode();
  return (await readRecords()).length;
}

export async function getDemoOrderRecords(): Promise<DemoOrderRecord[]> {
  assertLocalDemoMode();
  return readRecords();
}
