import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import { ENABLED_FLAG, MODULE_ID } from "./npc";
import type { ItemUpdate, NpcUpdate } from "./updates";

export function asNpc(value: unknown): NPCPF2e | undefined {
    return value instanceof CONFIG.PF2E.Actor.documentClasses.npc ? value : undefined;
}

/** Not atomic: the actor and its items are separate Foundry documents, so they are two requests. */
export async function writeUpdate(npc: NPCPF2e, update: NpcUpdate): Promise<void> {
    if (Object.keys(update.actor).length > 0) await npc.update(update.actor);
    await writeItems(npc, update.items);
}

export async function writeItems(npc: NPCPF2e, items: readonly ItemUpdate[]): Promise<void> {
    if (items.length === 0) return;
    await npc.updateEmbeddedDocuments(
        "Item",
        items.map(({ itemId, fields }) => ({ _id: itemId, ...fields })),
    );
}

export async function setEnabled(npc: NPCPF2e, enabled: boolean): Promise<void> {
    await npc.setFlag(MODULE_ID, ENABLED_FLAG, enabled);
}
