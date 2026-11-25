import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import type { StoredNotes } from "../core/notes";
import { ENABLED_FLAG, MODULE_ID, readNpc } from "./npc";
import { NOTES_FLAG } from "./stored-notes";
import { planTraitIwr } from "./trait-iwr";
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

export async function writeNotes(npc: NPCPF2e, notes: StoredNotes): Promise<void> {
    await npc.setFlag(MODULE_ID, NOTES_FLAG, notes);
}

/** Re-reads the source so the IWR added is computed from what the NPC has now. */
export async function applyTraitIwr(npc: NPCPF2e): Promise<void> {
    const build = readNpc(npc._source);
    if (build.state === "disabled") return;
    const changes = planTraitIwr(npc._source, build);
    if (changes === undefined) {
        ui.notifications.info("Its traits bring no immunities, weaknesses or resistances it lacks");
        return;
    }
    await npc.update(changes.actor);
    await writeNotes(npc, changes.notes);
}
