import { describe, expect, it } from "vitest";
import { applyAdjectives, rescaleStats, type Stat } from "./stats";

// Level 3: AC high 19, Fortitude moderate 9, HP moderate 48–42 (median 45).
const STATS: Stat<string>[] = [
    { id: "armorClass", kind: "armorClass", value: 20, target: "ac" },
    { id: "save:fortitude", kind: "save", value: 9, target: "fort" },
    { id: "hitPoints", kind: "hitPoints", value: 45, target: "hp" },
];

describe("rescaleStats", () => {
    it("moves every stat to its column at the new level, keeping offsets", () => {
        // Level 4: AC high 21, Fortitude moderate 11, HP moderate 63–57 (median 60).
        expect(rescaleStats(STATS, 3, 4)).toEqual([
            { target: "ac", from: 20, to: 22 },
            { target: "fort", from: 9, to: 11 },
            { target: "hp", from: 45, to: 60 },
        ]);
    });

    it("reports nothing when the level does not change", () => {
        expect(rescaleStats(STATS, 3, 3)).toEqual([]);
    });
});

describe("applyAdjectives", () => {
    it("sets the named stats to their exact column and leaves the rest", () => {
        const adjectives = new Map([["armorClass", "extreme"] as const]);
        expect(applyAdjectives(STATS, 3, adjectives)).toEqual([{ target: "ac", from: 20, to: 22 }]);
    });

    it("drops the offset when re-choosing the current adjective", () => {
        const adjectives = new Map([["armorClass", "high"] as const]);
        expect(applyAdjectives(STATS, 3, adjectives)).toEqual([{ target: "ac", from: 20, to: 19 }]);
    });

    it("skips a stat whose table lacks the adjective", () => {
        const adjectives = new Map([["hitPoints", "extreme"] as const]);
        expect(applyAdjectives(STATS, 3, adjectives)).toEqual([]);
    });
});
