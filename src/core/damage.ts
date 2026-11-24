import { ADJECTIVES } from "./adjective";
import { strikeDamageFormulas } from "./tables";

export interface Dice {
    readonly count: number;
    readonly size: number;
}

/** A damage formula of the shape NPC strikes use: optional dice plus a flat modifier. */
export interface Formula {
    readonly dice: Dice | undefined;
    readonly flat: number;
}

/** A strike's damage as the build helper sees it; persistent and splash partials are not part of it. */
export interface StrikeDamage {
    readonly main: { readonly key: string; readonly dice: Dice; readonly flat: number };
    /** Other plain partials (like 1d6 fire): counted in the average, never rewritten. */
    readonly extras: readonly Formula[];
    /** Not counted in the average, but their dice grow with the main partial's. */
    readonly precision: readonly { readonly key: string; readonly formula: Formula }[];
}

export interface PartialChange {
    readonly key: string;
    readonly formula: string;
}

/** Floored, like most of the book's listed averages, so stats and offsets stay whole numbers. */
export function damageAverage(damage: StrikeDamage): number {
    return Math.floor(
        exactAverage({ dice: damage.main.dice, flat: damage.main.flat }) + extrasAverage(damage),
    );
}

/**
 * Rewrites the main partial to the level's dice count with the creature's own die size, choosing
 * the flat modifier so the new floored average is exactly the target.
 */
export function rebuildDamage(
    damage: StrikeDamage,
    target: number,
    fromLevel: number,
    toLevel: number,
): PartialChange[] | undefined {
    const fromCount = damageDiceAt(fromLevel);
    const toCount = damageDiceAt(toLevel);
    if (fromCount === undefined || toCount === undefined) return undefined;
    const dice = { count: toCount, size: damage.main.dice.size };
    const flat = target - Math.floor(exactAverage({ dice, flat: 0 }) + extrasAverage(damage));
    const main = { key: damage.main.key, formula: formatFormula({ dice, flat }) };
    const precision = damage.precision.flatMap(({ key, formula }) => {
        const scaled = scalePrecision(formula, toCount / fromCount);
        return scaled.dice?.count === formula.dice?.count
            ? []
            : [{ key, formula: formatFormula(scaled) }];
    });
    return [main, ...precision];
}

/** How much of the main partial's average comes from its dice, to flag d4-at-level-20 strikes. */
export function diceShare(main: StrikeDamage["main"]): number {
    const total = exactAverage({ dice: main.dice, flat: main.flat });
    return total <= 0 ? 1 : exactAverage({ dice: main.dice, flat: 0 }) / total;
}

/** The table's dice count at a level; every column at a level shares it. */
export function damageDiceAt(level: number): number | undefined {
    const formulas = strikeDamageFormulas(level);
    const example = ADJECTIVES.map((adjective) => formulas?.[adjective]).find(
        (f) => f !== undefined,
    );
    return example === undefined ? undefined : parseFormula(example)?.dice?.count;
}

/** Accepts NdX followed by any number of signed integers (pf2e data has "3d6+12+2"), or a bare integer. */
export function parseFormula(text: string): Formula | undefined {
    const compact = text.replaceAll(/\s/g, "").replaceAll("–", "-");
    const match = /^(?:(\d+)d(\d+)|(\d+))?((?:[+-]\d+)*)$/.exec(compact);
    if (match === null || compact === "") return undefined;
    const [, count, size, leading = "0", modifiers = ""] = match;
    const terms = [...modifiers.matchAll(/[+-]\d+/g)].map(([term]) => Number(term));
    const flat = terms.reduce((sum, term) => sum + term, Number(leading));
    const dice = count === undefined ? undefined : { count: Number(count), size: Number(size) };
    return { dice, flat };
}

export function formatFormula({ dice, flat }: Formula): string {
    if (dice === undefined) return String(flat);
    const base = `${dice.count}d${dice.size}`;
    return flat === 0 ? base : `${base}${flat > 0 ? "+" : ""}${flat}`;
}

function scalePrecision({ dice, flat }: Formula, ratio: number): Formula {
    if (dice === undefined) return { dice, flat };
    return { dice: { ...dice, count: Math.max(1, Math.round(dice.count * ratio)) }, flat };
}

function extrasAverage(damage: StrikeDamage): number {
    return damage.extras.reduce((sum, formula) => sum + exactAverage(formula), 0);
}

function exactAverage({ dice, flat }: Formula): number {
    return dice === undefined ? flat : (dice.count * (dice.size + 1)) / 2 + flat;
}
