import { describe, expect, it } from "vitest";
import { ADJECTIVES } from "./adjective";
import * as tables from "./tables";

const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);
const TABLES = Object.entries(tables).filter(
    (entry): entry is [string, tables.ScaleTable] => entry[1] instanceof Map,
);

// Book anomalies: level -1 strike damage lists high 1d4+1 and moderate 1d4 both as 3.
const KNOWN_TIES = new Set(["STRIKE_DAMAGE -1"]);

describe.each(TABLES)("%s", (name, table) => {
    it("covers levels -1 to 24", () => {
        expect([...table.keys()]).toEqual(LEVELS);
    });

    it.each(LEVELS)("is strictly ordered at level %i so derivation is unambiguous", (level) => {
        const columns = table.get(level) ?? {};
        const values = ADJECTIVES.flatMap((adjective) => columns[adjective] ?? []);
        const descending = values.toSorted((a, b) => b - a);
        expect(values).toEqual(descending);
        const ties = KNOWN_TIES.has(`${name} ${level}`) ? 1 : 0;
        expect(new Set(values).size).toBe(values.length - ties);
    });
});

describe("transcription", () => {
    it.each([
        ["ATTRIBUTE_MODIFIERS", 0, { high: 3, moderate: 2, low: 0 }],
        ["ATTRIBUTE_MODIFIERS", 24, { extreme: 13, high: 12, moderate: 9, low: 7 }],
        ["PERCEPTION", 10, { extreme: 24, high: 22, moderate: 19, low: 16, terrible: 14 }],
        ["SKILLS", 3, { extreme: 13, high: 10, moderate: 9, low: 6 }],
        ["ARMOR_CLASS", 1, { extreme: 19, high: 16, moderate: 15, low: 13 }],
        ["SAVING_THROWS", 24, { extreme: 46, high: 42, moderate: 38, low: 36, terrible: 32 }],
        ["HIT_POINTS", -1, { high: 9, moderate: 8, low: 6 }],
        ["HIT_POINTS", 0, { high: 19, moderate: 15, low: 12 }],
        ["STRIKE_ATTACK_BONUS", 7, { extreme: 20, high: 18, moderate: 16, low: 13 }],
        ["STRIKE_DAMAGE", -1, { extreme: 4, high: 3, moderate: 3, low: 2 }],
        ["STRIKE_DAMAGE", 7, { extreme: 25, high: 20, moderate: 17, low: 13 }],
        ["SPELL_DC", 11,{ extreme: 34, high: 30, moderate: 27 }],
        ["SPELL_ATTACK", 11, { extreme: 26, high: 22, moderate: 19 }],
    ] as const)(
        "%s at level %i matches GM Core, ranges at their median",
        (name, level, columns) => {
            expect(tables[name].get(level)).toEqual(columns);
        },
    );
});
