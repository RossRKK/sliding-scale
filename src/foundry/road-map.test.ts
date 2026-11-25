import { describe, expect, it } from "vitest";
import { ROAD_MAPS, type Attribute, type RoadMap, type StrikeKind } from "../core/road-maps";
import { derive } from "../core/scale";
import { TABLE_OF } from "../core/stats";
import { npcSource, withUpdate } from "./fixtures";
import { readNpc, type ActiveBuild, type NpcSource } from "./npc";
import { applyRoadMap, type RoadMapContext, type RoadMapChanges } from "./road-map";

// pf2e's CONFIG.PF2E.skills attributes, plus Starfinder's computers and piloting.
const SKILL_ATTRIBUTES: Record<string, Attribute> = {
    acrobatics: "dex",
    arcana: "int",
    athletics: "str",
    computers: "int",
    crafting: "int",
    deception: "cha",
    diplomacy: "cha",
    intimidation: "cha",
    medicine: "wis",
    nature: "wis",
    occultism: "int",
    performance: "cha",
    piloting: "dex",
    religion: "wis",
    society: "int",
    stealth: "dex",
    survival: "wis",
    thievery: "dex",
};

const CONTEXT: RoadMapContext = {
    strikes: [{ itemId: "strike1", kind: "melee", agile: false }],
    skillAttributes: SKILL_ATTRIBUTES,
    spellcastingAttribute: "int",
    addStrikes: new Set(),
};

describe.each(ROAD_MAPS.map((roadMap) => [`${roadMap.book} ${roadMap.name}`, roadMap] as const))(
    "%s road map",
    (_name, roadMap) => {
        const changes = applyRoadMap(activeNpc(npcSource()), roadMap, CONTEXT);
        const after = applied(changes);

        it("sets every entry it can map to that adjective, exactly", () => {
            for (const entry of roadMap.entries) {
                const id = statIdOf(entry, roadMap.primaryStrike);
                if (id === undefined || "adjective" in entry === false) continue;
                const stat = after.stats.find((candidate) => candidate.id === id);
                if (stat === undefined) continue;
                expect([id, rating(after, id)]).toEqual([id, `${entry.adjective} +0`]);
            }
        });

        it("sets core statistics it does not list to moderate", () => {
            const listed = new Set(roadMap.entries.map(({ stat }) => stat));
            const unlisted = [
                ["perception", "perception"],
                ["armorClass", "armorClass"],
                ["hitPoints", "hitPoints"],
            ].filter(([stat]) => !listed.has(stat as never));
            for (const [, id] of unlisted) expect(rating(after, id!)).toBe("moderate +0");
        });

        it("adds the skills it names that the NPC lacks", () => {
            const named = roadMap.entries.flatMap((entry) =>
                entry.stat === "skill"
                    ? [entry.skill]
                    : entry.stat === "skillsOf"
                      ? Object.keys(SKILL_ATTRIBUTES).filter(
                            (slug) => SKILL_ATTRIBUTES[slug] === entry.attribute,
                        )
                      : [],
            );
            const lacking = named.filter((slug) => slug !== "athletics");
            expect(Object.keys(changes.newSkills).toSorted()).toEqual(
                [...new Set(lacking)].toSorted(),
            );
        });

        it("notes what it left to do by hand and the unassigned skills it added", () => {
            const byHand = roadMap.entries.flatMap((entry) =>
                entry.stat === "byHand" ? [entry.text] : [],
            );
            const unassigned = roadMap.entries.filter(({ stat }) => stat === "unassignedSkill");
            expect(changes.unassignedSkills).toHaveLength(unassigned.length);
            const kinds = changes.notes.events.map(({ kind }) => kind);
            expect(kinds.includes("roadMapSkipped")).toBe(byHand.length > 0);
            expect(kinds.includes("unassignedSkills")).toBe(unassigned.length > 0);
        });
    },
);

describe("applyRoadMap", () => {
    const brute = roadMap("pathfinder", "brute");
    const sniper = roadMap("pathfinder", "sniper");

    it("sets the Brute's numbers at level 3", () => {
        const { update } = applyRoadMap(activeNpc(npcSource()), brute, CONTEXT);
        // Level 3: low Dex 1 and Perception 6, moderate AC 18 and Will 9, low Reflex 6, high HP
        // 56; Str (high 4) and Fortitude (high 12) are already there.
        expect(update.actor).toEqual({
            "system.abilities.dex.mod": 1,
            "system.perception.mod": 6,
            "system.attributes.ac.value": 18,
            "system.saves.reflex.value": 6,
            "system.saves.will.value": 9,
            "system.attributes.hp.max": 56,
            "system.attributes.hp.value": 51,
        });
    });

    it("gives the kind of Strike the road map is not about one column less damage", () => {
        const both: RoadMapContext = {
            ...CONTEXT,
            strikes: [
                { itemId: "strike1", kind: "melee", agile: false },
                { itemId: "splash1", kind: "ranged", agile: false },
            ],
        };
        expect(damageRating(applied(applyRoadMap(activeNpc(npcSource()), sniper, both)))).toBe(
            "moderate +0",
        );
        expect(damageRating(applied(applyRoadMap(activeNpc(npcSource()), brute, both)))).toBe(
            "high +0",
        );
    });

    it("gives agile Strikes one column less damage", () => {
        const agile = { ...CONTEXT, strikes: [{ itemId: "strike1", kind: "melee", agile: true }] };
        const after = applied(applyRoadMap(activeNpc(npcSource()), brute, agile as RoadMapContext));
        expect(damageRating(after)).toBe("moderate +0");
    });

    it.each([
        ["melee", "high", "1d10+6"],
        ["ranged", "moderate", "1d8+6"],
    ] as const)("creates a %s Strike at the table's %s damage", (kind, _column, damage) => {
        const adding = { ...CONTEXT, addStrikes: new Set<StrikeKind>([kind]) };
        // Level 3 high attack bonus is 12.
        expect(applyRoadMap(activeNpc(npcSource()), brute, adding).newStrikes).toEqual([
            { kind, bonus: 12, damage },
        ]);
    });

    it("leaves the spellcasting attribute to a human when the NPC has no spellcasting", () => {
        const spellcaster = roadMap("pathfinder", "spellcaster");
        const none = { ...CONTEXT, spellcastingAttribute: undefined };
        const { notes } = applyRoadMap(activeNpc(npcSource()), spellcaster, none);
        expect(notes.events[0]).toMatchObject({
            kind: "roadMapSkipped",
            entries: ["high spellcasting attribute", expect.any(String)],
        });
    });
});

/** Applies the changes, with new skills added, and reads the NPC back. */
function applied(changes: RoadMapChanges): ActiveBuild {
    const source = withUpdate(npcSource(), changes.update, 3);
    const skills = {
        ...source.system.skills,
        ...Object.fromEntries(
            Object.entries(changes.newSkills).map(([slug, base]) => [slug, { base }]),
        ),
    };
    return activeNpc({ ...source, system: { ...source.system, skills } });
}

function statIdOf(
    entry: RoadMap["entries"][number],
    primaryStrike: StrikeKind,
): string | undefined {
    switch (entry.stat) {
        case "perception":
        case "armorClass":
        case "hitPoints":
            return entry.stat;
        case "attribute":
            return `attribute:${entry.attribute}`;
        case "spellcastingAttribute":
            return "attribute:int";
        case "save":
            return `save:${entry.save}`;
        case "skill":
            return `skill:${entry.skill}`;
        case "strikeAttack":
            return "strikeAttack:strike1";
        case "strikeDamage":
            // The fixture's Strike is melee, so a ranged road map's damage is for other Strikes.
            return primaryStrike === "melee" ? "strikeDamage:strike1" : undefined;
        case "spell":
            return "spellDC:casting1";
        default:
            return undefined;
    }
}

function rating(build: ActiveBuild, id: string): string {
    const stat = build.stats.find((candidate) => candidate.id === id)!;
    const derived = derive(TABLE_OF[stat.kind], build.level, stat.value)!;
    return `${derived.adjective} ${derived.offset >= 0 ? "+" : ""}${derived.offset}`;
}

function damageRating(build: ActiveBuild): string {
    return rating(build, "strikeDamage:strike1");
}

function roadMap(book: RoadMap["book"], id: string): RoadMap {
    return ROAD_MAPS.find((candidate) => candidate.book === book && candidate.id === id)!;
}

function activeNpc(source: NpcSource): ActiveBuild {
    const build = readNpc(source);
    if (build.state === "disabled") throw new Error("fixture NPC is disabled");
    return build;
}
