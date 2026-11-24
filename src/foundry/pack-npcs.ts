/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The packs directory of a https://github.com/foundryvtt/pf2e clone, for tests over real creatures. */
export const PACKS_DIR = process.env.PF2E_PACKS_DIR;

export const PACK_SYSTEMS = ["pf2e", "sf2e"] as const;

export interface PackNpc {
    readonly system: (typeof PACK_SYSTEMS)[number];
    /** The NPC document as the pack stores it. */
    readonly source: object;
}

/** Every NPC in both systems' packs; none when PF2E_PACKS_DIR is unset, as skipIf still collects suites. */
export function readPackNpcs(): PackNpc[] {
    const packsDir = PACKS_DIR;
    if (packsDir === undefined) return [];
    return PACK_SYSTEMS.flatMap((system) =>
        jsonFiles(join(packsDir, system)).flatMap((file) => {
            const source = JSON.parse(readFileSync(file, "utf8")) as { readonly type?: unknown };
            return source.type === "npc" ? [{ system, source }] : [];
        }),
    );
}

function jsonFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => join(entry.parentPath, entry.name));
}
