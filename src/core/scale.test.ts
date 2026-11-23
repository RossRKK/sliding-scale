import { describe, expect, it } from "vitest";
import { adjectivesAt, columnValue, derive, rescale } from "./scale";
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

    it("skips columns the level does not have", () => {
        expect(derive(ATTRIBUTE_MODIFIERS, 0, 6)).toEqual({ adjective: "high", offset: 3 });
    });

    it("rates range tables against the median", () => {
        // Level 1 HP: high 26–24, moderate 21–19, low 16–14.
        expect(derive(HIT_POINTS, 1, 20)).toEqual({ adjective: "moderate", offset: 0 });
    });

    it("has no rating off the end of the table", () => {
        expect(derive(ARMOR_CLASS, 25, 50)).toBeUndefined();
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

    it("leaves the stat alone when the new level lacks its column", () => {
        expect(rescale(ATTRIBUTE_MODIFIERS, 1, 0, 5)).toBeUndefined();
    });

    it("leaves the stat alone when either level is off the table", () => {
        expect(rescale(ARMOR_CLASS, 3, 25, 19)).toBeUndefined();
        expect(rescale(ARMOR_CLASS, -2, 3, 19)).toBeUndefined();
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

describe("adjectivesAt", () => {
    it("lists only the columns present at that level, highest first", () => {
        expect(adjectivesAt(ATTRIBUTE_MODIFIERS, 0)).toEqual(["high", "moderate", "low"]);
        expect(adjectivesAt(SAVING_THROWS, 0)).toEqual([
            "extreme",
            "high",
            "moderate",
            "low",
            "terrible",
        ]);
    });
});
