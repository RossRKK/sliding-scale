import { describe, expect, it } from "vitest";
import { fixedValuesIn, formatFixedValues } from "./fixed-values";

describe("fixedValuesIn", () => {
    it.each([
        [
            "a basic save with breath damage",
            `<p>The dragon breathes a cone of fire that deals @Damage[(6d6+2)[fire]|options:area-damage] damage (@Check[reflex|dc:25|basic|options:area-effect]).</p>`,
            { dcs: [25], damage: ["6d6+2"] },
        ],
        [
            "persistent damage alongside the main partial",
            `<p>@Damage[8d6[acid],1d6[persistent,acid]|options:area-damage] (@Check[reflex|dc:33|basic])</p>`,
            { dcs: [33], damage: ["8d6", "1d6"] },
        ],
        [
            "flat damage",
            `<p>The target takes @Damage[5[bleed]] damage.</p>`,
            { dcs: [], damage: ["5"] },
        ],
        [
            "an inline roll",
            `<p>It regains [[/r 2d8+10 #Healing]] Hit Points.</p>`,
            { dcs: [], damage: ["2d8+10"] },
        ],
        [
            "plain-text DC and damage",
            `<p>A creature that fails a DC 25 Fortitude save takes 2d6 fire damage.</p>`,
            { dcs: [25], damage: ["2d6"] },
        ],
        [
            "a plain-text counteract DC",
            `<p>It attempts to counteract the effect (counteract modifier +18, DC 28).</p>`,
            { dcs: [28], damage: [] },
        ],
        [
            "the same value twice, reported once",
            `<p>@Check[will|dc:30] … on a failure, @Check[will|dc:30] again.</p>`,
            { dcs: [30], damage: [] },
        ],
    ])("reports %s", (_case, html, expected) => {
        expect(fixedValuesIn(html, [])).toEqual(expected);
    });

    it.each([
        [
            "a resolved DC",
            `<p>@Check[fortitude|dc:resolve(@actor.system.attributes.classDC.value)]</p>`,
        ],
        ["a DC from the actor", `<p>@Check[will|dc:@actor.attributes.spellDC.value]</p>`],
        ["damage from the actor", `<p>@Damage[(@actor.level)d6[fire]] damage</p>`],
        ["resolved damage", `<p>@Damage[(floor(@actor.level/2))d8[void]]</p>`],
        ["a resolved inline roll", `<p>[[/r (@actor.level)d4 #Healing]]</p>`],
        ["a flat check", `<p>@Check[flat|dc:15] to act.</p>`],
        ["a plain-text flat check", `<p>It must succeed at a DC 5 flat check.</p>`],
        [
            "a recharge roll",
            `<p>It can't breathe again for [[/gmr 1d4 #Recharge Breath Weapon]] rounds.</p>`,
        ],
        ["a duration in dice", `<p>The target is slowed for 1d4 rounds, or 1d12 hours.</p>`],
        ["a link label", `<p>See @UUID[Compendium.pf2e.conditions.Item.abc]{Frightened 2}.</p>`],
        ["no numbers", `<p>The creature Grabs its target.</p>`],
    ])("leaves %s alone", (_case, html) => {
        expect(fixedValuesIn(html, [])).toEqual({ dcs: [], damage: [] });
    });

    it("leaves the formulas the precision rewrite keeps up to date", () => {
        const html = `<p>The ailuran deals 1d6 extra precision damage to off-guard creatures.</p>`;
        expect(fixedValuesIn(html, ["1d6"])).toEqual({ dcs: [], damage: [] });
    });

    it("does not read part of a longer number", () => {
        expect(fixedValuesIn(`<p>DC 15 and 11d6</p>`, ["1d6"])).toEqual({
            dcs: [15],
            damage: ["11d6"],
        });
    });
});

describe("formatFixedValues", () => {
    it("lists DCs first, then damage", () => {
        expect(formatFixedValues({ dcs: [25], damage: ["6d6"] })).toEqual(["DC 25", "6d6"]);
    });
});
