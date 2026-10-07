import { unlink } from "node:fs/promises";
import { cleanupFixtures, createAdminClient, loadFixtures } from "./fixtures";

export default async function globalTeardown() {
  const fixtures = await loadFixtures();
  await cleanupFixtures(createAdminClient(), fixtures);
  await unlink(`${process.cwd()}/.data/checkout-connected-fixtures.json`).catch(() => undefined);
}
