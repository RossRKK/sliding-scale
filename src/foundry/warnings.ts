import { diceShare, formatFormula } from "../core/damage";
import type { WarningNote } from "../core/notes";
import type { ActiveBuild, NpcSource } from "./npc";
import { descriptionMayBeStale } from "./precision-abilities";

/** A tiny weapon die at high level means almost all damage is the flat modifier. */
const LOW_DICE_SHARE = 0.25;

/** Warnings worked out from the stat block as it is now; they go away when their cause does. */
export function warningsOf(source: NpcSource, build: ActiveBuild): WarningNote[] {
    const nameOf = (itemId: string) =>
        source.items.find(({ _id }) => _id === itemId)?.name ?? "Unnamed item";
    const lowDice = build.stats.flatMap(({ target }): WarningNote[] => {
        if (target.kind !== "strikeDamage" || diceShare(target.damage.main) >= LOW_DICE_SHARE) {
            return [];
        }
        const { itemId, damage } = target;
        const formula = formatFormula({ dice: damage.main.dice, flat: damage.main.flat });
        return [{ kind: "lowDiceShare", itemId, itemName: nameOf(itemId), formula }];
    });
    const stale = build.precisionAbilities
        .filter(descriptionMayBeStale)
        .map(({ itemId, dice }): WarningNote => ({
            kind: "staleDescription",
            itemId,
            itemName: nameOf(itemId),
            formulas: dice.map(({ count, dieSize }) => `${count}${dieSize}`),
        }));
    return [...lowDice, ...stale];
}
