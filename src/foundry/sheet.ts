import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import type { Adjective } from "../core/adjective";
import { adjectivesAt, derive, type Rating } from "../core/scale";
import { TABLE_OF } from "../core/stats";
import { asNpc, writeUpdate } from "./documents";
import { addHeaderBar } from "./header";
import { readNpc, type ActiveBuild, type NpcStat } from "./npc";
import { planAdjectives } from "./updates";

/** Adds the header controls and, unless paused, an adjective dropdown per scaled stat to pf2e's NPC sheet. */
export function registerSheetControls(): void {
    Hooks.on("renderNPCSheetPF2e", (sheet: unknown, html: unknown) => {
        const npc = asNpc((sheet as { actor?: unknown }).actor);
        const root = rootElement(html);
        if (npc === undefined || root === undefined) return;
        const build = readNpc(npc._source);
        const editable = isEditable(sheet);
        addHeaderBar(npc, root, { paused: build.state === "paused", editable });
        if (build.state === "active") addAdjectiveControls(npc, build, root, editable);
    });
}

function addAdjectiveControls(
    npc: NPCPF2e,
    build: ActiveBuild,
    root: HTMLElement,
    editable: boolean,
): void {
    for (const stat of build.stats) {
        const table = TABLE_OF[stat.kind];
        const rating = derive(table, build.level, stat.value);
        const anchor = findAnchor(root, stat);
        if (rating === undefined || anchor === undefined) continue;
        const select = adjectiveSelect(adjectivesAt(table, build.level), rating, editable);
        select.dataset.statId = stat.id;
        select.addEventListener("change", () => {
            void setAdjective(npc, stat.id, select.value as Adjective);
        });
        anchor.place(select);
    }
}

/** Re-reads the source so a change made since the sheet rendered is not overwritten. */
async function setAdjective(npc: NPCPF2e, statId: string, adjective: Adjective): Promise<void> {
    const build = readNpc(npc._source);
    if (build.state === "paused") return;
    await writeUpdate(npc, planAdjectives(build, new Map([[statId, adjective]])));
}

function adjectiveSelect(
    adjectives: readonly Adjective[],
    rating: Rating,
    editable: boolean,
): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "bcnpc-adjective";
    select.disabled = !editable;
    select.dataset.tooltip = `Building Creatures: ${ratingLabel(rating)}`;
    for (const adjective of adjectives) {
        const label = adjective === rating.adjective ? ratingLabel(rating) : adjective;
        select.append(new Option(label, adjective, false, adjective === rating.adjective));
    }
    return select;
}

function ratingLabel({ adjective, offset }: Rating): string {
    if (offset === 0) return adjective;
    return `${adjective} ${offset > 0 ? "+" : "−"}${Math.abs(offset)}`;
}

interface Anchor {
    readonly place: (control: HTMLElement) => void;
}

/** Where each stat's number is shown on pf2e's NPC sheet template. */
function findAnchor(root: HTMLElement, stat: NpcStat): Anchor | undefined {
    const { target } = stat;
    switch (target.kind) {
        case "actorField":
            return after(root.querySelector(`[data-property="${target.path}"]`));
        case "skill":
            return inside(root.querySelector(`.skill-entry[data-statistic="${target.slug}"]`));
        case "hitPoints":
            return after(root.querySelector(".subsection.health > header"));
        case "itemField": {
            const item = `[data-item-id="${target.itemId}"]`;
            if (stat.kind === "strikeAttack") {
                return inside(root.querySelector(`${item}[data-strike] .subsection.attack`));
            }
            const field = `[data-base-property$=".${target.path}"]`;
            return after(root.querySelector(`[data-spellcasting-entry]${item} ${field}`));
        }
    }
}

function after(element: Element | null): Anchor | undefined {
    return element === null ? undefined : { place: (control) => element.after(control) };
}

function inside(element: Element | null): Anchor | undefined {
    return element === null ? undefined : { place: (control) => element.append(control) };
}

/** AppV1 render hooks pass jQuery; accept a bare element too in case pf2e moves to AppV2. */
function rootElement(html: unknown): HTMLElement | undefined {
    if (html instanceof HTMLElement) return html;
    const first = (html as { 0?: unknown } | null)?.[0];
    return first instanceof HTMLElement ? first : undefined;
}

function isEditable(sheet: unknown): boolean {
    return (sheet as { isEditable?: unknown }).isEditable === true;
}
