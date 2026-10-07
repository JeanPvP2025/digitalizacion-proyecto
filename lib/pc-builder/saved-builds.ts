import { pcBuilderCategories } from "./compatibility";
import type { PcBuildSelection } from "./types";

export const PC_BUILDER_SAVED_KEY = "nodria.pc-builds.v2";
export const MAX_SAVED_PC_BUILDS = 10;

export type SavedPcBuild = {
  id: string;
  name: string;
  savedAt: string;
  selection: PcBuildSelection;
};

export type PcBuilderStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parsePcBuildSelection(value: unknown): PcBuildSelection | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const selection = value as Record<string, unknown>;
  const keys = Object.keys(selection);
  if (keys.length !== pcBuilderCategories.length ||
      !pcBuilderCategories.every((category) => Object.prototype.hasOwnProperty.call(selection, category)) ||
      !keys.every((key) => pcBuilderCategories.includes(key as (typeof pcBuilderCategories)[number]))) return null;
  if (!pcBuilderCategories.every((category) => selection[category] === null ||
      (typeof selection[category] === "string" && selection[category].length > 0))) return null;
  return selection as PcBuildSelection;
}

export function parseSavedPcBuilds(serialized: string | null): { builds: SavedPcBuild[]; invalidEntries: number } {
  if (serialized === null) return { builds: [], invalidEntries: 0 };

  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return { builds: [], invalidEntries: 1 };

    const builds: SavedPcBuild[] = [];
    let invalidEntries = 0;
    for (const entry of value) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        invalidEntries += 1;
        continue;
      }
      const saved = entry as Record<string, unknown>;
      const selection = parsePcBuildSelection(saved.selection);
      if (typeof saved.id !== "string" || saved.id.length === 0 || typeof saved.name !== "string" ||
          saved.name.trim().length === 0 || typeof saved.savedAt !== "string" || !selection) {
        invalidEntries += 1;
        continue;
      }
      builds.push({ id: saved.id, name: saved.name.trim().slice(0, 60), savedAt: saved.savedAt, selection });
    }
    return { builds: builds.slice(0, MAX_SAVED_PC_BUILDS), invalidEntries };
  } catch {
    return { builds: [], invalidEntries: 1 };
  }
}

export function prependSavedPcBuild(builds: readonly SavedPcBuild[], build: SavedPcBuild): SavedPcBuild[] {
  return [build, ...builds.filter((item) => item.id !== build.id)].slice(0, MAX_SAVED_PC_BUILDS);
}

export function removeSavedPcBuild(builds: readonly SavedPcBuild[], id: string): SavedPcBuild[] {
  return builds.filter((build) => build.id !== id);
}

export function readSavedPcBuilds(storage: PcBuilderStorage): { builds: SavedPcBuild[]; invalidEntries: number } {
  return parseSavedPcBuilds(storage.getItem(PC_BUILDER_SAVED_KEY));
}

export function writeSavedPcBuilds(storage: PcBuilderStorage, builds: readonly SavedPcBuild[]): boolean {
  try {
    storage.setItem(PC_BUILDER_SAVED_KEY, JSON.stringify(builds.slice(0, MAX_SAVED_PC_BUILDS)));
    return true;
  } catch {
    return false;
  }
}

