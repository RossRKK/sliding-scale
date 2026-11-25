import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { readNpc, type ActiveBuild, type NpcSource } from "./npc";
import { planTraitIwr } from "./trait-iwr";

/** The fixture NPC as a level 3 fire creature that is already weak to water. */
function fireCreature(): NpcSource {
    const source = npcSource();
    return {
        ...source,
        system: {
            ...source.system,
            traits: { value: ["elemental", "fire"] },
            attributes: {
                ...source.system.attributes,
                immunities: null,
                weaknesses: [{ type: "water", value: 5 }],
                resistances: null,
            },
        },
    } as NpcSource;
}

describe("planTraitIwr", () => {
    it("appends missing trait IWR after the NPC's own entries", () => {
        const changes = planTraitIwr(fireCreature(), activeNpc(fireCreature()));
        expect(changes?.actor).toEqual({
            "system.attributes.immunities": [
                { type: "bleed" },
                { type: "paralyzed" },
                { type: "poison" },
                { type: "sleep" },
                { type: "fire" },
            ],
            // Level 3 maximum is 6; water was already there at 5 and is left alone.
            "system.attributes.weaknesses": [
                { type: "water", value: 5 },
                { type: "cold", value: 6 },
            ],
            "system.attributes.resistances": [],
        });
    });

    it("notes the required additions and, separately, the optional ones", () => {
        const changes = planTraitIwr(fireCreature(), activeNpc(fireCreature()));
        expect(changes?.notes.events).toEqual([
            {
                kind: "iwrAdded",
                types: [
                    "bleed immunity",
                    "paralyzed immunity",
                    "poison immunity",
                    "sleep immunity",
                    "fire immunity",
                ],
            },
            { kind: "optionalIwrAdded", types: ["cold weakness 6"] },
        ]);
    });

    it("has nothing to do for an NPC without IWR traits", () => {
        expect(planTraitIwr(npcSource(), activeNpc(npcSource()))).toBeUndefined();
    });
});

function activeNpc(source: NpcSource): ActiveBuild {
    const build = readNpc(source);
    if (build.state === "disabled") throw new Error("fixture NPC is disabled");
    return build;
}
