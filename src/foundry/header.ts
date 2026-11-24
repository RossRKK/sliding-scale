import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import { setPaused } from "./documents";
import { MODULE_ID } from "./npc";

interface HeaderState {
    readonly paused: boolean;
    readonly editable: boolean;
}

/** A row under pf2e's NPC sheet header for Sliding Scale's own controls. */
export function addHeaderBar(npc: NPCPF2e, root: HTMLElement, state: HeaderState): void {
    const bar = document.createElement("div");
    bar.className = `${MODULE_ID}-header`;
    bar.append(pauseToggle(npc, state));
    const link = sourceLink(npc._stats.compendiumSource);
    if (link !== undefined) bar.append(link);
    root.querySelector(".npc-body > header")?.append(bar);
}

function pauseToggle(npc: NPCPF2e, { paused, editable }: HeaderState): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = paused ? `${MODULE_ID}-pause paused` : `${MODULE_ID}-pause`;
    button.disabled = !editable;
    button.innerHTML = paused
        ? `<i class="fa-solid fa-play"></i> Build helper paused: resume`
        : `<i class="fa-solid fa-pause"></i> Pause build helper`;
    button.dataset.tooltip = paused
        ? "Adjectives will be re-derived from the current numbers"
        : "Stop rescaling on level changes and hide the adjective dropdowns";
    button.addEventListener("click", () => void setPaused(npc, !paused));
    return button;
}

/** Homebrew NPCs have no compendium source, so they get no link. */
function sourceLink(uuid: string | null | undefined): HTMLAnchorElement | undefined {
    if (typeof uuid !== "string") return undefined;
    const link = document.createElement("a");
    link.className = `${MODULE_ID}-source`;
    link.dataset.tooltip = "Open the compendium original";
    link.innerHTML = `<i class="fa-solid fa-book"></i> `;
    link.append(fromUuidSync(uuid)?.name ?? "Compendium original");
    link.addEventListener("click", () => void openSheet(uuid));
    return link;
}

async function openSheet(uuid: string): Promise<void> {
    const original = await fromUuid(uuid);
    await original?.sheet?.render(true);
}
