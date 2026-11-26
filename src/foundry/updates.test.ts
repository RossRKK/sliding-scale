import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { MODULE_ID, readNpc, type ActiveBuild, type NpcSource } from "./npc";
import { planAdjectives, planLevelChange } from "./updates";

describe("readNpc", () => {
    it("reads one stat per scaled number, skipping skills the NPC lacks and unscaled items", () => {
        const ids = activeNpc(npcSource()).stats.map((stat) => stat.id);
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
            "strikeDamage:strike1",
            "strikeAttack:splash1",
            "spellDC:casting1",
            "spellAttack:casting1",
        ]);
    });
});

describe("planLevelChange", () => {
    it("rescales actor fields and embedded items from level 3 to 4", () => {
        expect(planLevelChange(activeNpc(npcSource()), 4, new Set())).toEqual({
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
                {
                    itemId: "strike1",
                    fields: {
                        "system.bonus.value": 14,
                        // 1d8+6 plus 1d6 fire averages 14, extreme −1 at level 3; level 4 extreme is 18.
                        "system.damageRolls.main.damage": "2d8+5",
                    },
                },
                { itemId: "splash1", fields: { "system.bonus.value": 14 } },
                {
                    itemId: "casting1",
                    fields: { "system.spelldc.dc": 21, "system.spelldc.value": 13 },
                },
            ],
            descriptions: [],
        });
    });

    it("leaves fields the user changed in the same update alone", () => {
        const plan = planLevelChange(
            activeNpc(npcSource()),
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
        expect(planLevelChange(activeNpc(wounded), 1, new Set()).actor).toMatchObject({
            "system.attributes.hp.max": 20,
            "system.attributes.hp.value": 0,
        });
    });

    it("keeps an elite NPC's damage taken as its elite HP bonus changes with level", () => {
        const source = npcSource();
        // Elite at level 3: +15 HP, so 60 is full health on a 45 max.
        const attributes = { ...source.system.attributes, adjustment: "elite" as const };
        const elite = {
            ...source,
            system: { ...source.system, attributes: { ...attributes, hp: { value: 60, max: 45 } } },
        };
        // Level 5: moderate HP 78–72 (75) plus the +20 elite bonus.
        expect(planLevelChange(activeNpc(elite), 5, new Set()).actor).toMatchObject({
            "system.attributes.hp.max": 75,
            "system.attributes.hp.value": 95,
        });
    });
});

describe("lore skills", () => {
    const withLore = (): NpcSource => ({
        ...npcSource(),
        items: [
            ...npcSource().items,
            { _id: "lore1", name: "Sailing Lore", type: "lore", system: { mod: { value: 9 } } },
        ],
    });

    it("rates a lore skill on the Skills table like any other skill", () => {
        const stat = activeNpc(withLore()).stats.find(({ id }) => id === "lore:lore1");
        expect(stat).toMatchObject({ kind: "skill", value: 9 });
    });

    it("rescales a lore skill's modifier on its item", () => {
        // Level 3 moderate skill is 9; level 4 moderate is 10.
        const items = planLevelChange(activeNpc(withLore()), 4, new Set()).items;
        expect(items.find(({ itemId }) => itemId === "lore1")?.fields).toEqual({
            "system.mod.value": 10,
        });
    });
});

describe("weaknesses and resistances", () => {
    // Level 3 Table 2–8: maximum 6, minimum 3; level 8: maximum 11, minimum 6.
    const withIwr = (): NpcSource => {
        const source = npcSource();
        const attributes = {
            ...source.system.attributes,
            weaknesses: [{ type: "cold", value: 6 }],
            resistances: [
                { type: "physical", value: 3, exceptions: ["silver"] },
                { type: "fire", value: 7 },
            ],
        };
        return { ...source, system: { ...source.system, attributes } };
    };

    it("rates each typed value on Table 2–8", () => {
        const ids = activeNpc(withIwr())
            .stats.filter(({ kind }) => kind === "weakness" || kind === "resistance")
            .map(({ id, value }) => [id, value]);
        expect(ids).toEqual([
            ["weakness:cold", 6],
            ["resistance:physical", 3],
            ["resistance:fire", 7],
        ]);
    });

    it("rewrites each list whole, keeping exceptions, with every value rescaled", () => {
        expect(planLevelChange(activeNpc(withIwr()), 8, new Set()).actor).toMatchObject({
            "system.attributes.weaknesses": [{ type: "cold", value: 11 }],
            "system.attributes.resistances": [
                { type: "physical", value: 6, exceptions: ["silver"] },
                { type: "fire", value: 12 },
            ],
        });
    });

    it("sets one value to a column, leaving the rest of its list alone", () => {
        const adjectives = new Map([["resistance:fire", "minimum"] as const]);
        expect(planAdjectives(activeNpc(withIwr()), adjectives).actor).toEqual({
            "system.attributes.resistances": [
                { type: "physical", value: 3, exceptions: ["silver"] },
                { type: "fire", value: 3 },
            ],
        });
    });
});

describe("ability descriptions", () => {
    const breath = {
        _id: "breath1",
        name: "Breath Weapon",
        type: "action",
        system: {
            description: {
                value: "<p>@Damage[4d6[fire]] (@Check[reflex|dc:20|basic]); see DC 20 and DC 20.</p>",
            },
        },
    };
    const withBreath = (): NpcSource => ({ ...npcSource(), items: [...npcSource().items, breath] });

    it("rescales an ability's fixed DC on a level change and notes its damage", () => {
        // At level 3 DC 20 is Spell DC high; level 8's high is 26.
        const plan = planLevelChange(activeNpc(withBreath()), 8, new Set());
        expect(plan.items.find(({ itemId }) => itemId === "breath1")?.fields).toEqual({
            "system.description.value":
                "<p>@Damage[4d6[fire]] (@Check[reflex|dc:26|basic]); see DC 20 and DC 20.</p>",
        });
        expect(plan.descriptions).toEqual([
            {
                item: "Breath Weapon",
                rescaled: ["DC 20 → 26"],
                unscaled: [
                    "4d6 fire left as is, damage other than a Strike rider isn't rescaled",
                    "DC 20 left as is, mentioned more than once",
                ],
            },
        ]);
    });

    it("writes a precision ability's description once, with both rewrites", () => {
        const source = npcSource();
        const items = source.items.map((item) =>
            item._id === "sneak1"
                ? {
                      ...item,
                      name: "Sneak Attack",
                      system: {
                          ...item.system,
                          description: {
                              value: "<p>Deals an extra 1d6 precision damage; @Check[will|dc:18].</p>",
                          },
                      },
                  }
                : item,
        );
        const plan = planLevelChange(activeNpc({ ...source, items }), 5, new Set());
        const writes = plan.items.filter(({ itemId }) => itemId === "sneak1");
        expect(writes).toHaveLength(1);
        expect(writes[0]?.fields["system.description.value"]).toBe(
            "<p>Deals an extra 2d6 precision damage; @Check[will|dc:20].</p>",
        );
    });
});

describe("planAdjectives", () => {
    it("writes the exact column value to wherever the stat lives", () => {
        const adjectives = new Map([
            ["armorClass", "extreme"],
            ["spellDC:casting1", "moderate"],
        ] as const);
        expect(planAdjectives(activeNpc(npcSource()), adjectives)).toEqual({
            actor: { "system.attributes.ac.value": 22 },
            items: [{ itemId: "casting1", fields: { "system.spelldc.dc": 17 } }],
        });
    });

    it("rebuilds only the main damage partial for a damage adjective at the same level", () => {
        // Level 3 moderate is 10: 1d8 (4.5) + 1d6 fire (3.5) + 2.
        const adjectives = new Map([["strikeDamage:strike1", "moderate"] as const]);
        expect(planAdjectives(activeNpc(npcSource()), adjectives).items).toEqual([
            { itemId: "strike1", fields: { "system.damageRolls.main.damage": "1d8+2" } },
        ]);
    });

    it("leaves a strike with no plain damage partial without a damage stat", () => {
        const ids = activeNpc(npcSource()).stats.map((stat) => stat.id);
        expect(ids).not.toContain("strikeDamage:splash1");
    });
});

describe("enabling", () => {
    it.each([
        ["no flags at all", {}],
        ["no enabled flag", { [MODULE_ID]: {} }],
        ["enabled set to false", { [MODULE_ID]: { enabled: false } }],
    ])("reads an NPC with %s as disabled, with no stats to scale", (_case, flags) => {
        expect(readNpc({ ...npcSource(), flags })).toEqual({ state: "disabled" });
    });

    it("changes no numbers: an enabled NPC is only read, and its current level plans no updates", () => {
        const build = activeNpc(npcSource());
        expect(build.stats.find(({ id }) => id === "armorClass")?.value).toBe(20);
        expect(planLevelChange(build, build.level, new Set())).toEqual({
            actor: {},
            items: [],
            descriptions: [],
        });
    });
});

function activeNpc(source: NpcSource): ActiveBuild {
    const build = readNpc(source);
    if (build.state === "disabled") throw new Error("fixture NPC is disabled");
    return build;
}
