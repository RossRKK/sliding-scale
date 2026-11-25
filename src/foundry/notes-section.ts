import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import { acknowledge, noteText, visibleNotes, type Note } from "../core/notes";
import { writeNotes } from "./documents";
import { MODULE_ID, readNpc, type ActiveBuild } from "./npc";
import { warningsOf } from "./warnings";

/** Lists what Sliding Scale wants a human to check, each with a button to acknowledge it. */
export function addNotesSection(
    npc: NPCPF2e,
    build: ActiveBuild,
    root: HTMLElement,
    editable: boolean,
): void {
    const notes = visibleNotes(build.notes, warningsOf(npc._source, build));
    if (notes.length === 0) return;
    const section = document.createElement("section");
    section.className = `${MODULE_ID}-notes`;
    const heading = document.createElement("h4");
    heading.textContent = "Sliding Scale notes";
    const list = document.createElement("ul");
    list.append(...notes.map((note) => noteItem(npc, note, editable)));
    section.append(heading, list);
    root.querySelector(`.${MODULE_ID}-header`)?.after(section);
}

function noteItem(npc: NPCPF2e, note: Note, editable: boolean): HTMLLIElement {
    const item = document.createElement("li");
    item.dataset.noteKind = note.kind;
    const text = document.createElement("span");
    text.textContent = noteText(note);
    item.append(text);
    if (!editable) return item;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${MODULE_ID}-acknowledge`;
    button.dataset.tooltip = "Acknowledge: hide this note until its cause changes";
    button.innerHTML = `<i class="fa-solid fa-check"></i>`;
    button.addEventListener("click", () => void acknowledgeNote(npc, note));
    item.append(button);
    return item;
}

/** Re-reads the source so notes written since the sheet rendered are kept. */
async function acknowledgeNote(npc: NPCPF2e, note: Note): Promise<void> {
    const build = readNpc(npc._source);
    if (build.state === "disabled") return;
    await writeNotes(npc, acknowledge(build.notes, warningsOf(npc._source, build), note));
}
