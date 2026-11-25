import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import { applyTraitIwr, setEnabled } from "./documents";
import { MODULE_ID } from "./npc";
import { openRoadMapDialog } from "./road-map-dialog";

interface HeaderState {
    readonly enabled: boolean;
    readonly editable: boolean;
}

/** A row under pf2e's NPC sheet header for Sliding Scale's own controls. */
export function addHeaderBar(npc: NPCPF2e, root: HTMLElement, state: HeaderState): void {
    const bar = document.createElement("div");
    bar.className = `${MODULE_ID}-header`;
    bar.append(enableToggle(npc, state));
    if (state.enabled) {
        bar.append(roadMapButton(npc, state.editable), traitIwrButton(npc, state.editable));
    }
    const link = sourceLink(npc._stats.compendiumSource);
    if (link !== undefined) bar.append(link);
    root.querySelector(".npc-body > header")?.append(bar);
}

function enableToggle(npc: NPCPF2e, { enabled, editable }: HeaderState): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = enabled ? `${MODULE_ID}-toggle enabled` : `${MODULE_ID}-toggle`;
    button.disabled = !editable;
    button.innerHTML = enabled
        ? `<i class="fa-solid fa-toggle-on"></i> Disable Sliding Scale`
        : `<i class="fa-solid fa-toggle-off"></i> Enable Sliding Scale`;
    button.dataset.tooltip = enabled
        ? "Stop rescaling on level changes and hide the adjective dropdowns"
        : "Show adjective dropdowns and rescale on level changes; no numbers change";
    button.addEventListener("click", () => void setEnabled(npc, !enabled));
    return button;
}

function roadMapButton(npc: NPCPF2e, editable: boolean): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${MODULE_ID}-road-map`;
    button.disabled = !editable;
    button.innerHTML = `<i class="fa-solid fa-map"></i> Apply road map`;
    button.dataset.tooltip = "Overwrite this NPC's numbers with a Building Creatures road map";
    button.addEventListener("click", () => void openRoadMapDialog(npc));
    return button;
}

function traitIwrButton(npc: NPCPF2e, editable: boolean): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${MODULE_ID}-trait-iwr`;
    button.disabled = !editable;
    button.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Apply trait IWR`;
    button.dataset.tooltip =
        "Add the immunities, weaknesses and resistances this NPC's traits usually bring";
    button.addEventListener("click", () => void applyTraitIwr(npc));
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
