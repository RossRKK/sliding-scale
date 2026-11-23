import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import { asNpc, writeItems } from "./documents";
import { MODULE_ID, readNpc } from "./npc";
import { planLevelChange, type ItemUpdate } from "./updates";

/** Rescales an NPC's stats when its base level is changed, keeping each stat's adjective and offset. */
export function registerLevelChange(): void {
    Hooks.on("preUpdateActor", (actor: unknown, changed: unknown, options: unknown) => {
        const npc = asNpc(actor);
        if (npc !== undefined) addRescaledStats(npc, asRecord(changed), asRecord(options));
    });
    Hooks.on(
        "updateActor",
        (actor: unknown, _changed: unknown, options: unknown, userId: unknown) => {
            const npc = asNpc(actor);
            const items = stashedItems(asRecord(options));
            if (npc !== undefined && items !== undefined && userId === game.user.id) {
                void writeItems(npc, items);
            }
        },
    );
}

function addRescaledStats(
    npc: NPCPF2e,
    changed: Record<string, unknown>,
    options: Record<string, unknown>,
): void {
    const newLevel = foundry.utils.getProperty(changed, "system.details.level.value");
    // Source, not prepared, values: prepared ones include elite/weak, conditions and effects.
    const build = readNpc(npc._source);
    if (typeof newLevel !== "number" || newLevel === build.level) return;
    const alreadyChanged = new Set(Object.keys(foundry.utils.flattenObject(changed)));
    const plan = planLevelChange(build, newLevel, alreadyChanged);
    foundry.utils.mergeObject(changed, foundry.utils.expandObject(plan.actor));
    // Items are separate documents, so they are written once the actor update has succeeded.
    if (plan.items.length > 0) options[MODULE_ID] = { items: plan.items };
}

function stashedItems(options: Record<string, unknown>): readonly ItemUpdate[] | undefined {
    const stash = options[MODULE_ID];
    return typeof stash === "object" && stash !== null && "items" in stash
        ? (stash.items as readonly ItemUpdate[])
        : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
