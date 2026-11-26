/**
 * Things Sliding Scale could not do or wants a human to check. Events (a big level change, traits
 * applied) are stored; warnings are worked out from the stat block on every render. Either kind
 * stays until acknowledged, which records its key: the kind and the content it fired on.
 */
export type Note = EventNote | WarningNote;

export type EventNote =
    | { readonly kind: "levelShift"; readonly from: number; readonly to: number }
    | { readonly kind: "iwrAdded"; readonly types: readonly string[] }
    | { readonly kind: "optionalIwrAdded"; readonly types: readonly string[] }
    | {
          readonly kind: "roadMapSkipped";
          readonly roadMap: string;
          readonly entries: readonly string[];
      }
    | { readonly kind: "unassignedSkills"; readonly count: number }
    | { readonly kind: "descriptionsRescaled"; readonly items: readonly DescriptionValues[] };

/** One ability's description numbers after a level change. */
export interface DescriptionValues {
    readonly item: string;
    readonly rescaled: readonly string[];
    readonly unscaled: readonly string[];
}

export type WarningNote =
    | {
          readonly kind: "lowDiceShare";
          readonly itemId: string;
          readonly itemName: string;
          readonly formula: string;
      }
    | {
          readonly kind: "staleDescription";
          readonly itemId: string;
          readonly itemName: string;
          readonly formulas: readonly string[];
      };

/** What is kept on the NPC: events still to acknowledge, and keys of acknowledged warnings. */
export interface StoredNotes {
    readonly events: readonly EventNote[];
    readonly acknowledged: readonly string[];
}

export const NO_STORED_NOTES: StoredNotes = { events: [], acknowledged: [] };

/**
 * Beyond two levels a stat's number can rate on another column at the new level: in the pack
 * round trips column hopping is about 0% of attributes, skills and saves within two levels and
 * up to 13% (max HP) beyond, so that is when comparing with the original is worth suggesting.
 */
export const LEVEL_SHIFT_NOTE_ABOVE = 2;

/** The notes to show: unacknowledged events and warnings, events first. */
export function visibleNotes(stored: StoredNotes, warnings: readonly WarningNote[]): Note[] {
    const acknowledged = new Set(stored.acknowledged);
    return [...stored.events, ...warnings].filter((note) => !acknowledged.has(noteKey(note)));
}

/**
 * Records the acknowledgement, then drops what no longer has a cause: an acknowledged event is
 * gone, and so is the acknowledgement of a warning that no longer fires.
 */
export function acknowledge(
    stored: StoredNotes,
    warnings: readonly WarningNote[],
    note: Note,
): StoredNotes {
    const acknowledged = new Set([...stored.acknowledged, noteKey(note)]);
    const events = stored.events.filter((event) => !acknowledged.has(noteKey(event)));
    const live = new Set(warnings.map(noteKey));
    return { events, acknowledged: [...acknowledged].filter((key) => live.has(key)) };
}

/** Folds a level change into an open level shift note, which shows while the shift is large. */
export function afterLevelChange(stored: StoredNotes, from: number, to: number): StoredNotes {
    const open = stored.events.find((event) => event.kind === "levelShift");
    const origin = open?.kind === "levelShift" ? open.from : from;
    const others = stored.events.filter((event) => event.kind !== "levelShift");
    const shifted = Math.abs(to - origin) > LEVEL_SHIFT_NOTE_ABOVE;
    const shift: EventNote[] = shifted ? [{ kind: "levelShift", from: origin, to }] : [];
    return { ...stored, events: [...others, ...shift] };
}

/** Each level change's description note replaces the last, which described older numbers. */
export function withDescriptionNote(
    stored: StoredNotes,
    items: readonly DescriptionValues[],
): StoredNotes {
    const others = stored.events.filter(({ kind }) => kind !== "descriptionsRescaled");
    const note: EventNote[] = items.length > 0 ? [{ kind: "descriptionsRescaled", items }] : [];
    return { ...stored, events: [...others, ...note] };
}

export function addEvent(stored: StoredNotes, event: EventNote): StoredNotes {
    const key = noteKey(event);
    const others = stored.events.filter((existing) => noteKey(existing) !== key);
    return { ...stored, events: [...others, event] };
}

/**
 * A note's identity and the content it fired on, so a changed cause shows again once acknowledged.
 * Item names are only for display: renaming an item does not bring its warning back.
 */
export function noteKey(note: Note): string {
    const fields = Object.entries(note).filter(([field]) => field !== "itemName");
    return JSON.stringify(fields.toSorted(([a], [b]) => a.localeCompare(b)));
}

export function noteText(note: Note): string {
    switch (note.kind) {
        case "levelShift":
            return `Level changed ${note.from} → ${note.to}: values far from the original may drift; compare with the compendium`;
        case "iwrAdded":
            return `Added ${list(note.types)}: adjust HP to suit (the book allows up to 4× a weakness)`;
        case "optionalIwrAdded":
            return `Added ${list(note.types)}, which only some creatures of these traits have: double check`;
        case "roadMapSkipped":
            return `${note.roadMap} road map: not applied, do by hand: ${list(note.entries)}`;
        case "unassignedSkills":
            return `${note.count} "Unassigned Skill" lore ${note.count === 1 ? "skill" : "skills"} added: rename to the skills you want`;
        case "descriptionsRescaled":
            return descriptionText(note.items);
        case "lowDiceShare":
            return `${note.itemName} (${note.formula}): dice are under a quarter of its damage; consider a bigger weapon die`;
        case "staleDescription":
            return `${note.itemName}: the description may not match its precision dice (${list(note.formulas)}) any more`;
    }
}

function descriptionText(items: readonly DescriptionValues[]): string {
    const part = (label: string, pick: (item: DescriptionValues) => readonly string[]) => {
        const entries = items.filter((item) => pick(item).length > 0);
        if (entries.length === 0) return [];
        return [
            `${label} ${entries.map((item) => `${item.item}: ${list(pick(item))}`).join("; ")}`,
        ];
    };
    return [
        ...part("Description numbers rescaled, check them:", ({ rescaled }) => rescaled),
        ...part("Description numbers Sliding Scale couldn't rescale:", ({ unscaled }) => unscaled),
    ].join(". ");
}

function list(items: readonly string[]): string {
    return items.join(", ");
}
