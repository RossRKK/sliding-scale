import { mentionsFormula, rewriteFormulas } from "../core/description";
import { scaleByProgression, SNEAK_ATTACK_DICE } from "../core/progressions";

/** An NPC ability (Sneak Attack, Trick Attack, Hunt Prey…) whose rules add precision dice to Strikes. */
export interface PrecisionAbility {
    readonly itemId: string;
    /** The item's whole rules array: Foundry replaces arrays wholesale, so it is written back in full. */
    readonly rules: readonly unknown[];
    readonly description: string;
    readonly dice: readonly PrecisionDice[];
}

interface PrecisionDice {
    readonly ruleIndex: number;
    readonly count: number;
    readonly dieSize: string;
}

interface AbilitySource {
    readonly _id: string | null;
    readonly type?: string | undefined;
    readonly system: object;
}

export function readPrecisionAbilities(items: readonly AbilitySource[]): PrecisionAbility[] {
    return items.flatMap((item) => {
        if (item._id === null || item.type !== "action") return [];
        const rules = arrayAt(item.system, "rules");
        const dice = rules.flatMap(precisionDice);
        if (dice.length === 0) return [];
        const description = descriptionOf(item.system);
        return [{ itemId: item._id, rules, description, dice }];
    });
}

/** Dice counts follow sneak attack; the description follows only where it names the old formula once. */
export function rescaleAbility(
    ability: PrecisionAbility,
    fromLevel: number,
    toLevel: number,
): Record<string, string | readonly unknown[]> | undefined {
    const scaled = ability.dice.map((dice) => ({
        ...dice,
        newCount: scaleByProgression(SNEAK_ATTACK_DICE, dice.count, fromLevel, toLevel),
    }));
    const changed = scaled.filter(({ count, newCount }) => count !== newCount);
    if (changed.length === 0) return undefined;
    const rules = ability.rules.map((rule, index) => {
        const change = changed.find(({ ruleIndex }) => ruleIndex === index);
        return change === undefined ? rule : { ...(rule as object), diceNumber: change.newCount };
    });
    const rewrites = changed.map(({ count, newCount, dieSize }) => ({
        from: `${count}${dieSize}`,
        to: `${newCount}${dieSize}`,
    }));
    return {
        "system.rules": rules,
        "system.description.value": rewriteFormulas(ability.description, rewrites),
    };
}

/** The description no longer names one of the ability's precision formulas, so a human should check it. */
export function descriptionMayBeStale(ability: PrecisionAbility): boolean {
    return ability.dice.some(
        ({ count, dieSize }) => !mentionsFormula(ability.description, `${count}${dieSize}`),
    );
}

/** Only fixed dice counts are scaled; resolvable expressions already compute their own value. */
function precisionDice(rule: unknown, ruleIndex: number): PrecisionDice[] {
    if (typeof rule !== "object" || rule === null) return [];
    const { key, category, diceNumber, dieSize } = rule as Record<string, unknown>;
    if (key !== "DamageDice" || category !== "precision") return [];
    const count =
        typeof diceNumber === "string" && /^\d+$/.test(diceNumber)
            ? Number(diceNumber)
            : diceNumber;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) return [];
    if (typeof dieSize !== "string" || !/^d\d+$/.test(dieSize)) return [];
    return [{ ruleIndex, count, dieSize }];
}

function arrayAt(system: object, key: string): readonly unknown[] {
    const value = (system as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
}

function descriptionOf(system: object): string {
    const description = (system as { description?: { value?: unknown } }).description?.value;
    return typeof description === "string" ? description : "";
}
