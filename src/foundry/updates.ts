import { rebuildDamage, type PartialChange } from "../core/damage";
import { applyAdjectives, rescaleStats, type StatChange } from "../core/stats";
import type { Adjective } from "../core/adjective";
import { hitPointAdjustment, type Adjustment } from "../core/elite-weak";
import type { ActiveBuild, Target } from "./npc";

/** Foundry updates for one NPC: the actor's own fields and one entry per changed embedded item. */
export interface NpcUpdate {
    readonly actor: Readonly<Record<string, number>>;
    readonly items: readonly ItemUpdate[];
}

export interface ItemUpdate {
    readonly itemId: string;
    readonly fields: Readonly<Record<string, number | string>>;
}

/** The levels a set of stat changes moves between; equal for an adjective change. */
interface LevelChange {
    readonly from: number;
    readonly to: number;
    readonly adjustment: Adjustment | undefined;
}

/** User-entered fields in the same update win over rescaled ones. */
export function planLevelChange(
    build: ActiveBuild,
    newLevel: number,
    alreadyChanged: ReadonlySet<string>,
): NpcUpdate {
    const changes = rescaleStats(build.stats, build.level, newLevel);
    const levels = { from: build.level, to: newLevel, adjustment: build.adjustment };
    const { actor, items } = toUpdate(changes, levels);
    const kept = Object.entries(actor).filter(([path]) => !alreadyChanged.has(path));
    return { actor: Object.fromEntries(kept), items };
}

export function planAdjectives(
    build: ActiveBuild,
    adjectives: ReadonlyMap<string, Adjective>,
): NpcUpdate {
    const levels = { from: build.level, to: build.level, adjustment: build.adjustment };
    return toUpdate(applyAdjectives(build.stats, build.level, adjectives), levels);
}

export function toUpdate(changes: readonly StatChange<Target>[], levels: LevelChange): NpcUpdate {
    const actor: Record<string, number> = {};
    const items = new Map<string, Record<string, number | string>>();
    for (const { target, from, to } of changes) {
        switch (target.kind) {
            case "actorField":
                actor[target.path] = to;
                break;
            case "skill":
                actor[`system.skills.${target.slug}.base`] = to;
                break;
            case "hitPoints":
                actor["system.attributes.hp.max"] = to;
                actor["system.attributes.hp.value"] = currentHitPoints(
                    target.current,
                    from,
                    to,
                    levels,
                );
                break;
            case "itemField":
                items.set(target.itemId, { ...items.get(target.itemId), [target.path]: to });
                break;
            case "strikeDamage":
                items.set(target.itemId, {
                    ...items.get(target.itemId),
                    ...damageFields(rebuildDamage(target.damage, to, levels.from, levels.to)),
                });
                break;
        }
    }
    return { actor, items: [...items].map(([itemId, fields]) => ({ itemId, fields })) };
}

function damageFields(changes: readonly PartialChange[] | undefined): Record<string, string> {
    const entries = (changes ?? []).map(({ key, formula }) => [
        `system.damageRolls.${key}.damage`,
        formula,
    ]);
    return Object.fromEntries(entries);
}

/** Current HP moves with max HP and with the level-dependent elite/weak bonus, so damage taken is kept. */
function currentHitPoints(current: number, from: number, to: number, levels: LevelChange): number {
    const bonusChange =
        hitPointAdjustment(levels.adjustment, levels.to) -
        hitPointAdjustment(levels.adjustment, levels.from);
    return Math.max(0, current + to - from + bonusChange);
}
