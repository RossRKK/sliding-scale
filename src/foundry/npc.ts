import manifest from "../../public/module.json";
import type { Adjustment } from "../core/elite-weak";
import type { StrikeDamage } from "../core/damage";
import type { Stat } from "../core/stats";
import { readPrecisionAbilities, type PrecisionAbility } from "./precision-abilities";
import { strikeDamageStat } from "./strike-damage";

export const MODULE_ID = manifest.id;
export const PAUSE_FLAG = "paused";

/** Where a scaled number is stored on a pf2e NPC. */
export type Target =
    | { readonly kind: "actorField"; readonly path: string }
    | { readonly kind: "skill"; readonly slug: string }
    | { readonly kind: "hitPoints"; readonly current: number }
    | { readonly kind: "itemField"; readonly itemId: string; readonly path: string }
    | { readonly kind: "strikeDamage"; readonly itemId: string; readonly damage: StrikeDamage };

export type NpcStat = Stat<Target>;

/** Sliding Scale's view of an NPC; a paused NPC is never scaled, so nothing else is read. */
export type NpcBuild = { readonly state: "paused" } | ActiveBuild;

export interface ActiveBuild {
    readonly state: "active";
    readonly level: number;
    readonly adjustment: Adjustment | undefined;
    readonly stats: readonly NpcStat[];
    /** Not table-rated, so not stats: they only follow level changes. */
    readonly precisionAbilities: readonly PrecisionAbility[];
}

/** The parts of pf2e's NPC source the helper reads; pf2e's NPCSource satisfies it. */
export interface NpcSource {
    readonly system: {
        readonly details: { readonly level: { readonly value: number } };
        readonly abilities: Readonly<Record<string, { readonly mod: number }>>;
        readonly perception: { readonly mod: number };
        readonly attributes: {
            readonly ac: { readonly value: number };
            readonly hp: { readonly value: number; readonly max: number };
            readonly adjustment: Adjustment | null;
        };
        readonly saves: Readonly<Record<string, { readonly value: number }>>;
        readonly skills: Readonly<Partial<Record<string, { readonly base: number | null }>>>;
    };
    readonly flags: Readonly<Partial<Record<string, unknown>>>;
    readonly items: readonly ItemSource[];
}

interface ItemSource {
    readonly _id: string | null;
    readonly type?: string | undefined;
    readonly system: object;
}

export function readNpc(source: NpcSource): NpcBuild {
    if (isPaused(source)) return { state: "paused" };
    return {
        state: "active",
        level: source.system.details.level.value,
        adjustment: source.system.attributes.adjustment ?? undefined,
        stats: [...actorStats(source.system), ...source.items.flatMap(itemStats)],
        precisionAbilities: readPrecisionAbilities(source.items),
    };
}

/** The user's escape hatch for hand-tuning numbers: genuine state, so it is the one stored flag. */
function isPaused(source: NpcSource): boolean {
    const flags = source.flags[MODULE_ID];
    return (
        typeof flags === "object" &&
        flags !== null &&
        PAUSE_FLAG in flags &&
        flags[PAUSE_FLAG] === true
    );
}

function actorStats(system: NpcSource["system"]): NpcStat[] {
    const field = (id: string, kind: NpcStat["kind"], path: string, value: number): NpcStat => ({
        id,
        kind,
        value,
        target: { kind: "actorField", path },
    });
    const { attributes } = system;
    return [
        ...Object.entries(system.abilities).map(([key, { mod }]) =>
            field(`attribute:${key}`, "attribute", `system.abilities.${key}.mod`, mod),
        ),
        field("perception", "perception", "system.perception.mod", system.perception.mod),
        field("armorClass", "armorClass", "system.attributes.ac.value", attributes.ac.value),
        ...Object.entries(system.saves).map(([key, { value }]) =>
            field(`save:${key}`, "save", `system.saves.${key}.value`, value),
        ),
        ...skillStats(system.skills),
        {
            id: "hitPoints",
            kind: "hitPoints",
            value: attributes.hp.max,
            target: { kind: "hitPoints", current: attributes.hp.value },
        },
    ];
}

/** A null base defers to the attribute modifier, i.e. the NPC lacks the skill, so it is not scaled. */
function skillStats(skills: NpcSource["system"]["skills"]): NpcStat[] {
    return Object.entries(skills).flatMap(([slug, skill]) =>
        typeof skill?.base === "number"
            ? [
                  {
                      id: `skill:${slug}`,
                      kind: "skill",
                      value: skill.base,
                      target: { kind: "skill", slug },
                  },
              ]
            : [],
    );
}

const ITEM_FIELDS = {
    melee: [{ kind: "strikeAttack", path: "system.bonus.value" }],
    spellcastingEntry: [
        { kind: "spellDC", path: "system.spelldc.dc" },
        { kind: "spellAttack", path: "system.spelldc.value" },
    ],
} as const satisfies Record<string, readonly { kind: NpcStat["kind"]; path: string }[]>;

function itemStats(item: ItemSource): NpcStat[] {
    const { _id: itemId, type } = item;
    if (itemId === null || !isScaledItemType(type)) return [];
    const fields = ITEM_FIELDS[type].flatMap(({ kind, path }): NpcStat[] => {
        const value = numberAt(item, path);
        if (value === undefined) return [];
        return [
            { id: `${kind}:${itemId}`, kind, value, target: { kind: "itemField", itemId, path } },
        ];
    });
    if (type !== "melee") return fields;
    const damageTarget = (damage: StrikeDamage): Target => ({
        kind: "strikeDamage",
        itemId,
        damage,
    });
    return [...fields, ...strikeDamageStat(itemId, item.system, damageTarget)];
}

function isScaledItemType(type: string | undefined): type is keyof typeof ITEM_FIELDS {
    return type !== undefined && Object.hasOwn(ITEM_FIELDS, type);
}

function numberAt(root: object, path: string): number | undefined {
    let node: unknown = root;
    for (const key of path.split(".")) {
        if (typeof node !== "object" || node === null) return undefined;
        node = (node as Record<string, unknown>)[key];
    }
    return typeof node === "number" ? node : undefined;
}
