import { describe, expect, it } from "vitest";
import {
    acknowledge,
    addEvent,
    afterLevelChange,
    NO_STORED_NOTES,
    noteKey,
    noteText,
    visibleNotes,
    withDescriptionNote,
    type EventNote,
    type WarningNote,
} from "./notes";

const lowDice = (formula: string): WarningNote => ({
    kind: "lowDiceShare",
    itemId: "jaws",
    itemName: "Jaws",
    formula,
});
const skipped: EventNote = { kind: "roadMapSkipped", roadMap: "Skirmisher", entries: ["Speed"] };

describe("visibleNotes", () => {
    it("shows stored events and current warnings, events first", () => {
        const stored = { events: [skipped], acknowledged: [] };
        expect(visibleNotes(stored, [lowDice("1d4+20")])).toEqual([skipped, lowDice("1d4+20")]);
    });
});

describe("acknowledge", () => {
    it("removes an acknowledged event outright", () => {
        const stored = acknowledge({ events: [skipped], acknowledged: [] }, [], skipped);
        expect(stored).toEqual(NO_STORED_NOTES);
    });

    it("hides a warning while what it fired on is unchanged", () => {
        const warnings = [lowDice("1d4+20")];
        const stored = acknowledge(NO_STORED_NOTES, warnings, lowDice("1d4+20"));
        expect(visibleNotes(stored, warnings)).toEqual([]);
    });

    it("shows the warning again once its cause changes", () => {
        const stored = acknowledge(NO_STORED_NOTES, [lowDice("1d4+20")], lowDice("1d4+20"));
        expect(visibleNotes(stored, [lowDice("1d4+24")])).toEqual([lowDice("1d4+24")]);
    });

    it("keeps a warning hidden when only its item's name changes", () => {
        const stored = acknowledge(NO_STORED_NOTES, [lowDice("1d4+20")], lowDice("1d4+20"));
        const renamed = { ...lowDice("1d4+20"), itemName: "Bite" };
        expect(visibleNotes(stored, [renamed])).toEqual([]);
    });

    it("drops acknowledgements of warnings that no longer fire on the next write", () => {
        const old = acknowledge(NO_STORED_NOTES, [lowDice("1d4+20")], lowDice("1d4+20"));
        const stored = acknowledge(old, [lowDice("1d4+24")], lowDice("1d4+24"));
        expect(stored.acknowledged).toEqual([noteKey(lowDice("1d4+24"))]);
    });
});

describe("afterLevelChange", () => {
    it("notes a change of more than two levels", () => {
        expect(afterLevelChange(NO_STORED_NOTES, 3, 12).events).toEqual([
            { kind: "levelShift", from: 3, to: 12 },
        ]);
    });

    it("notes nothing for two levels or fewer", () => {
        expect(afterLevelChange(NO_STORED_NOTES, 3, 5).events).toEqual([]);
    });

    it("measures later changes from the level the open note started at", () => {
        const first = afterLevelChange(NO_STORED_NOTES, 3, 12);
        expect(afterLevelChange(first, 12, 14).events).toEqual([
            { kind: "levelShift", from: 3, to: 14 },
        ]);
        expect(afterLevelChange(first, 12, 4).events).toEqual([]);
    });

    it("keeps other events", () => {
        const stored = { events: [skipped], acknowledged: [] };
        expect(afterLevelChange(stored, 1, 20).events).toEqual([
            skipped,
            { kind: "levelShift", from: 1, to: 20 },
        ]);
    });
});

describe("withDescriptionNote", () => {
    const values = (rescaled: string[]) => [{ item: "Breath Weapon", rescaled, unscaled: [] }];

    it("replaces the last level change's description note", () => {
        const first = withDescriptionNote(NO_STORED_NOTES, values(["DC 20 → 26"]));
        expect(withDescriptionNote(first, values(["DC 26 → 30"])).events).toEqual([
            { kind: "descriptionsRescaled", items: values(["DC 26 → 30"]) },
        ]);
    });

    it("adds nothing when no description changed", () => {
        expect(withDescriptionNote(NO_STORED_NOTES, []).events).toEqual([]);
    });
});

describe("addEvent", () => {
    it("does not repeat an identical event", () => {
        expect(addEvent(addEvent(NO_STORED_NOTES, skipped), skipped).events).toEqual([skipped]);
    });
});

describe("noteText", () => {
    it.each([
        [
            { kind: "levelShift", from: 3, to: 12 },
            "Level changed 3 → 12: values far from the original may drift; compare with the compendium",
        ],
        [skipped, "Skirmisher road map: not applied, do by hand: Speed"],
        [
            { kind: "unassignedSkills", count: 2 },
            `2 "Unassigned Skill" lore skills added: rename to the skills you want`,
        ],
        [
            {
                kind: "descriptionsRescaled",
                items: [
                    { item: "Breath Weapon", rescaled: ["DC 25 → 28"], unscaled: [] },
                    {
                        item: "Venom",
                        rescaled: [],
                        unscaled: ["1d6 left as is, below the Area Damage table"],
                    },
                ],
            },
            "Description numbers rescaled, check them: Breath Weapon: DC 25 → 28. Description numbers Sliding Scale couldn't rescale: Venom: 1d6 left as is, below the Area Damage table",
        ],
        [
            lowDice("1d4+20"),
            "Jaws (1d4+20): dice are under a quarter of its damage; consider a bigger weapon die",
        ],
    ] as const)("renders %j", (note, text) => {
        expect(noteText(note)).toBe(text);
    });
});
