import { describe, expect, it } from "vitest";
import { ADJECTIVES } from "./adjective";
import * as tables from "./tables";

const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);
const TABLES = Object.entries(tables).filter(
    (entry): entry is [string, tables.ScaleTable] => entry[1] instanceof Map,
);

// Book anomalies: level -1 strike damage lists high 1d4+1 and moderate 1d4 both as 3,
// and level -1 resistances and weaknesses are 1 at both ends.
const KNOWN_TIES = new Set(["STRIKE_DAMAGE -1", "RESISTANCES_AND_WEAKNESSES -1"]);

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
        ["SPELL_DC", 11, { extreme: 34, high: 30, moderate: 27 }],
        ["SPELL_ATTACK", 11, { extreme: 26, high: 22, moderate: 19 }],
        ["AREA_DAMAGE", -1, { limited: 4, unlimited: 2 }],
        ["AREA_DAMAGE", 5, { limited: 21, unlimited: 12 }],
        ["AREA_DAMAGE", 24, { limited: 88, unlimited: 39 }],
        ["RESISTANCES_AND_WEAKNESSES", 0, { maximum: 3, minimum: 1 }],
        ["RESISTANCES_AND_WEAKNESSES", 16, { maximum: 19, minimum: 9 }],
        ["RESISTANCES_AND_WEAKNESSES", 24, { maximum: 26, minimum: 13 }],
    ] as const)(
        "%s at level %i matches GM Core, ranges at their median",
        (name, level, columns) => {
            expect(tables[name].get(level)).toEqual(columns);
        },
    );
});

describe("levelBasedDc", () => {
    it.each([
        [0, 14],
        [3, 18],
        [12, 30],
        [20, 40],
        [25, 50],
    ])("reads GM Core's DC for level %i as %i", (level, dc) => {
        expect(tables.levelBasedDc(level)).toBe(dc);
    });

    it("reads levels off the table at the nearest row", () => {
        expect(tables.levelBasedDc(-1)).toBe(14);
        expect(tables.levelBasedDc(30)).toBe(50);
    });

    it("rises with every level", () => {
        const dcs = Array.from({ length: 26 }, (_, level) => tables.levelBasedDc(level));
        expect(dcs.every((dc, level) => level === 0 || dc > dcs[level - 1]!)).toBe(true);
    });
});
