import {
    damageAverage,
    parseFormula,
    weaponDice,
    type Formula,
    type SideCategory,
    type StrikeDamage,
} from "../core/damage";
import type { Stat } from "../core/stats";

interface DamagePartial {
    readonly key: string;
    readonly damage: string;
    readonly category: string | null;
}

const SIDE_CATEGORIES = [
    "precision",
    "persistent",
    "splash",
] as const satisfies readonly SideCategory[];

/** Strikes whose damage the helper cannot read (no plain dice partial, odd formulas or dice) are not scaled. */
export function strikeDamageStat<Target>(
    itemId: string,
    system: object,
    target: (damage: StrikeDamage) => Target,
): Stat<Target>[] {
    const damage = readStrikeDamage(damagePartials(system));
    if (damage === undefined) return [];
    return [
        {
            id: `strikeDamage:${itemId}`,
            kind: "strikeDamage",
            value: damageAverage(damage),
            target: target(damage),
        },
    ];
}

/** The main partial is the first with no category, the same one pf2e treats as an NPC attack's base damage. */
function readStrikeDamage(partials: readonly DamagePartial[]): StrikeDamage | undefined {
    const [mainPartial, ...extraPartials] = partials.filter(({ category }) => category === null);
    const main = mainPartial === undefined ? undefined : parseFormula(mainPartial.damage);
    const dice = main?.dice === undefined ? undefined : weaponDice(main.dice);
    if (mainPartial === undefined || main === undefined || dice === undefined) return undefined;
    const extras = extraPartials.map(({ damage }) => parseFormula(damage));
    if (!extras.every((extra): extra is Formula => extra !== undefined)) return undefined;
    return {
        main: { key: mainPartial.key, dice, flat: main.flat },
        extras,
        sides: partials.flatMap(sidePartial),
    };
}

/** An unreadable side partial is left as it is; it does not count toward the average anyway. */
function sidePartial({ key, damage, category }: DamagePartial): StrikeDamage["sides"][number][] {
    const formula = parseFormula(damage);
    if (!isSideCategory(category) || formula === undefined) return [];
    return [{ key, category, formula }];
}

function isSideCategory(category: string | null): category is SideCategory {
    return SIDE_CATEGORIES.some((side) => side === category);
}

function damagePartials(system: object): DamagePartial[] {
    const rolls = "damageRolls" in system ? system.damageRolls : undefined;
    if (typeof rolls !== "object" || rolls === null) return [];
    return Object.entries(rolls).flatMap(([key, partial]: [string, unknown]) => {
        if (typeof partial !== "object" || partial === null) return [];
        const { damage, category } = partial as { damage?: unknown; category?: unknown };
        if (typeof damage !== "string") return [];
        return [{ key, damage, category: typeof category === "string" ? category : null }];
    });
}
