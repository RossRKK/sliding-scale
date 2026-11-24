import type { NPCPF2e } from "@7h3laughingman/pf2e-types";

/** A row under pf2e's NPC sheet header for the build helper's own controls. */
export function addHeaderBar(npc: NPCPF2e, root: HTMLElement): void {
    const bar = document.createElement("div");
    bar.className = "bcnpc-header";
    const link = sourceLink(npc._stats.compendiumSource);
    if (link !== undefined) bar.append(link);
    if (bar.childElementCount > 0) root.querySelector(".npc-body > header")?.append(bar);
}

/** Homebrew NPCs have no compendium source, so they get no link. */
function sourceLink(uuid: string | null | undefined): HTMLAnchorElement | undefined {
    if (typeof uuid !== "string") return undefined;
    const link = document.createElement("a");
    link.className = "bcnpc-source";
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
