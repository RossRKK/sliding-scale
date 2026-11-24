/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    damageAverage,
    damageDiceAt,
    formatFormula,
    rebuildDamage,
    WEAPON_DIE_SIZES,
} from "../core/damage";
import type { StrikeDamage } from "../core/damage";
import { adjectivesAt, columnValue, rescale } from "../core/scale";
import { STRIKE_DAMAGE } from "../core/tables";
import { strikeDamageStat } from "./strike-damage";

// The packs directory of a https://github.com/foundryvtt/pf2e clone; too big to vendor here.
const PACKS_DIR = process.env.PF2E_PACKS_DIR;
const SYSTEMS = ["pf2e", "sf2e"];
const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);

describe.skipIf(PACKS_DIR === undefined)(
    "every pack strike rebuilt at every level and adjective",
    { timeout: 60_000 },
    () => {
        // skipIf still collects this body, so it must not read the packs when there are none.
        const strikes =
            PACKS_DIR === undefined
                ? []
                : SYSTEMS.flatMap((system) => packStrikes(join(PACKS_DIR, system)));
        const rebuilds = strikes.flatMap(rebuildsOf);

        it("reads strikes from both systems' packs", () => {
            expect(new Set(strikes.map(({ system }) => system))).toEqual(new Set(SYSTEMS));
        });

        it("keeps the creature's own die size, which is a weapon die", () => {
            const holds = ({ from, reread }: Rebuild) =>
                reread !== undefined &&
                reread.main.dice.size === from.main.dice.size &&
                WEAPON_DIE_SIZES.includes(reread.main.dice.size);
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        it("never writes a negative flat modifier", () => {
            const holds = ({ reread }: Rebuild) => reread !== undefined && reread.main.flat >= 0;
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        it("moves the dice count with the band, dropping only dice that overshoot the target", () => {
            const holds = (rebuild: Rebuild) => {
                const count = rebuild.reread?.main.dice.count;
                if (count === undefined) return false;
                const wanted = Math.max(1, wantedCount(rebuild));
                const fits = (n: number) => diceOnlyAverage(rebuild, n) <= rebuild.target;
                return count === 1 || fits(count)
                    ? count === wanted || (count < wanted && !fits(count + 1))
                    : false;
            };
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        it("averages exactly the target unless a single die already overshoots it", () => {
            const holds = (rebuild: Rebuild) =>
                rebuild.reread !== undefined &&
                (damageAverage(rebuild.reread) === rebuild.target || overshoots(rebuild));
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        // The rating can land nearer another column at the far level; that is the tables, not the rebuild.
        it("restores the original formula after a level round trip that never clamped", () => {
            const broken = rebuilds.flatMap((away) => {
                if (away.kind !== "levelChange" || away.reread === undefined) return [];
                const back = rebuildAt(away.strike, away.reread, away.toLevel, away.strike.level);
                const original = formatMain(away.strike.damage);
                if (back === undefined || clamped(away) || clamped(back)) return [];
                if (back.target !== damageAverage(away.strike.damage)) return [];
                return back.formula === original ? [] : [`${label(away)} → back ${back.formula}`];
            });
            expect(broken.slice(0, 20)).toEqual([]);
        });
    },
);

interface PackStrike {
    readonly system: string;
    readonly name: string;
    readonly level: number;
    readonly item: PackItem;
    readonly damage: StrikeDamage;
}

interface Rebuild {
    readonly strike: PackStrike;
    readonly kind: "levelChange" | "adjective";
    /** The damage rebuilt from: the pack's for a level change, the rescaled one for an adjective. */
    readonly from: StrikeDamage;
    readonly fromLevel: number;
    readonly toLevel: number;
    readonly target: number;
    readonly formula: string;
    /** The rebuilt strike read back the way the sheet reads it; undefined if it no longer reads. */
    readonly reread: StrikeDamage | undefined;
}

/** A level change carrying the strike's rating, then each adjective picked at the new level. */
function rebuildsOf(strike: PackStrike): Rebuild[] {
    return LEVELS.flatMap((toLevel) => {
        const moved = rebuildAt(strike, strike.damage, strike.level, toLevel);
        if (moved?.reread === undefined) return [];
        const moveTo = moved.reread;
        const picked = adjectivesAt(STRIKE_DAMAGE, toLevel).flatMap((adjective) => {
            const target = columnValue(STRIKE_DAMAGE, toLevel, adjective);
            const rebuild =
                target === undefined
                    ? undefined
                    : rebuildFor(strike, moveTo, toLevel, toLevel, target);
            return rebuild === undefined ? [] : [{ ...rebuild, kind: "adjective" as const }];
        });
        return [moved, ...picked];
    });
}

/** A level change, keeping the damage's rating. */
function rebuildAt(
    strike: PackStrike,
    from: StrikeDamage,
    fromLevel: number,
    toLevel: number,
): Rebuild | undefined {
    const target = rescale(STRIKE_DAMAGE, fromLevel, toLevel, damageAverage(from));
    return target === undefined ? undefined : rebuildFor(strike, from, fromLevel, toLevel, target);
}

function rebuildFor(
    strike: PackStrike,
    from: StrikeDamage,
    fromLevel: number,
    toLevel: number,
    target: number,
): Rebuild | undefined {
    const changes = rebuildDamage(from, target, fromLevel, toLevel);
    const formula = changes?.find(({ key }) => key === from.main.key)?.formula;
    if (formula === undefined) return undefined;
    const reread = rereadWith(strike.item, from, formula);
    return { strike, kind: "levelChange", from, fromLevel, toLevel, target, formula, reread };
}

function wantedCount({ from, fromLevel, toLevel }: Rebuild): number {
    return from.main.dice.count + (damageDiceAt(toLevel) ?? 0) - (damageDiceAt(fromLevel) ?? 0);
}

function diceOnlyAverage({ from }: Rebuild, count: number): number {
    return damageAverage({
        ...from,
        main: { ...from.main, dice: { ...from.main.dice, count }, flat: 0 },
    });
}

function overshoots(rebuild: Rebuild): boolean {
    const main = rebuild.reread?.main;
    return (
        main?.dice.count === 1 && main.flat === 0 && diceOnlyAverage(rebuild, 1) > rebuild.target
    );
}

function clamped(rebuild: Rebuild): boolean {
    return rebuild.reread?.main.dice.count !== wantedCount(rebuild) || overshoots(rebuild);
}

function formatMain({ main }: StrikeDamage): string {
    return formatFormula({ dice: main.dice, flat: main.flat });
}

function label(rebuild: Rebuild): string {
    const { strike, fromLevel, toLevel, target, formula } = rebuild;
    return `${strike.name} ${formatMain(rebuild.from)} L${fromLevel}→${toLevel} target ${target}: ${formula}`;
}

function rereadWith(
    item: PackItem,
    damage: StrikeDamage,
    formula: string,
): StrikeDamage | undefined {
    const rolls = item.system.damageRolls;
    const main = rolls[damage.main.key];
    const system = { damageRolls: { ...rolls, [damage.main.key]: { ...main, damage: formula } } };
    const [stat] = strikeDamageStat("strikeDamage", item._id, system, (read) => read);
    return stat?.target;
}

function violations(rebuilds: readonly Rebuild[], holds: (rebuild: Rebuild) => boolean): string[] {
    return rebuilds
        .filter((rebuild) => !holds(rebuild))
        .slice(0, 20)
        .map(label);
}

function packStrikes(dir: string): PackStrike[] {
    const system = dir.split("/").at(-1) ?? dir;
    return jsonFiles(dir).flatMap((file) => {
        const npc = JSON.parse(readFileSync(file, "utf8")) as PackNpc;
        if (npc.type !== "npc") return [];
        const level = npc.system.details.level.value;
        return (npc.items ?? [])
            .filter(
                (item) => item.type === "melee" && (item.system.action ?? "strike") === "strike",
            )
            .flatMap((item) =>
                strikeDamageStat("strikeDamage", item._id, item.system, (damage) => damage).map(
                    ({ target }) => ({
                        system,
                        name: `${npc.name}: ${item.name}`,
                        level,
                        item,
                        damage: target,
                    }),
                ),
            );
    });
}

interface PackNpc {
    readonly type: string;
    readonly name: string;
    readonly system: { readonly details: { readonly level: { readonly value: number } } };
    readonly items?: readonly PackItem[];
}

interface PackItem {
    readonly _id: string;
    readonly name: string;
    readonly type: string;
    readonly system: {
        readonly action?: string;
        readonly damageRolls: Readonly<Record<string, object>>;
    };
}

function jsonFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => join(entry.parentPath, entry.name));
}
