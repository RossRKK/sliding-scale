import type { Adjective } from "../core/adjective";
import { addEvent, type StoredNotes } from "../core/notes";
import type { Attribute, RoadMap, RoadMapEntry, StrikeKind } from "../core/road-maps";
import { columnValue } from "../core/scale";
import { SKILLS, STRIKE_ATTACK_BONUS, strikeDamageFormulas } from "../core/tables";
import type { ActiveBuild, NpcStat } from "./npc";
import { planAdjectives, type NpcUpdate } from "./updates";

/** What the road map needs to know about an NPC beyond its stats, read by the adapter. */
export interface RoadMapContext {
    readonly strikes: readonly StrikeShape[];
    /** The system's skills and the attribute each is keyed to. */
    readonly skillAttributes: Readonly<Record<string, Attribute>>;
    readonly spellcastingAttribute: Attribute | undefined;
    readonly addStrikes: ReadonlySet<StrikeKind>;
}

export interface StrikeShape {
    readonly itemId: string;
    readonly kind: StrikeKind;
    readonly agile: boolean;
}

/** Everything applying a road map writes; the adapter only sends it to Foundry. */
export interface RoadMapChanges {
    readonly update: NpcUpdate;
    /** Skills the road map names that the NPC lacks, as system.skills base values. */
    readonly newSkills: Readonly<Record<string, number>>;
    readonly unassignedSkills: readonly number[];
    readonly newStrikes: readonly NewStrike[];
    readonly notes: StoredNotes;
}

export interface NewStrike {
    readonly kind: StrikeKind;
    readonly bonus: number;
    readonly damage: string;
}

/** Core statistics a road map does not list "should typically use moderate numbers". */
const CORE_KINDS = [
    "perception",
    "armorClass",
    "save",
    "hitPoints",
    "strikeAttack",
    "strikeDamage",
    "spellDC",
    "spellAttack",
    "areaDC",
] as const satisfies readonly NpcStat["kind"][];

/** Overwrites the NPC with the road map's adjectives; unlisted core stats become moderate. */
export function applyRoadMap(
    build: ActiveBuild,
    roadMap: RoadMap,
    context: RoadMapContext,
): RoadMapChanges {
    const plan = planRoadMap(build, roadMap, context);
    const at = (table: typeof SKILLS, adjective: Adjective) =>
        columnValue(table, build.level, adjective) ?? 0;
    const newSkills = Object.fromEntries(
        [...plan.newSkills].map(([slug, adjective]) => [slug, at(SKILLS, adjective)]),
    );
    const newStrikes = plan.newStrikes.map(({ kind, attack, damage }) => ({
        kind,
        bonus: at(STRIKE_ATTACK_BONUS, attack),
        damage: strikeDamageFormulas(build.level)?.[damage] ?? "1d4",
    }));
    const unassignedSkills = plan.unassignedSkills.map((adjective) => at(SKILLS, adjective));
    return {
        update: planAdjectives(build, plan.adjectives),
        newSkills,
        unassignedSkills,
        newStrikes,
        notes: notesAfter(build.notes, roadMap, plan),
    };
}

interface RoadMapPlan {
    readonly adjectives: ReadonlyMap<string, Adjective>;
    readonly newSkills: ReadonlyMap<string, Adjective>;
    readonly unassignedSkills: readonly Adjective[];
    readonly newStrikes: readonly { kind: StrikeKind; attack: Adjective; damage: Adjective }[];
    readonly byHand: readonly string[];
}

function planRoadMap(build: ActiveBuild, roadMap: RoadMap, context: RoadMapContext): RoadMapPlan {
    const adjectives = new Map<string, Adjective>();
    const newSkills = new Map<string, Adjective>();
    const unassignedSkills: Adjective[] = [];
    const byHand: string[] = [];
    const has = (id: string) => build.stats.some((stat) => stat.id === id);
    const setSkill = (slug: string, adjective: Adjective) => {
        if (has(`skill:${slug}`)) adjectives.set(`skill:${slug}`, adjective);
        else if (slug in context.skillAttributes) newSkills.set(slug, adjective);
        else byHand.push(`${adjective} ${slug}`);
    };
    for (const stat of build.stats) {
        if (isCoreKind(stat.kind)) adjectives.set(stat.id, "moderate");
    }
    const strikeDamage = entryAdjective(roadMap, "strikeDamage") ?? "moderate";
    const strikeAttack = entryAdjective(roadMap, "strikeAttack") ?? "moderate";
    for (const strike of context.strikes) {
        const damage = strikeDamageFor(roadMap, strike.kind, strike.agile, strikeDamage);
        adjectives.set(`strikeDamage:${strike.itemId}`, damage);
        adjectives.set(`strikeAttack:${strike.itemId}`, strikeAttack);
    }
    for (const entry of roadMap.entries) {
        applyEntry(entry, { build, context, adjectives, setSkill, unassignedSkills, byHand });
    }
    const newStrikes = [...context.addStrikes].map((kind) => ({
        kind,
        attack: strikeAttack,
        damage: strikeDamageFor(roadMap, kind, false, strikeDamage),
    }));
    return { adjectives, newSkills, unassignedSkills, newStrikes, byHand };
}

interface Plan {
    readonly build: ActiveBuild;
    readonly context: RoadMapContext;
    readonly adjectives: Map<string, Adjective>;
    readonly setSkill: (slug: string, adjective: Adjective) => void;
    readonly unassignedSkills: Adjective[];
    readonly byHand: string[];
}

function applyEntry(entry: RoadMapEntry, plan: Plan): void {
    const { build, context, adjectives } = plan;
    const statsOf = (kinds: readonly NpcStat["kind"][]) =>
        build.stats.filter(({ kind }) => kinds.includes(kind));
    switch (entry.stat) {
        case "perception":
        case "armorClass":
        case "hitPoints":
            adjectives.set(entry.stat, entry.adjective);
            return;
        case "attribute":
            adjectives.set(`attribute:${entry.attribute}`, entry.adjective);
            return;
        case "spellcastingAttribute":
            if (context.spellcastingAttribute === undefined) {
                plan.byHand.push(`${entry.adjective} spellcasting attribute`);
            } else adjectives.set(`attribute:${context.spellcastingAttribute}`, entry.adjective);
            return;
        case "save":
            adjectives.set(`save:${entry.save}`, entry.adjective);
            return;
        case "skill":
            plan.setSkill(entry.skill, entry.adjective);
            return;
        case "skillsOf":
            for (const [slug, attribute] of Object.entries(context.skillAttributes)) {
                if (attribute === entry.attribute) plan.setSkill(slug, entry.adjective);
            }
            return;
        case "everySkill":
            for (const { id } of statsOf(["skill"])) adjectives.set(id, entry.adjective);
            return;
        case "unassignedSkill":
            plan.unassignedSkills.push(entry.adjective);
            return;
        case "spell":
            for (const { id } of statsOf(["spellDC", "spellAttack"])) {
                adjectives.set(id, entry.adjective);
            }
            return;
        case "areaDC":
            for (const { id } of statsOf(["areaDC"])) adjectives.set(id, entry.adjective);
            return;
        case "strikeAttack":
        case "strikeDamage":
            // Set per Strike above, since damage depends on the Strike's kind.
            return;
        case "byHand":
            plan.byHand.push(entry.text);
            return;
    }
}

/**
 * GM Core: primary melee Strikes use the damage column, agile ones and the creature's other kind
 * of Strike one column lower.
 */
function strikeDamageFor(
    roadMap: RoadMap,
    kind: StrikeKind,
    agile: boolean,
    damage: Adjective,
): Adjective {
    return kind === roadMap.primaryStrike && !agile ? damage : oneColumnLower(damage);
}

const LOWER: Partial<Record<Adjective, Adjective>> = {
    extreme: "high",
    high: "moderate",
    moderate: "low",
};

/** Strike Damage has no column below low, so low stays low. */
function oneColumnLower(adjective: Adjective): Adjective {
    return LOWER[adjective] ?? adjective;
}

function entryAdjective(
    roadMap: RoadMap,
    stat: "strikeAttack" | "strikeDamage",
): Adjective | undefined {
    for (const entry of roadMap.entries) {
        if (entry.stat === stat) return entry.adjective;
    }
    return undefined;
}

function isCoreKind(kind: NpcStat["kind"]): boolean {
    return (CORE_KINDS as readonly string[]).includes(kind);
}

function notesAfter(notes: StoredNotes, roadMap: RoadMap, plan: RoadMapPlan): StoredNotes {
    const skipped =
        plan.byHand.length === 0
            ? notes
            : addEvent(notes, {
                  kind: "roadMapSkipped",
                  roadMap: roadMap.name,
                  entries: plan.byHand,
              });
    const count = plan.unassignedSkills.length;
    return count === 0 ? skipped : addEvent(skipped, { kind: "unassignedSkills", count });
}
