import { NO_STORED_NOTES, type EventNote, type StoredNotes } from "../core/notes";

export const NOTES_FLAG = "notes";

/** Parses the notes flag; an entry this version cannot read is dropped rather than shown wrong. */
export function readStoredNotes(flags: unknown): StoredNotes {
    const stored = field(flags, NOTES_FLAG);
    if (typeof stored !== "object" || stored === null) return NO_STORED_NOTES;
    const events = arrayOf(field(stored, "events")).flatMap(readEvent);
    const acknowledged = arrayOf(field(stored, "acknowledged")).filter(
        (key): key is string => typeof key === "string",
    );
    return { events, acknowledged };
}

function readEvent(value: unknown): EventNote[] {
    const kind = field(value, "kind");
    switch (kind) {
        case "levelShift": {
            const from = field(value, "from");
            const to = field(value, "to");
            return typeof from === "number" && typeof to === "number" ? [{ kind, from, to }] : [];
        }
        case "iwrAdded":
        case "optionalIwrAdded": {
            const types = strings(field(value, "types"));
            return types === undefined ? [] : [{ kind, types }];
        }
        case "roadMapSkipped": {
            const roadMap = field(value, "roadMap");
            const entries = strings(field(value, "entries"));
            return typeof roadMap === "string" && entries !== undefined
                ? [{ kind, roadMap, entries }]
                : [];
        }
        case "unassignedSkills": {
            const count = field(value, "count");
            return typeof count === "number" ? [{ kind, count }] : [];
        }
        default:
            return [];
    }
}

function field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[key]
        : undefined;
}

function arrayOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] | undefined {
    const items = arrayOf(value);
    return Array.isArray(value) && items.every((item) => typeof item === "string")
        ? (items as string[])
        : undefined;
}
