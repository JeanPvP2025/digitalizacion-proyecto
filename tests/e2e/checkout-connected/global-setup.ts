import { cleanupFixtures, createAdminClient, createFixtures, emptyFixtures, loadFixtures, writeFixtures } from "./fixtures";

export default async function globalSetup() {
  const admin = createAdminClient();
  try {
    await cleanupFixtures(admin, await loadFixtures());
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const fixtures = emptyFixtures();
  await writeFixtures(fixtures);
  try {
    await createFixtures(admin, fixtures);
    await writeFixtures(fixtures);
  } catch (error) {
    try { await cleanupFixtures(admin, fixtures); } catch { /* Keep the setup failure as the primary error. */ }
    throw error;
  }
}
