import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { MODULE_ID, readNpc, type ActiveBuild, type NpcSource } from "./npc";
import { readStoredNotes } from "./stored-notes";
import { warningsOf } from "./warnings";

describe("readStoredNotes", () => {
    it("reads events and acknowledgements from the module flag", () => {
        const flags = {
            enabled: true,
            notes: {
                events: [{ kind: "levelShift", from: 3, to: 12 }],
                acknowledged: ["key"],
            },
        };
        expect(readStoredNotes(flags)).toEqual({
            events: [{ kind: "levelShift", from: 3, to: 12 }],
            acknowledged: ["key"],
        });
    });

    it("drops entries it cannot read instead of guessing", () => {
        const flags = {
            notes: {
                events: [{ kind: "levelShift", from: "3" }, { kind: "future" }, null],
                acknowledged: [7],
            },
        };
        expect(readStoredNotes(flags)).toEqual({ events: [], acknowledged: [] });
    });

    it("reads an NPC without notes as having none", () => {
        expect(activeNpc(npcSource()).notes).toEqual({ events: [], acknowledged: [] });
    });
});

describe("warningsOf", () => {
    it("warns about a strike whose dice are under a quarter of its damage", () => {
        const source = withStrike("1d4+20");
        expect(warningsOf(source, activeNpc(source))).toContainEqual({
            kind: "lowDiceShare",
            itemId: "strike1",
            itemName: "Claw",
            formula: "1d4+20",
        });
    });

    it("warns about an ability whose description no longer names its precision dice", () => {
        const source = npcSource();
        const items = source.items.map((item) =>
            item._id === "sneak1"
                ? {
                      ...item,
                      name: "Sneak Attack",
                      system: { ...item.system, description: { value: "Extra damage." } },
                  }
                : item,
        );
        const stale = { ...source, items };
        expect(warningsOf(stale, activeNpc(stale))).toEqual([
            {
                kind: "staleDescription",
                itemId: "sneak1",
                itemName: "Sneak Attack",
                formulas: ["1d6"],
            },
        ]);
    });

    it("has nothing to say about the fixture NPC", () => {
        expect(warningsOf(npcSource(), activeNpc(npcSource()))).toEqual([]);
    });
});

function withStrike(damage: string): NpcSource {
    const source = npcSource();
    const items = source.items.map((item) =>
        item._id === "strike1"
            ? {
                  ...item,
                  name: "Claw",
                  system: {
                      bonus: { value: 12 },
                      damageRolls: { main: { damage, damageType: "slashing", category: null } },
                  },
              }
            : item,
    );
    return { ...source, items, flags: { [MODULE_ID]: { enabled: true } } };
}

function activeNpc(source: NpcSource): ActiveBuild {
    const build = readNpc(source);
    if (build.state === "disabled") throw new Error("fixture NPC is disabled");
    return build;
}
