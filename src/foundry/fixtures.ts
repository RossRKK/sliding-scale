import { MODULE_ID, type NpcSource } from "./npc";
import type { NpcUpdate } from "./updates";

/** An enabled level 3 NPC with one stat in every scaled kind, numbers chosen so each sits on a known column. */
export function npcSource(): NpcSource {
    return {
        system: {
            details: { level: { value: 3 } },
            abilities: { str: { mod: 4 }, dex: { mod: 3 } },
            perception: { mod: 9 },
            attributes: { ac: { value: 20 }, hp: { value: 40, max: 45 }, adjustment: null },
            saves: { fortitude: { value: 12 }, reflex: { value: 9 }, will: { value: 6 } },
            skills: { athletics: { base: 10 }, stealth: { base: null } },
        },
        flags: { [MODULE_ID]: { enabled: true } },
        items: [
            {
                _id: "strike1",
                type: "melee",
                system: {
                    bonus: { value: 12 },
                    damageRolls: {
                        main: { damage: "1d8+6", damageType: "slashing", category: null },
                        fire: { damage: "1d6", damageType: "fire", category: null },
                        sneak: { damage: "1d6", damageType: "slashing", category: "precision" },
                        bleed: { damage: "1d4", damageType: "bleed", category: "persistent" },
                    },
                },
            },
            {
                _id: "splash1",
                type: "melee",
                system: {
                    bonus: { value: 12 },
                    damageRolls: {
                        acid: { damage: "1d6", damageType: "acid", category: "splash" },
                    },
                },
            },
            {
                _id: "casting1",
                type: "spellcastingEntry",
                system: { spelldc: { dc: 20, value: 12 } },
            },
            { _id: "feat1", type: "action", system: {} },
            {
                _id: "sneak1",
                type: "action",
                system: {
                    description: {
                        value: "<p>Deals an extra 1d6 precision damage to off-guard creatures.</p>",
                    },
                    rules: [
                        {
                            key: "DamageDice",
                            category: "precision",
                            diceNumber: 1,
                            dieSize: "d6",
                            selector: "strike-damage",
                        },
                        {
                            key: "FlatModifier",
                            damageCategory: "precision",
                            selector: "strike-damage",
                            value: 2,
                        },
                    ],
                },
            },
        ],
    };
}

/** Applies a planned update to an NPC's source, as Foundry would, at a level. */
export function withUpdate(source: NpcSource, update: NpcUpdate, level: number): NpcSource {
    const next = structuredClone(source) as Writable;
    next.system.details.level.value = level;
    for (const [path, value] of Object.entries(update.actor)) setPath(next, path, value);
    for (const { itemId, fields } of update.items) {
        const item = next.items.find(({ _id }) => _id === itemId);
        for (const [path, value] of Object.entries(fields)) if (item) setPath(item, path, value);
    }
    return next;
}

type Writable = NpcSource & {
    system: { details: { level: { value: number } } };
    items: { _id: string | null; system: object }[];
};

function setPath(root: object, path: string, value: unknown): void {
    const keys = path.split(".");
    const last = keys.pop()!;
    let node = root as Record<string, unknown>;
    for (const key of keys) node = (node[key] ??= {}) as Record<string, unknown>;
    node[last] = value;
}
