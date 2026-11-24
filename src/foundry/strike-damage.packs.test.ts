/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { damageAverage, damageDiceAt, rebuildDamage, WEAPON_DIE_SIZES } from "../core/damage";
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
            const holds = ({ strike, reread }: Rebuild) =>
                reread !== undefined &&
                reread.main.dice.size === strike.damage.main.dice.size &&
                WEAPON_DIE_SIZES.includes(reread.main.dice.size);
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        it("rolls the level band's dice count", () => {
            const holds = ({ reread, toLevel }: Rebuild) =>
                reread !== undefined && reread.main.dice.count === damageDiceAt(toLevel);
            expect(violations(rebuilds, holds)).toEqual([]);
        });

        it("averages exactly the target", () => {
            const holds = ({ reread, target }: Rebuild) =>
                reread !== undefined && damageAverage(reread) === target;
            expect(violations(rebuilds, holds)).toEqual([]);
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
    readonly toLevel: number;
    readonly target: number;
    readonly formula: string;
    /** The rebuilt strike read back the way the sheet reads it; undefined if it no longer reads. */
    readonly reread: StrikeDamage | undefined;
}

/** A level change carrying the strike's rating, then each adjective picked at the new level. */
function rebuildsOf(strike: PackStrike): Rebuild[] {
    const { level, damage } = strike;
    return LEVELS.flatMap((toLevel) => {
        const carried = rescale(STRIKE_DAMAGE, level, toLevel, damageAverage(damage));
        const picked = adjectivesAt(STRIKE_DAMAGE, toLevel).map((adjective) => ({
            fromLevel: toLevel,
            target: columnValue(STRIKE_DAMAGE, toLevel, adjective),
        }));
        return [{ fromLevel: level, target: carried }, ...picked].flatMap(
            ({ fromLevel, target }) => {
                if (target === undefined) return [];
                const changes = rebuildDamage(damage, target, fromLevel, toLevel) ?? [];
                const formula = changes.find(({ key }) => key === damage.main.key)?.formula ?? "";
                return [
                    {
                        strike,
                        toLevel,
                        target,
                        formula,
                        reread: reread(strike.item, damage, formula),
                    },
                ];
            },
        );
    });
}

function reread(item: PackItem, damage: StrikeDamage, formula: string): StrikeDamage | undefined {
    const rolls = item.system.damageRolls;
    const main = rolls[damage.main.key];
    const system = { damageRolls: { ...rolls, [damage.main.key]: { ...main, damage: formula } } };
    const [stat] = strikeDamageStat(item._id, system, (read) => read);
    return stat?.target;
}

function violations(rebuilds: readonly Rebuild[], holds: (rebuild: Rebuild) => boolean): string[] {
    return rebuilds
        .filter((rebuild) => !holds(rebuild))
        .slice(0, 20)
        .map(({ strike, toLevel, target, formula }) => {
            return `${strike.name} L${strike.level}→${toLevel} target ${target}: ${formula}`;
        });
}

function packStrikes(dir: string): PackStrike[] {
    const system = dir.split("/").at(-1) ?? dir;
    return jsonFiles(dir).flatMap((file) => {
        const npc = JSON.parse(readFileSync(file, "utf8")) as PackNpc;
        if (npc.type !== "npc") return [];
        const level = npc.system.details.level.value;
        return (npc.items ?? [])
            .filter((item) => item.type === "melee")
            .flatMap((item) =>
                strikeDamageStat(item._id, item.system, (damage) => damage).map(({ target }) => ({
                    system,
                    name: `${npc.name}: ${item.name}`,
                    level,
                    item,
                    damage: target,
                })),
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
    readonly system: { readonly damageRolls: Readonly<Record<string, object>> };
}

function jsonFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => join(entry.parentPath, entry.name));
}
