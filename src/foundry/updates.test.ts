import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { readNpc } from "./npc";
import { planAdjectives, planLevelChange } from "./updates";

describe("readNpc", () => {
    it("reads one stat per scaled number, skipping skills the NPC lacks and unscaled items", () => {
        const ids = readNpc(npcSource()).stats.map((stat) => stat.id);
        expect(ids).toEqual([
            "attribute:str",
            "attribute:dex",
            "perception",
            "armorClass",
            "save:fortitude",
            "save:reflex",
            "save:will",
            "skill:athletics",
            "hitPoints",
            "strikeAttack:strike1",
            "spellDC:casting1",
            "spellAttack:casting1",
        ]);
    });
});

describe("planLevelChange", () => {
    it("rescales actor fields and embedded items from level 3 to 4", () => {
        expect(planLevelChange(readNpc(npcSource()), 4, new Set())).toEqual({
            actor: {
                "system.abilities.str.mod": 5,
                "system.perception.mod": 11,
                "system.attributes.ac.value": 22,
                "system.saves.fortitude.value": 14,
                "system.saves.reflex.value": 11,
                "system.saves.will.value": 8,
                "system.skills.athletics.base": 12,
                "system.attributes.hp.max": 60,
                "system.attributes.hp.value": 55,
            },
            items: [
                { itemId: "strike1", fields: { "system.bonus.value": 14 } },
                {
                    itemId: "casting1",
                    fields: { "system.spelldc.dc": 21, "system.spelldc.value": 13 },
                },
            ],
        });
    });

    it("leaves fields the user changed in the same update alone", () => {
        const plan = planLevelChange(
            readNpc(npcSource()),
            4,
            new Set(["system.attributes.ac.value"]),
        );
        expect(plan.actor).not.toHaveProperty(["system.attributes.ac.value"]);
        expect(plan.actor).toHaveProperty(["system.perception.mod"], 11);
    });

    it("does not let current HP go below zero", () => {
        const source = npcSource();
        const hp = { value: 2, max: 45 };
        const wounded = {
            ...source,
            system: { ...source.system, attributes: { ...source.system.attributes, hp } },
        };
        expect(planLevelChange(readNpc(wounded), 1, new Set()).actor).toMatchObject({
            "system.attributes.hp.max": 20,
            "system.attributes.hp.value": 0,
        });
    });
});

describe("planAdjectives", () => {
    it("writes the exact column value to wherever the stat lives", () => {
        const adjectives = new Map([
            ["armorClass", "extreme"],
            ["spellDC:casting1", "moderate"],
        ] as const);
        expect(planAdjectives(readNpc(npcSource()), adjectives)).toEqual({
            actor: { "system.attributes.ac.value": 22 },
            items: [{ itemId: "casting1", fields: { "system.spelldc.dc": 17 } }],
        });
    });
});
