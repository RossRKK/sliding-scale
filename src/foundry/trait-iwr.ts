import { addEvent, type StoredNotes } from "../core/notes";
import { traitIwrToAdd, type AddedIwr } from "../core/trait-iwr";
import type { ActiveBuild } from "./npc";

/** The IWR arrays to write and the notes to store; nothing when there is nothing to add. */
export interface TraitIwrChanges {
    readonly actor: Readonly<Record<string, readonly unknown[]>>;
    readonly notes: StoredNotes;
}

const PATHS = {
    immunities: "system.attributes.immunities",
    weaknesses: "system.attributes.weaknesses",
    resistances: "system.attributes.resistances",
} as const;

/** Appends the trait IWR the NPC lacks; its own entries are kept exactly as they are. */
export function planTraitIwr(source: object, build: ActiveBuild): TraitIwrChanges | undefined {
    const current = {
        immunities: entriesAt(source, PATHS.immunities),
        weaknesses: entriesAt(source, PATHS.weaknesses),
        resistances: entriesAt(source, PATHS.resistances),
    };
    const added = traitIwrToAdd(traitsOf(source), build.level, {
        immunities: current.immunities.flatMap(typeOf),
        weaknesses: current.weaknesses.flatMap(typeOf),
        resistances: current.resistances.flatMap(typeOf),
    });
    if (added.required.length + added.optional.length === 0) return undefined;
    return {
        actor: {
            [PATHS.immunities]: [...current.immunities, ...added.immunities],
            [PATHS.weaknesses]: [...current.weaknesses, ...added.weaknesses],
            [PATHS.resistances]: [...current.resistances, ...added.resistances],
        },
        notes: notesAfter(build.notes, added),
    };
}

function notesAfter(notes: StoredNotes, added: AddedIwr): StoredNotes {
    const required =
        added.required.length === 0
            ? notes
            : addEvent(notes, { kind: "iwrAdded", types: added.required });
    return added.optional.length === 0
        ? required
        : addEvent(required, { kind: "optionalIwrAdded", types: added.optional });
}

/** pf2e stores null for an NPC with none of a kind. */
function entriesAt(source: object, path: string): unknown[] {
    let node: unknown = source;
    for (const key of path.split(".")) {
        node =
            typeof node === "object" && node !== null
                ? (node as Record<string, unknown>)[key]
                : undefined;
    }
    return Array.isArray(node) ? node : [];
}

function typeOf(entry: unknown): string[] {
    const type =
        typeof entry === "object" && entry !== null
            ? (entry as { type?: unknown }).type
            : undefined;
    return typeof type === "string" ? [type] : [];
}

function traitsOf(source: object): string[] {
    const traits = entriesAt(source, "system.traits.value");
    return traits.filter((trait): trait is string => typeof trait === "string");
}
