import { describe, expect, it } from "vitest";
import { npcSource } from "./fixtures";
import { MODULE_ID, readNpc, type NpcSource } from "./npc";
import {
    descriptionMayBeStale,
    readPrecisionAbilities,
    rescaleAbility,
} from "./precision-abilities";
import { planLevelChange } from "./updates";

const sneakAttack = (source: NpcSource = npcSource()) => readPrecisionAbilities(source.items)[0]!;

describe("precision abilities", () => {
    it("reads DamageDice precision rules on actions, ignoring flat precision modifiers", () => {
        expect(
            readPrecisionAbilities(npcSource().items).map(({ itemId, dice }) => ({ itemId, dice })),
        ).toEqual([{ itemId: "sneak1", dice: [{ ruleIndex: 0, count: 1, dieSize: "d6" }] }]);
    });

    it("grows the dice with sneak attack and rewrites the formula in the description", () => {
        const fields = rescaleAbility(sneakAttack(), 3, 5);
        expect(fields?.["system.description.value"]).toBe(
            "<p>Deals an extra 2d6 precision damage to off-guard creatures.</p>",
        );
        expect(fields?.["system.rules"]).toEqual([
            {
                key: "DamageDice",
                category: "precision",
                diceNumber: 2,
                dieSize: "d6",
                selector: "strike-damage",
            },
            {
                key: "FlatModifier",
                damageCategory: "precision",
                selector: "strike-damage",
                value: 2,
            },
        ]);
    });

    it("has nothing to write while the sneak attack dice stay the same", () => {
        expect(rescaleAbility(sneakAttack(), 3, 4)).toBeUndefined();
    });

    it("leaves an ambiguous description alone and flags it as possibly stale", () => {
        const ability = {
            ...sneakAttack(),
            description: "1d6 precision, or 1d6 more when flanking",
        };
        const fields = rescaleAbility(ability, 3, 5);
        expect(fields?.["system.description.value"]).toBe(ability.description);
        const rescaled = { ...ability, dice: [{ ruleIndex: 0, count: 2, dieSize: "d6" }] };
        expect(descriptionMayBeStale(rescaled)).toBe(true);
        expect(descriptionMayBeStale(sneakAttack())).toBe(false);
    });

    it("is rescaled as part of an NPC's level change", () => {
        const build = readNpc(npcSource());
        if (build.state === "disabled") throw new Error("fixture NPC is disabled");
        const items = planLevelChange(build, 5, new Set()).items;
        expect(items.find(({ itemId }) => itemId === "sneak1")?.fields).toHaveProperty(
            "system.rules",
        );
    });

    it("is not read for a disabled NPC", () => {
        const disabled = { ...npcSource(), flags: { [MODULE_ID]: { enabled: false } } };
        expect(readNpc(disabled)).toEqual({ state: "disabled" });
    });
});
