import { describe, expect, it } from "vitest";
import {
  MAX_SAVED_PC_BUILDS,
  PC_BUILDER_SAVED_KEY,
  parsePcBuildSelection,
  parseSavedPcBuilds,
  prependSavedPcBuild,
  readSavedPcBuilds,
  removeSavedPcBuild,
  writeSavedPcBuilds,
  type PcBuilderStorage,
  type SavedPcBuild,
} from "@/lib/pc-builder/saved-builds";
import { pcBuilderCategories } from "@/lib/pc-builder/compatibility";

const variantId = "00000000-0000-4000-8000-000000000001";
const variantIdAt = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function selection() {
  return Object.fromEntries(pcBuilderCategories.map((category) => [category, category === "cpu" ? variantId : null]));
}

function build(id: string): SavedPcBuild {
  return { id, name: `Equipo ${id}`, savedAt: "2026-10-07T12:00:00.000Z", selection: selection() };
}

function memoryStorage(): PcBuilderStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe("PC Builder saved configurations", () => {
  it("stores and recovers selections by exact variant ID", () => {
    const storage = memoryStorage();
    const builds = [build("one")];
    expect(writeSavedPcBuilds(storage, builds)).toBe(true);
    expect(storage.getItem(PC_BUILDER_SAVED_KEY)).toContain(variantId);
    expect(readSavedPcBuilds(storage)).toEqual({ builds, invalidEntries: 0 });
  });

  it("restores a complete configuration with every selected sellable variant unchanged", () => {
    const storage = memoryStorage();
    const complete = Object.fromEntries(pcBuilderCategories.map((category, index) => [category, variantIdAt(index + 1)]));
    const saved = { ...build("complete"), selection: complete } as SavedPcBuild;
    expect(writeSavedPcBuilds(storage, [saved])).toBe(true);
    expect(readSavedPcBuilds(storage).builds[0].selection).toEqual(complete);
  });

  it("rejects malformed selections and invalid JSON safely", () => {
    expect(parsePcBuildSelection({ cpu: variantId })).toBeNull();
    expect(parsePcBuildSelection({ ...selection(), unexpected: "value" })).toBeNull();
    expect(parseSavedPcBuilds("not-json")).toEqual({ builds: [], invalidEntries: 1 });
    expect(parseSavedPcBuilds(JSON.stringify([{ ...build("ok"), selection: { cpu: 3 } }]))).toEqual({ builds: [], invalidEntries: 1 });
  });

  it("keeps a saved variant ID when that variant disappears so restore can show it as stale", () => {
    const saved = parseSavedPcBuilds(JSON.stringify([build("one")])).builds[0];
    expect(saved.selection.cpu).toBe(variantId);
    expect(parsePcBuildSelection(saved.selection)?.cpu).toBe(variantId);
  });

  it("caps the list and deletes only the selected saved configuration", () => {
    const many = Array.from({ length: MAX_SAVED_PC_BUILDS + 2 }, (_, index) => build(String(index)));
    const limited = prependSavedPcBuild([], many[0]);
    const all = many.reduce((result, item) => prependSavedPcBuild(result, item), limited);
    expect(all).toHaveLength(MAX_SAVED_PC_BUILDS);
    expect(removeSavedPcBuild(all, all[0].id)).toEqual(all.slice(1));
  });
});

