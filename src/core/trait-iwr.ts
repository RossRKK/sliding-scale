import { columnValue } from "./scale";
import { RESISTANCES_AND_WEAKNESSES } from "./tables";

/**
 * Immunities, weaknesses and resistances a creature trait brings, from GM Core's Trait Abilities
 * (Pathfinder https://2e.aonprd.com/Rules.aspx?ID=2918, Starfinder
 * https://2e.aonsrd.com/rules/1033-trait-abilities) and Monster Core's trait descriptions.
 * Types are pf2e's IWR slugs. Ones the book qualifies ("typically", "sometimes", "often",
 * "usually") are optional. Where it offers a choice, the comment names the pick.
 */
export type TraitIwr =
    | {
          readonly kind: "immunity";
          readonly type: string;
          readonly optional?: true;
          /** Immunities that already give this one, so an NPC with either gets nothing more. */
          readonly coveredBy?: readonly string[];
      }
    | { readonly kind: "weakness"; readonly type: string; readonly optional?: true }
    | {
          readonly kind: "resistance";
          readonly type: string;
          readonly breadth: Breadth;
          readonly optional?: true;
          readonly exceptions?: readonly Exception[];
          readonly doubleVs?: readonly string[];
      };

/** A broad resistance covers several damage types, so the book sets it at the table's minimum. */
export type Breadth = "single" | "broad";

/** A resistance exception, some only for creatures with another trait. */
export interface Exception {
    readonly type: string;
    readonly ifTrait?: string;
}

const immunity = (type: string): TraitIwr => ({ kind: "immunity", type });
const weakness = (type: string): TraitIwr => ({ kind: "weakness", type });
const optional = (iwr: TraitIwr): TraitIwr => ({ ...iwr, optional: true });

// pf2e already derives construct immunities, mindless's mental and a swarm's grabbed, prone and
// restrained at prepare time (setImmunitiesFromTraits), so they are not repeated here.
export const TRAIT_IWR: Readonly<Record<string, readonly TraitIwr[]>> = {
    archon: [immunity("fear-effects")],
    azata: [weakness("cold-iron")],
    celestial: [weakness("unholy")],
    cold: [immunity("cold")], // "Immunities or Resistances cold" → immunity
    // Starfinder: "Immunities usually cold; Resistances cold or void" → void, as cold is immune
    cosmic: [optional(immunity("cold")), { kind: "resistance", type: "void", breadth: "single" }],
    daemon: [immunity("death-effects")],
    demon: [weakness("cold-iron")],
    devil: [
        immunity("fire"),
        weakness("holy"),
        {
            kind: "resistance",
            type: "physical",
            breadth: "broad",
            exceptions: [{ type: "silver" }],
        },
        { kind: "resistance", type: "poison", breadth: "single" },
    ],
    dragon: [immunity("paralyzed"), immunity("sleep")], // Monster Core dragon trait
    elemental: [immunity("bleed"), immunity("paralyzed"), immunity("poison"), immunity("sleep")],
    fey: [weakness("cold-iron")],
    fiend: [weakness("holy")],
    fire: [immunity("fire"), optional(weakness("cold")), optional(weakness("water"))],
    fungus: [optional(weakness("slashing"))], // "sometimes slashing or fire" → slashing
    incorporeal: [
        immunity("bleed"),
        immunity("disease"),
        immunity("paralyzed"),
        immunity("poison"),
        immunity("precision"),
        {
            kind: "resistance",
            type: "all-damage",
            breadth: "broad",
            exceptions: [
                { type: "force" },
                { type: "ghost-touch" },
                { type: "spirit" },
                { type: "vitality", ifTrait: "undead" },
            ],
            doubleVs: ["non-magical"],
        },
    ],
    ooze: [
        immunity("bleed"),
        immunity("critical-hits"),
        immunity("precision"),
        immunity("unconscious"),
        optional(immunity("acid")), // "often acid"
    ],
    plant: [optional(weakness("fire"))],
    protean: [{ kind: "resistance", type: "precision", breadth: "single" }],
    psychopomp: [
        immunity("death-effects"),
        immunity("disease"),
        { kind: "resistance", type: "poison", breadth: "single" },
        { kind: "resistance", type: "void", breadth: "single" },
    ],
    swarm: [
        immunity("precision"),
        immunity("swarm-mind"),
        weakness("area-damage"),
        weakness("splash-damage"),
        { kind: "resistance", type: "physical", breadth: "broad" },
    ],
    // "sleep (or unconscious if it never rests at all)" → unconscious, unless it has sleep
    undead: [
        immunity("death-effects"),
        immunity("disease"),
        immunity("paralyzed"),
        immunity("poison"),
        { kind: "immunity", type: "unconscious", coveredBy: ["sleep"] },
    ],
    wood: [weakness("fire"), weakness("axe-vulnerability")], // "fire and axes or slashing" → axes
};

/** What pf2e's setImmunitiesFromTraits adds itself, kept to check TRAIT_IWR never repeats it. */
export const PF2E_DERIVED_IMMUNITIES: Readonly<Record<string, readonly string[]>> = {
    construct: [
        "bleed",
        "death-effects",
        "disease",
        "doomed",
        "drained",
        "fatigued",
        "healing",
        "nonlethal-attacks",
        "paralyzed",
        "poison",
        "sickened",
        "spirit",
        "unconscious",
        "vitality",
        "void",
    ],
    mindless: ["mental"],
    swarm: ["grabbed", "prone", "restrained"],
};

/** The types an NPC already has, which are never changed or repeated. */
export interface ExistingIwr {
    readonly immunities: readonly string[];
    readonly weaknesses: readonly string[];
    readonly resistances: readonly string[];
}

export interface AddedIwr {
    readonly immunities: readonly { readonly type: string }[];
    readonly weaknesses: readonly { readonly type: string; readonly value: number }[];
    readonly resistances: readonly {
        readonly type: string;
        readonly value: number;
        readonly exceptions: readonly string[];
        readonly doubleVs: readonly string[];
    }[];
    /** Labels of what was added, split by whether the book qualifies it. */
    readonly required: readonly string[];
    readonly optional: readonly string[];
}

/** The trait IWR an NPC of these traits lacks, valued from Table 2–8 at its level. */
export function traitIwrToAdd(
    traits: readonly string[],
    level: number,
    existing: ExistingIwr,
): AddedIwr {
    const weaknessValue = columnValue(RESISTANCES_AND_WEAKNESSES, level, "maximum") ?? 0;
    const valueOf = (breadth: Breadth) =>
        columnValue(
            RESISTANCES_AND_WEAKNESSES,
            level,
            breadth === "single" ? "maximum" : "minimum",
        ) ?? 0;
    const seen = {
        immunity: new Set(existing.immunities),
        weakness: new Set(existing.weaknesses),
        resistance: new Set(existing.resistances),
    };
    const added: { iwr: TraitIwr; label: string }[] = [];
    for (const iwr of traits.flatMap((trait) => TRAIT_IWR[trait] ?? [])) {
        const covering = [iwr.type, ...(iwr.kind === "immunity" ? (iwr.coveredBy ?? []) : [])];
        if (covering.some((type) => seen[iwr.kind].has(type))) continue;
        seen[iwr.kind].add(iwr.type);
        added.push({
            iwr,
            label: labelOf(iwr, iwr.kind === "resistance" ? valueOf(iwr.breadth) : weaknessValue),
        });
    }
    const ofKind = <K extends TraitIwr["kind"]>(kind: K) =>
        added.flatMap(({ iwr }) =>
            iwr.kind === kind ? [iwr as Extract<TraitIwr, { kind: K }>] : [],
        );
    return {
        immunities: ofKind("immunity").map(({ type }) => ({ type })),
        weaknesses: ofKind("weakness").map(({ type }) => ({ type, value: weaknessValue })),
        resistances: ofKind("resistance").map((resistance) => ({
            type: resistance.type,
            value: valueOf(resistance.breadth),
            exceptions: (resistance.exceptions ?? [])
                .filter(({ ifTrait }) => ifTrait === undefined || traits.includes(ifTrait))
                .map(({ type }) => type),
            doubleVs: resistance.doubleVs ?? [],
        })),
        required: added.filter(({ iwr }) => !iwr.optional).map(({ label }) => label),
        optional: added.filter(({ iwr }) => iwr.optional).map(({ label }) => label),
    };
}

function labelOf(iwr: TraitIwr, value: number): string {
    return iwr.kind === "immunity" ? `${iwr.type} immunity` : `${iwr.type} ${iwr.kind} ${value}`;
}
