import { applyAdjectives, rescaleStats, type StatChange } from "../core/stats";
import type { Adjective } from "../core/adjective";
import { hitPointAdjustment } from "../core/elite-weak";
import type { ActiveBuild, Target } from "./npc";

/** Foundry updates for one NPC: the actor's own fields and one entry per changed embedded item. */
export interface NpcUpdate {
    readonly actor: Readonly<Record<string, number>>;
    readonly items: readonly ItemUpdate[];
}

export interface ItemUpdate {
    readonly itemId: string;
    readonly fields: Readonly<Record<string, number>>;
}

/** User-entered fields in the same update win over rescaled ones. */
export function planLevelChange(
    build: ActiveBuild,
    newLevel: number,
    alreadyChanged: ReadonlySet<string>,
): NpcUpdate {
    const bonusChange =
        hitPointAdjustment(build.adjustment, newLevel) -
        hitPointAdjustment(build.adjustment, build.level);
    const changes = rescaleStats(build.stats, build.level, newLevel);
    const { actor, items } = toUpdate(changes, bonusChange);
    const kept = Object.entries(actor).filter(([path]) => !alreadyChanged.has(path));
    return { actor: Object.fromEntries(kept), items };
}

export function planAdjectives(
    build: ActiveBuild,
    adjectives: ReadonlyMap<string, Adjective>,
): NpcUpdate {
    return toUpdate(applyAdjectives(build.stats, build.level, adjectives), 0);
}

/** Current HP moves with max HP (and any change in elite/weak bonus) so damage taken is kept. */
export function toUpdate(
    changes: readonly StatChange<Target>[],
    hitPointBonusChange: number,
): NpcUpdate {
    const actor: Record<string, number> = {};
    const items = new Map<string, Record<string, number>>();
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
                actor["system.attributes.hp.value"] = Math.max(
                    0,
                    target.current + to - from + hitPointBonusChange,
                );
                break;
            case "itemField":
                items.set(target.itemId, { ...items.get(target.itemId), [target.path]: to });
                break;
        }
    }
    return { actor, items: [...items].map(([itemId, fields]) => ({ itemId, fields })) };
}
