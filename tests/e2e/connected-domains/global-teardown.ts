import { unlink } from "node:fs/promises";
import { cleanupFixtures, createAdminClient, loadFixtures } from "./fixtures";

export default async function globalTeardown() {
  try {
    await cleanupFixtures(createAdminClient(), await loadFixtures());
  } finally {
    await unlink(process.cwd() + "/.data/connected-domains-fixtures.json").catch(() => undefined);
  }
}
