import { describe, expect, it } from "vitest";
import { rescaleDescription } from "../core/description-values";
import { PACKS_DIR, readPackNpcs } from "./pack-npcs";

/** Enrichers and inline rolls found in pack descriptions, and whether each must be reported. */
interface Construct {
    readonly text: string;
    readonly fixed: boolean;
}

const CHECK = /@Check\[[^\]]*\]/g;
const DAMAGE = /@Damage\[(?:[^[\]]|\[[^\]]*\])*\]/g;
const INLINE_ROLL = /\[\[\/(?:r|roll|gmr|gmroll|br|blindroll|pr|publicroll)\s[^\]]*\]\]/g;

// Ten levels apart, so every fixed DC and damage roll the table can rate changes.
const touched = (text: string) => {
    const { values, unscaled } = rescaleDescription(text, 5, 15, []);
    return values.length + unscaled.length > 0;
};

describe.skipIf(PACKS_DIR === undefined)("fixed values in every pack NPC ability", () => {
    const descriptions = readPackNpcs().flatMap(({ source }) => abilityDescriptions(source));
    const constructs = descriptions.flatMap(constructsIn);

    it("reads ability descriptions from the packs", () => {
        expect(descriptions.length).toBeGreaterThan(0);
    });

    it("never reports a value that follows the actor, a flat check or a recharge roll", () => {
        const reported = constructs
            .filter(({ fixed }) => !fixed)
            .filter(
                ({ text }) => touched(text) || rescaleDescription(text, 5, 15, []).text !== text,
            );
        expect(reported.slice(0, 20).map(({ text }) => text)).toEqual([]);
    });

    it("rescales or reports every numeric DC and fixed damage roll", () => {
        const missed = constructs.filter(({ fixed }) => fixed).filter(({ text }) => !touched(text));
        expect(missed.slice(0, 20).map(({ text }) => text)).toEqual([]);
    });
});

function constructsIn(description: string): Construct[] {
    const all = (pattern: RegExp) => [...description.matchAll(pattern)].map(([text]) => text);
    return [
        ...all(CHECK).flatMap((text): Construct[] => {
            const dc = /\|dc:([^|\]]*)/.exec(text)?.[1];
            if (dc === undefined) return [];
            return [{ text, fixed: /^\d+$/.test(dc.trim()) && !text.startsWith("@Check[flat") }];
        }),
        ...all(DAMAGE).map((text) => ({ text, fixed: !followsActor(text) && /\d/.test(text) })),
        ...all(INLINE_ROLL).map((text) => ({
            text,
            fixed: !followsActor(text) && !/recharge/i.test(text) && /\d+d\d+/.test(text),
        })),
    ];
}

function followsActor(text: string): boolean {
    return /resolve\(|@actor|@item/.test(text);
}

/** NPC abilities and strikes; spells and gear scale with their own rank or item level. */
function abilityDescriptions(source: object): string[] {
    const items = (source as { items?: readonly unknown[] }).items ?? [];
    return items.flatMap((item) => {
        const { type, system } = item as {
            type?: string;
            system?: { description?: { value?: unknown } };
        };
        const text = system?.description?.value;
        return (type === "action" || type === "melee") && typeof text === "string" && text !== ""
            ? [text]
            : [];
    });
}
