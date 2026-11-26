import { describe, expect, it } from "vitest";
import { changeLabels, rescaleDescription, type DescriptionRescale } from "./description-values";

/** The rescale with its changes as the note shows them. */
function summarise({ text, values, unscaled }: DescriptionRescale) {
    return { text, rescaled: changeLabels(values), unscaled };
}

const NOT_A_RIDER = "damage other than a Strike rider isn't rescaled";

// Level 10 to 15: Spell DC moderate 26 → 33, sneak attack dice 2 → 3.
describe("rescaleDescription", () => {
    it.each([
        [
            "a basic save, leaving its damage to a human",
            `<p>Fire deals @Damage[(6d6+2)[fire]|options:area-damage] damage (@Check[reflex|dc:25|basic]).</p>`,
            `<p>Fire deals @Damage[(6d6+2)[fire]|options:area-damage] damage (@Check[reflex|dc:32|basic]).</p>`,
            ["DC 25 → 32"],
            [`6d6+2 fire left as is, ${NOT_A_RIDER}`],
        ],
        [
            "a plain-text DC mentioned once",
            `<p>A creature that fails a DC 25 Fortitude save takes 6d6 fire damage.</p>`,
            `<p>A creature that fails a DC 32 Fortitude save takes 6d6 fire damage.</p>`,
            ["DC 25 → 32"],
            [`6d6 left as is, ${NOT_A_RIDER}`],
        ],
        [
            "an enriched rider, keeping the brackets its modifier needs",
            `<p>Its Strikes deal an additional @Damage[(2d6+2)[fire]] damage.</p>`,
            `<p>Its Strikes deal an additional @Damage[(3d6+2)[fire]] damage.</p>`,
            ["2d6+2 → 3d6+2"],
            [],
        ],
    ])("rescales %s", (_case, html, text, rescaled, unscaled) => {
        expect(summarise(rescaleDescription(html, 10, 15, []))).toEqual({
            text,
            rescaled,
            unscaled,
        });
    });

    it.each([
        [
            "damage that is not a rider",
            `<p>@Damage[8d6[acid],1d6[persistent,acid]] or [[/r 3d8+10 #Healing]]</p>`,
            [
                `8d6 acid left as is, ${NOT_A_RIDER}`,
                "1d6 persistent,acid left as is, persistent damage",
                `3d8+10 left as is, ${NOT_A_RIDER}`,
            ],
        ],
        [
            "plain-text values mentioned twice",
            `<p>DC 25 Will, or DC 25 Fortitude; 2d6 extra damage now or 2d6 extra damage later.</p>`,
            [
                "DC 25 left as is, mentioned more than once",
                "2d6 left as is, mentioned more than once",
            ],
        ],
        [
            "flat damage",
            `<p>The target takes @Damage[5[bleed]] damage.</p>`,
            ["5 bleed left as is, not dice"],
        ],
        [
            "plain-text flat damage",
            `<p>It deals 5 fire damage.</p>`,
            ["5 damage left as is, not dice"],
        ],
        [
            "plain-text persistent damage",
            `<p>It takes 1d6 persistent fire damage.</p>`,
            ["1d6 left as is, persistent damage"],
        ],
    ])("leaves %s for a human", (_case, html, unscaled) => {
        expect(summarise(rescaleDescription(html, 10, 15, []))).toEqual({
            text: html,
            rescaled: [],
            unscaled,
        });
    });

    it.each([
        [
            "a resolved DC",
            `<p>@Check[fortitude|dc:resolve(@actor.system.attributes.classDC.value)]</p>`,
        ],
        ["a DC from the actor", `<p>@Check[will|dc:@actor.attributes.spellDC.value]</p>`],
        ["damage from the actor", `<p>@Damage[(@actor.level)d6[fire]] damage</p>`],
        ["a resolved inline roll", `<p>[[/r (@actor.level)d4 #Healing]]</p>`],
        ["a flat check", `<p>@Check[flat|dc:15] to act.</p>`],
        ["a plain-text flat check", `<p>It must succeed at a DC 5 flat check.</p>`],
        ["a flat check's DC later in the sentence", `<p>This flat check increases to DC 10.</p>`],
        ["precision dice without a rule", `<p>It deals an additional 1d6 precision damage.</p>`],
        [
            "a recharge roll",
            `<p>It can't breathe again for [[/gmr 1d4 #Recharge Breath Weapon]] rounds.</p>`,
        ],
        ["a duration in dice", `<p>The target is slowed for 1d4 rounds, or 1d12 hours.</p>`],
        ["dice that are not damage", `<p>Roll 1d4 and consult the list below.</p>`],
        ["a link label", `<p>See @UUID[Compendium.pf2e.conditions.Item.abc]{Frightened 2}.</p>`],
        ["a number in markup", `<p class="dc-25" data-roll="2d6">Text.</p>`],
    ])("does not touch %s", (_case, html) => {
        expect(summarise(rescaleDescription(html, 10, 15, []))).toEqual({
            text: html,
            rescaled: [],
            unscaled: [],
        });
    });

    it.each([
        // Sneak attack dice: one at level 3, two at 5 to 10, three at 11.
        [
            "Pack Attack's extra damage",
            `<p>The hell hound's Strikes deal 1d4 extra damage.</p>`,
            3,
            8,
            "2d4",
        ],
        ["an additional rider", `<p>It deals an additional 1d6 fire damage.</p>`, 8, 11, "2d6"],
        ["a Strike rider", `<p>Its Strikes deal 1d6 fire damage while raging.</p>`, 11, 3, "1d6"],
        ["an enriched rider", `<p>Strikes deal @Damage[1d6[cold]] extra damage.</p>`, 4, 5, "2d6"],
    ] as const)("steps %s with sneak attack dice", (_case, html, from, to, formula) => {
        const { values } = rescaleDescription(html, from, to, []);
        expect(values.map(({ rating, to: written }) => [rating, written])).toEqual([
            ["rider", formula],
        ]);
    });

    it("leaves a DC for a human when the move would take it below 1", () => {
        // Level 20 moderate Spell DC is 39, so 13 is 26 below: level -1's moderate is 13.
        const html = `<p>@Check[will|dc:13]</p>`;
        expect(summarise(rescaleDescription(html, 20, -1, []))).toEqual({
            text: html,
            rescaled: [],
            unscaled: ["DC 13 left as is, too far below the Spell DC table to move"],
        });
    });

    it("leaves the formulas the precision rewrite keeps up to date", () => {
        const html = `<p>The ailuran deals 1d6 extra precision damage to off-guard creatures.</p>`;
        expect(rescaleDescription(html, 10, 15, ["1d6"]).text).toBe(html);
    });

    it("comes back to the original text after the reverse level change", () => {
        const html = `<p>(@Check[reflex|dc:25|basic]); a DC 21 Will save; 1d6 extra damage.</p>`;
        const there = rescaleDescription(html, 10, 15, []).text;
        expect(rescaleDescription(there, 15, 10, []).text).toBe(html);
    });

    it("changes nothing when the level does not", () => {
        const html = `<p>1d6 extra damage (@Check[reflex|dc:25|basic])</p>`;
        expect(summarise(rescaleDescription(html, 10, 10, []))).toEqual({
            text: html,
            rescaled: [],
            unscaled: [],
        });
    });
});
