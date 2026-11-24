import type { NpcSource } from "./npc";

/** A level 3 NPC with one stat in every scaled kind, numbers chosen so each sits on a known column. */
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
        flags: {},
        items: [
            { _id: "strike1", type: "melee", system: { bonus: { value: 12 } } },
            {
                _id: "casting1",
                type: "spellcastingEntry",
                system: { spelldc: { dc: 20, value: 12 } },
            },
            { _id: "feat1", type: "action", system: {} },
        ],
    };
}
