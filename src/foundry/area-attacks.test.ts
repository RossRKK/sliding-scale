import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { readNpc, type ActiveBuild, type NpcSource } from "./npc";
import { planAdjectives, planLevelChange } from "./updates";

// The sf2e packs' Free Captain (level 6): Area Fire has bonus 12, so a DC 22 save, and deals 2d6.
function freeCaptain(action: unknown = "area-fire"): NpcSource {
    const source = npcSource();
    const areaFire = {
        _id: "area1",
        type: "melee",
        system: {
            action,
            bonus: { value: 12 },
            damageRolls: { fire: { damage: "2d6", damageType: "fire", category: null } },
        },
    };
    return {
        ...source,
        system: { ...source.system, details: { level: { value: 6 } } },
        items: [areaFire],
    };
}

describe("area attacks", () => {
    it.each(["area-fire", "auto-fire"])("rates a %s on the DC and Area Damage tables", (action) => {
        expect(attackStats(freeCaptain(action))).toEqual([
            ["areaDC:area1", 22],
            ["areaDamage:area1", 7],
        ]);
    });

    it("reads an attack with no action as a Strike, as pf2e defaults it", () => {
        const { action: _, ...system } = freeCaptain().items[0]!.system as Record<string, unknown>;
        const strike = { ...freeCaptain(), items: [{ ...freeCaptain().items[0]!, system }] };
        expect(attackStats(strike)).toEqual([
            ["strikeAttack:area1", 12],
            ["strikeDamage:area1", 7],
        ]);
    });

    it("leaves an attack with an action it does not know alone", () => {
        expect(attackStats(freeCaptain("barrage"))).toEqual([]);
    });

    it("writes a rescaled DC back as the bonus it is 10 above", () => {
        // Level 6 moderate Spell DC 21, so +1; level 3 moderate is 17.
        expect(fieldsAfterLevel(freeCaptain(), 3)).toMatchObject({ "system.bonus.value": 8 });
    });

    it("rolls as many of its own dice as fit an adjective's area damage", () => {
        // Level 6 unlimited is 4d6 (14) and limited 7d6 (25), one more than seven d6 roll.
        expect(fieldsAfterAdjective(freeCaptain(), "unlimited")).toEqual({
            "system.damageRolls.fire.damage": "4d6",
        });
        expect(fieldsAfterAdjective(freeCaptain(), "limited")).toEqual({
            "system.damageRolls.fire.damage": "7d6+1",
        });
    });

    it("reaches level 3's unlimited 2d8 (9) average with its own d6s", () => {
        const atLevel3 = {
            ...freeCaptain(),
            system: { ...freeCaptain().system, details: { level: { value: 3 } } },
        };
        expect(fieldsAfterAdjective(atLevel3, "unlimited")).toEqual({
            "system.damageRolls.fire.damage": "2d6+2",
        });
    });

    it("keeps one die with no flat when the carried rating is below one die", () => {
        // Unlimited −7 at level 6 is 2 at level 3; one d6 already averages 3.
        expect(fieldsAfterLevel(freeCaptain(), 3)).toMatchObject({
            "system.damageRolls.fire.damage": "1d6",
        });
    });
});

function attackStats(source: NpcSource): [string, number][] {
    return activeNpc(source)
        .stats.filter((stat) => stat.id.endsWith(":area1"))
        .map((stat) => [stat.id, stat.value]);
}

function fieldsAfterLevel(source: NpcSource, level: number): object | undefined {
    return planLevelChange(activeNpc(source), level, new Set()).items[0]?.fields;
}

function fieldsAfterAdjective(
    source: NpcSource,
    adjective: "limited" | "unlimited",
): object | undefined {
    const adjectives = new Map([["areaDamage:area1", adjective] as const]);
    return planAdjectives(activeNpc(source), adjectives).items[0]?.fields;
}

function activeNpc(source: NpcSource): ActiveBuild {
    const build = readNpc(source);
    if (build.state === "disabled") throw new Error("fixture NPC is disabled");
    return build;
}
