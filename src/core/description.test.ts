import { describe, expect, it } from "vitest";
import { mentionsFormula, rewriteFormulas } from "./description";

describe("rewriteFormulas", () => {
    it("rewrites a formula mentioned exactly once", () => {
        const text = "<p>Deals an extra 1d6 precision damage to off-guard creatures.</p>";
        expect(rewriteFormulas(text, [{ from: "1d6", to: "2d6" }])).toBe(
            "<p>Deals an extra 2d6 precision damage to off-guard creatures.</p>",
        );
    });

    it("leaves a formula mentioned twice alone", () => {
        const text = "Deals 1d6 precision damage, or 1d6 more if flanking.";
        expect(rewriteFormulas(text, [{ from: "1d6", to: "2d6" }])).toBe(text);
    });

    it("does not match inside a longer number", () => {
        expect(rewriteFormulas("11d6 and 1d60", [{ from: "1d6", to: "2d6" }])).toBe(
            "11d6 and 1d60",
        );
    });

    it("applies several rewrites against the original text, so they cannot chain", () => {
        const text = "1d6 to off-guard, 2d6 to frightened";
        const rewrites = [
            { from: "1d6", to: "2d6" },
            { from: "2d6", to: "3d6" },
        ];
        expect(rewriteFormulas(text, rewrites)).toBe("2d6 to off-guard, 3d6 to frightened");
    });
});

describe("mentionsFormula", () => {
    it("finds a formula on digit boundaries only", () => {
        expect(mentionsFormula("an extra 2d6 precision", "2d6")).toBe(true);
        expect(mentionsFormula("an extra 12d6 precision", "2d6")).toBe(false);
    });
});
