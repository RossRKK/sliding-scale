import type { Adjective } from "./adjective";
import { columnValue, rescale } from "./scale";
import * as tables from "./tables";
import type { ScaleTable } from "./tables";

export type StatKind = keyof typeof TABLE_OF;

/** One scaled number on a stat block; the target says where it lives, which only the adapter knows. */
export interface Stat<Target> {
    readonly id: string;
    readonly kind: StatKind;
    readonly value: number;
    readonly target: Target;
}

export interface StatChange<Target> {
    readonly target: Target;
    readonly from: number;
    readonly to: number;
}

export const TABLE_OF = {
    attribute: tables.ATTRIBUTE_MODIFIERS,
    perception: tables.PERCEPTION,
    armorClass: tables.ARMOR_CLASS,
    save: tables.SAVING_THROWS,
    skill: tables.SKILLS,
    hitPoints: tables.HIT_POINTS,
    strikeAttack: tables.STRIKE_ATTACK_BONUS,
    spellDC: tables.SPELL_DC,
    spellAttack: tables.SPELL_ATTACK,
    strikeDamage: tables.STRIKE_DAMAGE,
    // Starfinder GM Core p. 128 sets active ability DCs, which Area Fire is, on the Spell DC table.
    areaDC: tables.SPELL_DC,
    areaDamage: tables.AREA_DAMAGE,
    weakness: tables.RESISTANCES_AND_WEAKNESSES,
    resistance: tables.RESISTANCES_AND_WEAKNESSES,
} as const satisfies Record<string, ScaleTable>;

export function rescaleStats<Target>(
    stats: readonly Stat<Target>[],
    from: number,
    to: number,
): StatChange<Target>[] {
    return changesFrom(stats, (stat) => rescale(TABLE_OF[stat.kind], from, to, stat.value));
}

/** Sets each named stat to its adjective's exact column value; stats not named are left alone. */
export function applyAdjectives<Target>(
    stats: readonly Stat<Target>[],
    level: number,
    adjectives: ReadonlyMap<string, Adjective>,
): StatChange<Target>[] {
    return changesFrom(stats, (stat) => {
        const adjective = adjectives.get(stat.id);
        return adjective === undefined
            ? undefined
            : columnValue(TABLE_OF[stat.kind], level, adjective);
    });
}

function changesFrom<Target>(
    stats: readonly Stat<Target>[],
    newValue: (stat: Stat<Target>) => number | undefined,
): StatChange<Target>[] {
    return stats.flatMap((stat) => {
        const to = newValue(stat);
        return to === undefined || to === stat.value
            ? []
            : [{ target: stat.target, from: stat.value, to }];
    });
}
