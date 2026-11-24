import { describe, expect, it } from "vitest";
import { hitPointAdjustment } from "./elite-weak";

describe("hitPointAdjustment", () => {
    it.each([
        [undefined, 10, 0],
        ["elite", -1, 10],
        ["elite", 1, 10],
        ["elite", 2, 15],
        ["elite", 4, 15],
        ["elite", 5, 20],
        ["elite", 19, 20],
        ["elite", 20, 30],
        ["weak", 1, -10],
        ["weak", 2, -10],
        ["weak", 3, -15],
        ["weak", 5, -15],
        ["weak", 6, -20],
        ["weak", 20, -20],
        ["weak", 21, -30],
    ] as const)("%s at level %i is %i HP", (adjustment, level, hitPoints) => {
        expect(hitPointAdjustment(adjustment, level)).toBe(hitPoints);
    });
});
