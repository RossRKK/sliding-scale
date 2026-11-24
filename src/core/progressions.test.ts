import { describe, expect, it } from "vitest";
import { BOMB_TIER, progressionAt, scaleByProgression, SNEAK_ATTACK_DICE } from "./progressions";

describe.each([
    ["BOMB_TIER", BOMB_TIER],
    ["SNEAK_ATTACK_DICE", SNEAK_ATTACK_DICE],
])("%s", (_name, bands) => {
    it("starts at the lowest creature level", () => {
        expect(bands[0]?.fromLevel).toBe(-1);
    });

    it("steps up strictly in both level and value", () => {
        for (const [index, band] of bands.entries()) {
            const previous = bands[index - 1];
            if (previous === undefined) continue;
            expect(band.fromLevel).toBeGreaterThan(previous.fromLevel);
            expect(band.value).toBeGreaterThan(previous.value);
        }
    });
});

describe("progressionAt", () => {
    it.each([
        [BOMB_TIER, 2, 1],
        [BOMB_TIER, 3, 2],
        [BOMB_TIER, 10, 2],
        [BOMB_TIER, 11, 3],
        [BOMB_TIER, 16, 3],
        [BOMB_TIER, 17, 4],
        [BOMB_TIER, 25, 4],
        [SNEAK_ATTACK_DICE, 4, 1],
        [SNEAK_ATTACK_DICE, 5, 2],
        [SNEAK_ATTACK_DICE, 10, 2],
        [SNEAK_ATTACK_DICE, 11, 3],
        [SNEAK_ATTACK_DICE, 17, 4],
    ])("reads the band a level falls in", (bands, level, value) => {
        expect(progressionAt(bands, level)).toBe(value);
    });
});

describe("scaleByProgression", () => {
    it("follows Ji-yook's sneak attack: 2d6 at 9, 3d6 at 13, 4d6 at 18", () => {
        expect(scaleByProgression(SNEAK_ATTACK_DICE, 2, 9, 13)).toBe(3);
        expect(scaleByProgression(SNEAK_ATTACK_DICE, 3, 13, 18)).toBe(4);
    });

    it("follows Blue Viper's flat splash: 3 at 14, 4 at 20", () => {
        expect(scaleByProgression(BOMB_TIER, 3, 14, 20)).toBe(4);
    });

    it("rounds half up and never goes below one", () => {
        expect(scaleByProgression(SNEAK_ATTACK_DICE, 3, 11, 5)).toBe(2);
        expect(scaleByProgression(SNEAK_ATTACK_DICE, 1, 17, 1)).toBe(1);
    });
});
