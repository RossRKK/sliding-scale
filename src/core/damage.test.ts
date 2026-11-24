import { describe, expect, it } from "vitest";
import { ADJECTIVES } from "./adjective";
import {
    damageAverage,
    damageDiceAt,
    diceShare,
    formatFormula,
    parseFormula,
    rebuildDamage,
    weaponDice,
    type SideCategory,
    type StrikeDamage,
} from "./damage";
import { derive, rescale } from "./scale";
import { STRIKE_DAMAGE, strikeDamageFormulas } from "./tables";

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

    it("has nothing to rebuild for a level off the table", () => {
        expect(rebuildDamage(mainOnly("1d8+6"), 10, 3, 25)).toBeUndefined();
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
        ["precision dice round half up", "precision", "3d6", 11, 5, "2d6"],
        ["precision dice never drop below one", "precision", "1d6", 17, 1, undefined],
        ["flat precision is left alone", "precision", "2", 1, 20, undefined],
        ["flat splash follows bomb tiers", "splash", "3", 14, 20, "4"],
        ["flat splash rounds half up", "splash", "1", 2, 3, "2"],
        ["flat splash never drops below one", "splash", "1", 20, 1, undefined],
        ["splash dice follow bomb tiers", "splash", "1d4", 2, 11, "3d4"],
        ["persistent damage is never rescaled", "persistent", "1d6", 3, 20, undefined],
    ] as const)("%s", (_case, category, formula, fromLevel, toLevel, expected) => {
        expect(sideAfter(withSide(category, formula), fromLevel, toLevel)).toBe(expected);
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
