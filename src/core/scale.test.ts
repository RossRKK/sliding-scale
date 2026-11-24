import { describe, expect, it } from "vitest";
import { adjectivesOf, columnValue, derive, rescale } from "./scale";
import { ARMOR_CLASS, ATTRIBUTE_MODIFIERS, HIT_POINTS, SAVING_THROWS } from "./tables";

describe("derive", () => {
    it.each([
        ["an exact column", 19, { adjective: "high", offset: 0 }],
        ["above the top column", 24, { adjective: "extreme", offset: 2 }],
        ["between columns", 21, { adjective: "extreme", offset: -1 }],
        ["below the bottom column", 14, { adjective: "low", offset: -2 }],
    ] as const)("rates %s by its nearest column", (_case, value, rating) => {
        expect(derive(ARMOR_CLASS, 3, value)).toEqual(rating);
    });

    it("breaks a tie towards the higher column", () => {
        // Level 3 AC: moderate 18, low 16.
        expect(derive(ARMOR_CLASS, 3, 17)).toEqual({ adjective: "moderate", offset: -1 });
    });

    it("rates against a column the level lacks at the nearest level that has it", () => {
        // No extreme attribute below level 1, where it is 5.
        expect(derive(ATTRIBUTE_MODIFIERS, 0, 6)).toEqual({ adjective: "extreme", offset: 1 });
    });

    it("rates range tables against the median", () => {
        // Level 1 HP: high 26–24, moderate 21–19, low 16–14.
        expect(derive(HIT_POINTS, 1, 20)).toEqual({ adjective: "moderate", offset: 0 });
    });

    it("rates a level off the table against the nearest level", () => {
        // Level 24 high AC is 51.
        expect(derive(ARMOR_CLASS, 25, 52)).toEqual({ adjective: "high", offset: 1 });
    });
});

describe("rescale", () => {
    it("keeps the adjective and offset", () => {
        // Level 3 high 19 + 1 becomes level 10 high 30 + 1.
        expect(rescale(ARMOR_CLASS, 3, 10, 20)).toBe(31);
    });

    it("is undone by the reverse level change", () => {
        expect(rescale(ARMOR_CLASS, 10, 3, 31)).toBe(20);
    });

    it("round-trips through a level that lacks the stat's column", () => {
        // Extreme 5 at level 1 keeps level 1's extreme at level 0, then comes back.
        expect(rescale(ATTRIBUTE_MODIFIERS, 1, 0, 5)).toBe(5);
        expect(rescale(ATTRIBUTE_MODIFIERS, 0, 1, 5)).toBe(5);
        // Extreme +1 at level 3 used to keep its 6 at level 0 and come back as high +2, 6 → 7.
        expect(rescale(ATTRIBUTE_MODIFIERS, 0, 3, rescale(ATTRIBUTE_MODIFIERS, 3, 0, 6)!)).toBe(6);
    });

    it("treats levels off the table as the nearest level on it", () => {
        expect(rescale(ARMOR_CLASS, 3, 25, 19)).toBe(51);
        expect(rescale(ARMOR_CLASS, 25, 30, 53)).toBe(53);
        expect(rescale(ARMOR_CLASS, 25, 3, 53)).toBe(21);
    });
});

describe("columnValue", () => {
    it("is the exact value, with no offset", () => {
        expect(columnValue(ARMOR_CLASS, 3, "extreme")).toBe(22);
    });

    it("is absent for a column the table does not have", () => {
        expect(columnValue(ARMOR_CLASS, 3, "terrible")).toBeUndefined();
    });
});

describe("adjectivesOf", () => {
    it("lists every column the table has at any level, highest first", () => {
        expect(adjectivesOf(ATTRIBUTE_MODIFIERS)).toEqual(["extreme", "high", "moderate", "low"]);
        expect(adjectivesOf(SAVING_THROWS)).toEqual([
            "extreme",
            "high",
            "moderate",
            "low",
            "terrible",
        ]);
    });
});
