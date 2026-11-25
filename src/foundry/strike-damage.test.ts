import { describe, expect, it } from "vitest";
import type { StrikeDamage } from "../core/damage";
import { NO_STORED_NOTES } from "../core/notes";
import type { ActiveBuild, Target } from "./npc";
import { strikeDamageStat } from "./strike-damage";
import { planLevelChange } from "./updates";

// Strikes copied from the pf2e packs' Aasimar Redeemer (level 5) and Baccali Alpaca (level 0).
const damageRolls = (damage: string) => ({
    damageRolls: { bdv8: { damage, damageType: "piercing" } },
});
const ALPACA_SPIT = { damageRolls: { zqjm: { damage: "1d3+1", damageType: "bludgeoning" } } };

describe("pack strikes", () => {
    it.each([
        ["crossbow", "1d8+3", 4, "1d8+1"],
        ["crossbow", "1d8+3", 3, "1d8"],
        ["longsword", "1d8+7", 4, "1d8+5"],
    ])("round-trips the %s's %s through level %i as %s", (_strike, original, level, there) => {
        const away = changedDamage(buildWith(5, damageRolls(original)), level);
        expect(away).toBe(there);
        expect(changedDamage(buildWith(level, damageRolls(there)), 5)).toBe(original);
    });

    it("loses the one-die deficit when level 3's band leaves no fewer dice to roll", () => {
        expect(changedDamage(buildWith(5, damageRolls("1d8+7")), 3)).toBe("1d8+4");
        expect(changedDamage(buildWith(3, damageRolls("1d8+4")), 5)).toBe("2d8+2");
    });

    it("leaves a strike alone when its die is not a weapon die", () => {
        expect(strikeDamageStat("strikeDamage", "spit", ALPACA_SPIT, () => undefined)).toEqual([]);
    });
});

function buildWith(level: number, system: object): ActiveBuild {
    const target = (damage: StrikeDamage): Target => ({
        kind: "strikeDamage",
        itemId: "strike",
        damage,
    });
    return {
        state: "active",
        level,
        adjustment: undefined,
        stats: strikeDamageStat("strikeDamage", "strike", system, target),
        precisionAbilities: [],
        notes: NO_STORED_NOTES,
        descriptions: [],
    };
}

function changedDamage(build: ActiveBuild, newLevel: number): unknown {
    const [item] = planLevelChange(build, newLevel, new Set()).items;
    return item?.fields["system.damageRolls.bdv8.damage"];
}
