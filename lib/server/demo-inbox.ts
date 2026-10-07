import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertLocalDemoMode } from "@/lib/server/data-mode";

export type DemoQuoteInquiry = { id: string; createdAt: string; status: "new"; companyName: string; contactName: string; email: string; phone: string; volume: string; message: string };
export type DemoSupportTicket = { id: string; createdAt: string; status: "open"; subject: string; message: string; email: string; orderNumber: string };
type InboxKind = "quotes" | "tickets";
const directory = join(process.cwd(), ".data");
const queues = new Map<InboxKind, Promise<unknown>>();

async function read<T>(kind: InboxKind): Promise<T[]> {
  assertLocalDemoMode();
  try {
    const result: unknown = JSON.parse(await readFile(join(directory, `${kind}.json`), "utf8"));
    return Array.isArray(result) ? result as T[] : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function append<T>(kind: InboxKind, record: T): Promise<void> {
  assertLocalDemoMode();
  const task = (queues.get(kind) ?? Promise.resolve()).then(async () => {
    await mkdir(directory, { recursive: true });
    const target = join(directory, `${kind}.json`);
    const records = await read<T>(kind);
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify([record, ...records], null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  });
  queues.set(kind, task.catch(() => undefined));
  await task;
}

export const saveDemoQuoteInquiry = (record: DemoQuoteInquiry) => append("quotes", record);
export const saveDemoSupportTicket = (record: DemoSupportTicket) => append("tickets", record);
