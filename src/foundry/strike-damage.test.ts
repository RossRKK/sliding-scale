import { describe, expect, it } from "vitest";
import { strikeDamageStat } from "./strike-damage";

// Copied from the pf2e packs' Baccali Alpaca (level 0).
const ALPACA_SPIT = { damageRolls: { zqjm: { damage: "1d3+1", damageType: "bludgeoning" } } };

describe("strikeDamageStat on pack strikes", () => {
    it("leaves a strike alone when its die is not a weapon die", () => {
        expect(strikeDamageStat("spit", ALPACA_SPIT, () => undefined)).toEqual([]);
    });
});
