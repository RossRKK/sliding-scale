import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import type { Adjective } from "../core/adjective";
import { diceShare } from "../core/damage";
import { adjectivesAt, derive, type Rating } from "../core/scale";
import { TABLE_OF } from "../core/stats";
import { asNpc, writeUpdate } from "./documents";
import { addHeaderBar } from "./header";
import { MODULE_ID, readNpc, type ActiveBuild, type NpcStat } from "./npc";
import { descriptionMayBeStale } from "./precision-abilities";
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
        if (build.state === "paused") return;
        addAdjectiveControls(npc, build, root, editable);
        addStaleDescriptionHints(build, root);
    });
}

function addStaleDescriptionHints(build: ActiveBuild, root: HTMLElement): void {
    for (const ability of build.precisionAbilities.filter(descriptionMayBeStale)) {
        const name = root.querySelector(`li.action[data-item-id="${ability.itemId}"] h4 .name`);
        name?.append(
            warningIcon("The description may not match this ability's precision dice any more"),
        );
    }
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
        const warning = warningFor(stat);
        if (warning !== undefined) select.after(warningIcon(warning));
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
    select.className = `${MODULE_ID}-adjective`;
    select.disabled = !editable;
    select.dataset.tooltip = `Sliding Scale: ${ratingLabel(rating)}`;
    for (const adjective of adjectives) {
        const label = adjective === rating.adjective ? ratingLabel(rating) : adjective;
        select.append(new Option(label, adjective, false, adjective === rating.adjective));
    }
    return select;
}

function warningIcon(message: string): HTMLElement {
    const icon = document.createElement("i");
    icon.className = `${MODULE_ID}-warning fa-solid fa-triangle-exclamation`;
    icon.dataset.tooltip = message;
    return icon;
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
        case "strikeDamage":
            return inside(
                root.querySelector(
                    `[data-item-id="${target.itemId}"][data-strike] .subsection.damage`,
                ),
            );
    }
}

/** Informational only: a tiny weapon die at high level means almost all damage is the flat modifier. */
function warningFor({ target }: NpcStat): string | undefined {
    if (target.kind !== "strikeDamage" || diceShare(target.damage.main) >= LOW_DICE_SHARE)
        return undefined;
    return "Dice are under a quarter of this strike's damage; consider a bigger weapon die";
}

const LOW_DICE_SHARE = 0.25;

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
