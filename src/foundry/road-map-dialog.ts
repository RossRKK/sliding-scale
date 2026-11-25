import type { NPCPF2e } from "@7h3laughingman/pf2e-types";
import {
    roadMapsFor,
    type Attribute,
    type Book,
    type RoadMap,
    type StrikeKind,
} from "../core/road-maps";
import { writeNotes, writeUpdate } from "./documents";
import { MODULE_ID, readNpc } from "./npc";
import { applyRoadMap, type NewStrike, type RoadMapChanges, type StrikeShape } from "./road-map";

const UNASSIGNED_SKILL_ROLE = "unassignedSkill";
const ANACHRONISM_MODULE = "sf2e-anachronism";

/** Asks for a road map and which Strikes to add, then overwrites the NPC with it. */
export async function openRoadMapDialog(npc: NPCPF2e): Promise<void> {
    const roadMaps = roadMapsFor(booksInPlay());
    const strikes = strikeShapes(npc);
    const lacks = (kind: StrikeKind) => !strikes.some((strike) => strike.kind === kind);
    // The prompt resolves to the ok callback's result, which its typings do not carry through.
    const choice = (await foundry.applications.api.DialogV2.prompt({
        window: { title: "Apply road map" },
        content: dialogContent(roadMaps, { melee: lacks("melee"), ranged: lacks("ranged") }),
        ok: {
            label: "Apply",
            callback: (_event: Event, button: HTMLButtonElement) => readChoice(button.form),
        },
        rejectClose: false,
    })) as Choice | null | undefined;
    const roadMap = roadMaps.find((candidate) => keyOf(candidate) === choice?.roadMap);
    if (choice === undefined || choice === null || roadMap === undefined) return;
    await applyToNpc(npc, roadMap, choice.addStrikes);
}

async function applyToNpc(
    npc: NPCPF2e,
    roadMap: RoadMap,
    addStrikes: ReadonlySet<StrikeKind>,
): Promise<void> {
    const build = readNpc(npc._source);
    if (build.state === "disabled") return;
    const changes = applyRoadMap(build, roadMap, {
        strikes: strikeShapes(npc),
        skillAttributes: skillAttributes(),
        spellcastingAttribute: spellcastingAttribute(npc),
        addStrikes,
    });
    await writeUpdate(npc, changes.update);
    await writeNewSkills(npc, changes.newSkills);
    await replaceUnassignedSkills(npc, changes.unassignedSkills);
    await createStrikes(npc, changes.newStrikes);
    await writeNotes(npc, changes.notes);
}

/** Starfinder Anachronism adds Starfinder's classes to a pf2e world, so both books apply there. */
function booksInPlay(): Book[] {
    if (game.system.id === "sf2e") return ["starfinder"];
    return game.modules.get(ANACHRONISM_MODULE)?.active
        ? ["pathfinder", "starfinder"]
        : ["pathfinder"];
}

/** pf2e treats an NPC attack with a range, or a thrown trait, as ranged. */
function strikeShapes(npc: NPCPF2e): StrikeShape[] {
    return npc.itemTypes.melee
        .filter((item) => (item._source.system.action ?? "strike") === "strike")
        .map((item) => {
            const traits: readonly string[] = item._source.system.traits.value;
            const thrown = traits.some((trait) => /^thrown(-\d+)?$/.test(trait));
            const ranged = item._source.system.range !== null || thrown;
            return {
                itemId: item.id,
                kind: ranged ? "ranged" : "melee",
                agile: traits.includes("agile"),
            };
        });
}

function skillAttributes(): Record<string, Attribute> {
    const skills = CONFIG.PF2E.skills as Record<string, { attribute: Attribute } | undefined>;
    return Object.fromEntries(
        Object.entries(skills).flatMap(([slug, skill]) => (skill ? [[slug, skill.attribute]] : [])),
    );
}

function spellcastingAttribute(npc: NPCPF2e): Attribute | undefined {
    const entry = npc.itemTypes.spellcastingEntry[0];
    return entry?._source.system.ability?.value as Attribute | undefined;
}

async function writeNewSkills(npc: NPCPF2e, skills: RoadMapChanges["newSkills"]): Promise<void> {
    const entries = Object.entries(skills);
    if (entries.length === 0) return;
    await npc.update(
        Object.fromEntries(entries.map(([slug, base]) => [`system.skills.${slug}.base`, base])),
    );
}

/** Unassigned skills from an earlier road map are replaced, found by the role flag set on them. */
async function replaceUnassignedSkills(npc: NPCPF2e, values: readonly number[]): Promise<void> {
    const earlier = npc.itemTypes.lore.filter(
        (item) => item.getFlag(MODULE_ID, "role") === UNASSIGNED_SKILL_ROLE,
    );
    if (earlier.length > 0)
        await npc.deleteEmbeddedDocuments(
            "Item",
            earlier.map(({ id }) => id),
        );
    const name = game.i18n.localize("SLIDING_SCALE.UnassignedSkill");
    const items = values.map((value, index) => ({
        type: "lore",
        name: values.length === 1 ? name : `${name} ${index + 1}`,
        system: { mod: { value }, proficient: { value: 0 } },
        flags: { [MODULE_ID]: { role: UNASSIGNED_SKILL_ROLE } },
    }));
    if (items.length > 0) await npc.createEmbeddedDocuments("Item", items);
}

/** The book's common range increments for NPC ranged Strikes in each system's packs. */
const RANGE_INCREMENT = { pf2e: 60, sf2e: 30 } as const;

async function createStrikes(npc: NPCPF2e, strikes: readonly NewStrike[]): Promise<void> {
    if (strikes.length === 0) return;
    const increment = game.system.id === "sf2e" ? RANGE_INCREMENT.sf2e : RANGE_INCREMENT.pf2e;
    const items = strikes.map(({ kind, bonus, damage }) => ({
        type: "melee",
        name: game.i18n.localize(
            kind === "melee" ? "SLIDING_SCALE.MeleeStrike" : "SLIDING_SCALE.RangedStrike",
        ),
        system: {
            action: "strike",
            bonus: { value: bonus },
            damageRolls: {
                [foundry.utils.randomID()]: {
                    damage,
                    damageType: kind === "melee" ? "bludgeoning" : "piercing",
                    category: null,
                },
            },
            range: kind === "ranged" ? { increment, max: null } : null,
        },
    }));
    await npc.createEmbeddedDocuments("Item", items);
}

interface Choice {
    readonly roadMap: string;
    readonly addStrikes: ReadonlySet<StrikeKind>;
}

function readChoice(form: HTMLFormElement | null): Choice | undefined {
    if (form === null) return undefined;
    const data = new FormData(form);
    const addStrikes = new Set<StrikeKind>(
        (["melee", "ranged"] as const).filter((kind) => data.get(kind) !== null),
    );
    return { roadMap: String(data.get("roadMap")), addStrikes };
}

function keyOf(roadMap: RoadMap): string {
    return `${roadMap.book}:${roadMap.id}`;
}

const BOOK_LABELS: Record<Book, string> = { pathfinder: "Pathfinder", starfinder: "Starfinder" };

function dialogContent(roadMaps: readonly RoadMap[], ticked: Record<StrikeKind, boolean>): string {
    const books = [...new Set(roadMaps.map(({ book }) => book))];
    const groups = books.map((book) => {
        const options = roadMaps
            .filter((roadMap) => roadMap.book === book)
            .map((roadMap) => `<option value="${keyOf(roadMap)}">${roadMap.name}</option>`)
            .join("");
        return `<optgroup label="${BOOK_LABELS[book]}">${options}</optgroup>`;
    });
    const checkbox = (kind: StrikeKind, label: string) =>
        `<label class="checkbox"><input type="checkbox" name="${kind}" ${ticked[kind] ? "checked" : ""}> ${label}</label>`;
    return `
        <p>Overwrites this NPC's numbers with the road map; core statistics it does not list become moderate.</p>
        <div class="form-group"><label>Road map</label><select name="roadMap">${groups.join("")}</select></div>
        <div class="form-group">${checkbox("melee", "Add melee Strike")}${checkbox("ranged", "Add ranged Strike")}</div>`;
}
