import { describe, expect, it } from "vitest";
import { ADJECTIVES } from "./adjective";
import {
    damageAverage,
    damageDiceAt,
    diceShare,
    formatFormula,
    parseFormula,
    rebuildAreaDamage,
    rebuildDamage,
    weaponDice,
    type SideCategory,
    type StrikeDamage,
} from "./damage";
import { derive, rescale } from "./scale";
import { AREA_DAMAGE, areaDamageFormulas, STRIKE_DAMAGE, strikeDamageFormulas } from "./tables";

const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);

describe("strike damage table", () => {
    it.each(LEVELS)("uses one dice count for every column at level %i", (level) => {
        const formulas = Object.values(strikeDamageFormulas(level) ?? {});
        const counts = new Set(formulas.map((formula) => parseFormula(formula)?.dice?.count));
        expect(formulas).toHaveLength(4);
        expect([...counts]).toEqual([damageDiceAt(level)]);
    });

    it("has dice counts in bands of 1, 2, 3 and 4", () => {
        const bandOf = (level: number) => (level <= 3 ? 1 : level <= 11 ? 2 : level <= 18 ? 3 : 4);
        expect(LEVELS.map(damageDiceAt)).toEqual(LEVELS.map(bandOf));
    });

    // The book rounds these .5 averages up but most others down; the listed average is what we use.
    const ROUNDED_UP = ["-1 moderate", "2 extreme", "3 extreme", "3 high", "18 high"];

    it("lists the floored average of each example formula, apart from the cells the book rounded up", () => {
        const mismatches = LEVELS.flatMap((level) =>
            ADJECTIVES.flatMap((adjective) => {
                const formula = strikeDamageFormulas(level)?.[adjective];
                if (formula === undefined) return [];
                const listed = STRIKE_DAMAGE.get(level)?.[adjective];
                const damage = mainOnly(formula);
                return damageAverage(damage) === listed ? [] : [`${level} ${adjective}`];
            }),
        );
        expect(mismatches).toEqual(ROUNDED_UP);
    });
});

describe("area damage table", () => {
    // Off by more than rounding either way; the listed average is what we use.
    const OFF_THE_DICE = [
        "5 unlimited",
        "7 unlimited",
        "10 unlimited",
        "17 unlimited",
        "18 unlimited",
    ];

    it("lists each example's average to within rounding, apart from cells whose dice roll something else", () => {
        const mismatches = LEVELS.flatMap((level) =>
            (["limited", "unlimited"] as const).flatMap((column) => {
                const formula = areaDamageFormulas(level)?.[column];
                if (formula === undefined) return [`${level} ${column} missing`];
                const { dice } = parseFormula(formula)!;
                const exact = (dice!.count * (dice!.size + 1)) / 2;
                const listed = AREA_DAMAGE.get(level)?.[column] ?? NaN;
                return Math.abs(listed - exact) <= 0.5 ? [] : [`${level} ${column}`];
            }),
        );
        expect(mismatches).toEqual(OFF_THE_DICE);
    });

    it("writes every example as dice alone", () => {
        const flats = LEVELS.flatMap((level) =>
            Object.values(areaDamageFormulas(level) ?? {}).map(
                (formula) => parseFormula(formula)?.flat,
            ),
        );
        expect(new Set(flats)).toEqual(new Set([0]));
    });
});

describe("parseFormula", () => {
    it.each([
        ["1d8+4", { dice: { count: 1, size: 8 }, flat: 4 }],
        ["2d6 + 10", { dice: { count: 2, size: 6 }, flat: 10 }],
        ["1d4–1", { dice: { count: 1, size: 4 }, flat: -1 }],
        ["3d6+12+2", { dice: { count: 3, size: 6 }, flat: 14 }],
        ["1d6", { dice: { count: 1, size: 6 }, flat: 0 }],
        ["5", { dice: undefined, flat: 5 }],
    ])("reads %s", (text, formula) => {
        expect(parseFormula(text)).toEqual(formula);
    });

    it.each(["", "bludgeoning", "1d6+1d4", "2*1d6"])("rejects %j", (text) => {
        expect(parseFormula(text)).toBeUndefined();
    });

    it.each(["2d8+8", "1d4", "1d4-1", "7"])("formats %s back unchanged", (text) => {
        expect(formatFormula(parseFormula(text)!)).toBe(text);
    });
});

describe("rescaling strike damage", () => {
    it("turns a moderate 1d8+6 at level 3 into 2d8+8 at level 7", () => {
        const damage = mainOnly("1d8+6");
        expect(derive(STRIKE_DAMAGE, 3, damageAverage(damage))).toEqual({
            adjective: "moderate",
            offset: 0,
        });
        const target = rescale(STRIKE_DAMAGE, 3, 7, damageAverage(damage))!;
        expect(rebuildDamage(damage, target, 3, 7)).toEqual([{ key: "main", formula: "2d8+8" }]);
    });

    it("counts extra typed partials towards the average and leaves them alone", () => {
        // 1d6+2 plus 1d6 fire averages 9 at level 3: one under high.
        const damage = { ...mainOnly("1d6+2"), extras: [parseFormula("1d6")!] };
        expect(damageAverage(damage)).toBe(9);
        // Level 7 high is 20, less one: 19 = floor(2d6 (7) + 1d6 fire (3.5) + 9).
        expect(rebuildDamage(damage, 19, 3, 7)).toEqual([{ key: "main", formula: "2d6+9" }]);
    });

    it("moves a creature's own dice count by the table's change in dice count", () => {
        // 1d8+3 at level 5 (band 2) moved to level 12 (band 3) keeps one die fewer than the band.
        expect(rebuildDamage(mainOnly("1d8+3"), 22, 5, 12)).toEqual([
            { key: "main", formula: "2d8+13" },
        ]);
    });

    it("drops dice rather than give the flat a negative modifier", () => {
        // Level 1 low is 4; 2d6 alone averages 7, 1d6 fits with 1 to spare.
        expect(rebuildDamage(mainOnly("2d6+2"), 4, 1, 1)).toEqual([
            { key: "main", formula: "1d6+1" },
        ]);
    });

    it("keeps one die with no flat when even that overshoots the target", () => {
        expect(rebuildDamage(mainOnly("1d12+4"), 2, 2, -1)).toEqual([
            { key: "main", formula: "1d12" },
        ]);
    });

    it("has nothing to rebuild for a level off the table", () => {
        expect(rebuildDamage(mainOnly("1d8+6"), 10, 3, 25)).toBeUndefined();
    });
});

describe("rebuilding area damage", () => {
    it.each([
        ["keeps its own dice count for a column at the same level", "2d6", 6, 6, 9, "2d6+2"],
        // Level 6 unlimited is 14, four d6; limited is 25, seven d6.
        ["moves the count by the columns' dice in its own die", "2d6", 6, 6, 25, "5d6+8"],
        // Level 3 limited is 14, three d10; unlimited 9 is two, but two d10 overshoot it.
        ["drops dice that overshoot rather than go negative", "6d10", 3, 3, 9, "1d10+4"],
        ["keeps one die with no flat when even that overshoots", "3d12", 3, 3, 4, "1d12"],
    ])("%s", (_case, formula, fromLevel, toLevel, target, expected) => {
        expect(rebuildAreaDamage(mainOnly(formula), target, fromLevel, toLevel)).toEqual([
            { key: "main", formula: expected },
        ]);
    });

    it("round-trips Scavenger Slime's 2d12+10 plasma cannon between levels 9 and 12", () => {
        // Unlimited +5 at level 9 (18); level 12 unlimited is 23, so 28.
        const there = rebuildAreaDamage(mainOnly("2d12+10"), 28, 9, 12);
        expect(there).toEqual([{ key: "main", formula: "3d12+9" }]);
        expect(rebuildAreaDamage(mainOnly("3d12+9"), 23, 12, 9)).toEqual([
            { key: "main", formula: "2d12+10" },
        ]);
    });

    it("counts extra partials towards the target", () => {
        const damage = { ...mainOnly("2d6"), extras: [parseFormula("1d6")!] };
        expect(rebuildAreaDamage(damage, 12, 5, 5)).toEqual([{ key: "main", formula: "2d6+2" }]);
    });
});

describe("side partials", () => {
    const withSide = (category: SideCategory, formula: string): StrikeDamage => ({
        ...mainOnly("1d8+6"),
        sides: [{ key: "side", category, formula: parseFormula(formula)! }],
    });
    const sideAfter = (damage: StrikeDamage, fromLevel: number, toLevel: number) =>
        rebuildDamage(damage, 10, fromLevel, toLevel)?.find(({ key }) => key === "side")?.formula;

    it.each([
        ["precision dice follow sneak attack", "precision", "2d6", 9, 13, "3d6"],
        ["precision dice keep their die and flat", "precision", "1d8+1", 4, 5, "2d8+1"],
        ["precision dice move by sneak attack's step", "precision", "4d6", 5, 11, "5d6"],
        ["precision dice never drop below one", "precision", "1d6", 17, 1, undefined],
        ["flat precision is left alone", "precision", "2", 1, 20, undefined],
        ["flat splash follows bomb tiers", "splash", "3", 14, 20, "4"],
        ["flat splash moves by the bomb tier's step", "splash", "5", 2, 11, "7"],
        ["flat splash never drops below one", "splash", "1", 20, 1, undefined],
        ["splash dice follow bomb tiers", "splash", "1d4", 2, 11, "3d4"],
        ["persistent damage is never rescaled", "persistent", "1d6", 3, 20, undefined],
    ] as const)("%s", (_case, category, formula, fromLevel, toLevel, expected) => {
        expect(sideAfter(withSide(category, formula), fromLevel, toLevel)).toBe(expected);
    });

    it.each([
        ["precision", "3d6", 17, 5],
        ["splash", "2d6", 3, 17],
        ["splash", "4", 3, 17],
    ] as const)("round-trips %s %s from level %i through %i", (category, formula, home, away) => {
        const there = sideAfter(withSide(category, formula), home, away)!;
        expect(sideAfter(withSide(category, there), away, home)).toBe(formula);
    });

    it("leaves every side partial alone when the level does not change", () => {
        expect(sideAfter(withSide("splash", "3"), 14, 14)).toBeUndefined();
    });
});

describe("weaponDice", () => {
    it.each([4, 6, 8, 10, 12])("accepts a d%i", (size) => {
        expect(weaponDice({ count: 2, size })).toEqual({ count: 2, size });
    });

    it.each([3, 9, 18, 20])("rejects a d%i, which no Strike Damage row rolls", (size) => {
        expect(weaponDice({ count: 1, size })).toBeUndefined();
    });
});

describe("diceShare", () => {
    it("is the fraction of the main partial's average that comes from dice", () => {
        expect(diceShare(mainOnly("1d4+20").main)).toBeCloseTo(2.5 / 22.5);
        expect(diceShare(mainOnly("2d8+8").main)).toBeCloseTo(9 / 17);
    });
});

function mainOnly(formula: string): StrikeDamage {
    const { dice, flat } = parseFormula(formula)!;
    return { main: { key: "main", dice: weaponDice(dice!)!, flat }, extras: [], sides: [] };
}
