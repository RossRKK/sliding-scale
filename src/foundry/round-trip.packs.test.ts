import { describe, expect, it } from "vitest";
import {
    areaDiceChange,
    damageAverage,
    damageDiceAt,
    formatFormula,
    parseFormula,
    type StrikeDamage,
} from "../core/damage";
import { rescaleDescription, type ValueRating } from "../core/description-values";
import { BOMB_TIER, progressionAt, SNEAK_ATTACK_DICE, type Band } from "../core/progressions";
import { adjectivesOf, columnValue, derive, rescale } from "../core/scale";
import { TABLE_OF } from "../core/stats";
import type { ScaleTable } from "../core/tables";
import { MODULE_ID, readNpc, type ActiveBuild, type NpcSource, type NpcStat } from "./npc";
import { PACKS_DIR, readPackNpcs } from "./pack-npcs";
import { planLevelChange } from "./updates";
import { withUpdate } from "./fixtures";

const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);

/** Why a number did not come back after a level change and its reverse. */
type Cause =
    | "column hopping"
    | "tie"
    | "1-die floor"
    | "one-die overshoot"
    | "dice clamp"
    | "HP current clamp"
    | "value collision"
    | "left on the way back"
    | "other";

const INHERENT: readonly Cause[] = [
    "column hopping",
    "tie",
    "1-die floor",
    "one-die overshoot",
    "dice clamp",
    "HP current clamp",
    // Two of a description's values become equal, so the reverse change cannot tell them apart.
    "value collision",
    // The first change moved a value outside the range the reverse change rescales.
    "left on the way back",
];

interface Outcome {
    readonly group: string;
    readonly near: boolean;
    readonly cause: Cause | undefined;
    readonly example: string;
}

describe.skipIf(PACKS_DIR === undefined)(
    "every pack NPC moved to every level and back",
    { timeout: 600_000 },
    () => {
        const outcomes = readPackNpcs().flatMap(({ source }) => roundTrips(enabled(source)));

        it("only loses numbers to causes inherent in rating without storing anything", () => {
            const other = outcomes.filter(({ cause }) => cause === "other");
            expect(other.slice(0, 20).map(({ example }) => example)).toEqual([]);
        });

        it("reports each scaled stat's round-trip losses by cause", () => {
            console.log(report(outcomes));
            expect(outcomes.length).toBeGreaterThan(0);
        });
    },
);

/** Every level change away and back for one NPC, one outcome per number it scales. */
function roundTrips(home: NpcSource): Outcome[] {
    const start = readNpc(home);
    if (start.state !== "active") return [];
    return LEVELS.filter((level) => level !== start.level).flatMap((level) => {
        const awaySource = withUpdate(home, planLevelChange(start, level, new Set()), level);
        const away = readNpc(awaySource);
        if (away.state !== "active") return [];
        const backSource = withUpdate(
            awaySource,
            planLevelChange(away, start.level, new Set()),
            start.level,
        );
        const back = readNpc(backSource);
        if (back.state !== "active") return [];
        const trip: Trip = { home, start, away, back, awaySource, backSource };
        const stats = statOutcomes(trip);
        const maxHitPoints = stats.find(({ group }) => group === "hitPoints");
        return [
            ...stats,
            hitPointOutcome(trip, maxHitPoints),
            ...sideOutcomes(trip),
            ...descriptionOutcomes(trip),
        ];
    });
}

interface Trip {
    readonly home: NpcSource;
    readonly start: ActiveBuild;
    readonly away: ActiveBuild;
    readonly back: ActiveBuild;
    readonly awaySource: NpcSource;
    readonly backSource: NpcSource;
}

function statOutcomes(trip: Trip): Outcome[] {
    return trip.start.stats.map((stat) => {
        const there = trip.away.stats.find(({ id }) => id === stat.id);
        const returned = trip.back.stats.find(({ id }) => id === stat.id);
        const restored = returned !== undefined && same(stat, returned);
        const cause = restored ? undefined : statCause(trip, stat, there, returned);
        return outcome(
            trip,
            stat.kind,
            cause,
            `${stat.id} ${shown(stat)} → ${shown(there)} → ${shown(returned)}`,
        );
    });
}

function statCause(
    trip: Trip,
    stat: NpcStat,
    there: NpcStat | undefined,
    returned: NpcStat | undefined,
): Cause {
    if (there === undefined || returned === undefined) return "other";
    const table = TABLE_OF[stat.kind];
    const damageCause =
        damageLegCause(stat, there, table, trip.start.level, trip.away.level) ??
        damageLegCause(there, returned, table, trip.away.level, trip.start.level);
    if (damageCause !== undefined) return damageCause;
    if (tied(table, trip.start.level, stat.value) || tied(table, trip.away.level, there.value)) {
        return "tie";
    }
    const before = derive(table, trip.start.level, stat.value);
    const after = derive(table, trip.away.level, there.value);
    return before?.adjective !== after?.adjective ? "column hopping" : "other";
}

/** Why one leg of a damage stat's trip could not hit its target with the dice it wanted. */
function damageLegCause(
    from: NpcStat,
    to: NpcStat,
    table: ScaleTable,
    fromLevel: number,
    toLevel: number,
): Cause | undefined {
    const before = damageOf(from);
    const after = damageOf(to);
    if (before === undefined || after === undefined) return undefined;
    const target = rescale(table, fromLevel, toLevel, from.value);
    if (target === undefined) return undefined;
    const change =
        from.kind === "areaDamage"
            ? areaDiceChange(before, target, fromLevel, toLevel)
            : (damageDiceAt(toLevel) ?? 0) - (damageDiceAt(fromLevel) ?? 0);
    const wanted = before.main.dice.count + (change ?? 0);
    const count = after.main.dice.count;
    if (count === 1 && after.main.flat === 0 && damageAverage(after) > target) {
        return "one-die overshoot";
    }
    if (wanted < 1) return "1-die floor";
    if (count < wanted) return "dice clamp";
    return undefined;
}

/**
 * Each DC and damage formula an ability's description rescales away, followed back. Values are
 * paired through the rescale's "from → to" list and classified as the stats they are rated like.
 */
function descriptionOutcomes(trip: Trip): Outcome[] {
    return trip.start.descriptions.flatMap(({ itemId, text }) => {
        const awayText = trip.away.descriptions.find((d) => d.itemId === itemId)?.text ?? text;
        const away = rescaleDescription(
            text,
            trip.start.level,
            trip.away.level,
            precisionOf(trip.start, itemId),
        );
        const back = rescaleDescription(
            awayText,
            trip.away.level,
            trip.start.level,
            precisionOf(trip.away, itemId),
        );
        // The reverse change reads the same tokens in the same order, except ones it now leaves.
        let next = 0;
        return away.values.flatMap(({ rating, from, to }) => {
            if (from === to) return [];
            const found = back.values.findIndex(
                (value, index) => index >= next && value.from === to && value.rating === rating,
            );
            if (found >= 0) next = found + 1;
            const end = found >= 0 ? back.values[found]!.to : to;
            const cause =
                end === from
                    ? undefined
                    : found < 0
                      ? leftCause(back.unscaled, to)
                      : valueCause(trip, rating, [from, to, end]);
            return [outcome(trip, GROUPS[rating], cause, `${itemId} ${from} → ${to} → ${end}`)];
        });
    });
}

/** Why the reverse change left a value the first one moved. */
function leftCause(unscaled: readonly string[], value: string): Cause {
    return unscaled.includes(`${value} left as is, mentioned more than once`)
        ? "value collision"
        : "left on the way back";
}

const GROUPS: Record<ValueRating, string> = {
    spellDC: "descriptionDC",
    rider: "descriptionRider",
};

function valueCause(
    trip: Trip,
    rating: ValueRating,
    [from, to, end]: readonly [string, string, string],
): Cause {
    // Riders step with sneak attack dice, so only the one-die floor loses them.
    if (rating === "rider") {
        const step =
            (progressionAt(SNEAK_ATTACK_DICE, trip.away.level) ?? 0) -
            (progressionAt(SNEAK_ATTACK_DICE, trip.start.level) ?? 0);
        const count = parseFormula(from)?.dice?.count ?? 0;
        return count + step < 1 ? "1-die floor" : "other";
    }
    return statCause(trip, dcStat(from), dcStat(to), dcStat(end));
}

/** A description DC as the Spell DC stat it is rated like. */
function dcStat(value: string): NpcStat {
    const dc = Number(value.slice(3));
    return { id: value, kind: "spellDC", value: dc, target: { kind: "areaDC", itemId: "" } };
}

function precisionOf(build: ActiveBuild, itemId: string): string[] {
    const ability = build.precisionAbilities.find((candidate) => candidate.itemId === itemId);
    return (ability?.dice ?? []).map(({ count, dieSize }) => `${count}${dieSize}`);
}

/** Current HP follows max HP, so a lost max explains a lost current. */
function hitPointOutcome(trip: Trip, maxHitPoints: Outcome | undefined): Outcome {
    const current = (source: NpcSource) => source.system.attributes.hp.value;
    const restored = current(trip.backSource) === current(trip.home);
    const maxCause = maxHitPoints?.cause;
    const cause = restored
        ? undefined
        : (maxCause ?? (current(trip.awaySource) === 0 ? "HP current clamp" : "other"));
    const example = `hp ${current(trip.home)} → ${current(trip.awaySource)} → ${current(trip.backSource)}`;
    return outcome(trip, "hitPointsCurrent", cause, example);
}

/** Precision and splash partials on strikes, and precision dice on abilities' rules. */
function sideOutcomes(trip: Trip): Outcome[] {
    const partials = trip.home.items.flatMap((item) => {
        const rolls = damageRolls(item.system);
        return Object.entries(rolls).flatMap(([key, partial]) => {
            if (partial.category !== "precision" && partial.category !== "splash") return [];
            const bands = partial.category === "precision" ? SNEAK_ATTACK_DICE : BOMB_TIER;
            const formula = (source: NpcSource) =>
                damageRolls(source.items.find(({ _id }) => _id === item._id)?.system ?? {})[key]
                    ?.damage;
            const count = (text: string | undefined) => {
                const parsed = text === undefined ? undefined : parseFormula(text);
                return parsed?.dice?.count ?? parsed?.flat;
            };
            return [
                sideOutcome(trip, `${partial.category}Partial`, bands, [
                    count(partial.damage),
                    count(formula(trip.awaySource)),
                    count(formula(trip.backSource)),
                ]),
            ];
        });
    });
    const abilities = trip.start.precisionAbilities.flatMap((ability) =>
        ability.dice.map(({ ruleIndex, count }) => {
            const ruleCount = (source: NpcSource) => {
                const item = source.items.find(({ _id }) => _id === ability.itemId);
                const rules = (item?.system as { rules?: unknown[] } | undefined)?.rules;
                return (rules?.[ruleIndex] as { diceNumber?: unknown } | undefined)?.diceNumber;
            };
            return sideOutcome(trip, "precisionAbility", SNEAK_ATTACK_DICE, [
                count,
                numberOrUndefined(ruleCount(trip.awaySource)),
                numberOrUndefined(ruleCount(trip.backSource)),
            ]);
        }),
    );
    return [...partials, ...abilities];
}

function sideOutcome(
    trip: Trip,
    group: string,
    bands: readonly Band[],
    [home, there, returned]: (number | undefined)[],
): Outcome {
    const step =
        (progressionAt(bands, trip.away.level) ?? 0) -
        (progressionAt(bands, trip.start.level) ?? 0);
    const cause =
        home === returned
            ? undefined
            : home !== undefined && home + step < 1
              ? "1-die floor"
              : "other";
    return outcome(trip, group, cause, `${group} ${home} → ${there} → ${returned}`);
}

function outcome(trip: Trip, group: string, cause: Cause | undefined, detail: string): Outcome {
    const near = Math.abs(trip.away.level - trip.start.level) <= 2;
    const example = `${nameOf(trip.home)} L${trip.start.level}→${trip.away.level}: ${detail}`;
    return { group, near, cause, example };
}

/** Two columns equally near: derivation breaks the tie upwards, so the rating is a guess. */
function tied(table: ScaleTable, level: number, value: number): boolean {
    const distances = adjectivesOf(table).flatMap((adjective) => {
        const column = columnValue(table, level, adjective);
        return column === undefined ? [] : [Math.abs(value - column)];
    });
    const nearest = Math.min(...distances);
    return distances.filter((distance) => distance === nearest).length > 1;
}

function same(stat: NpcStat, returned: NpcStat): boolean {
    const before = damageOf(stat);
    const after = damageOf(returned);
    if (before !== undefined && after !== undefined)
        return mainFormula(before) === mainFormula(after);
    return stat.value === returned.value;
}

function damageOf({ target }: NpcStat): StrikeDamage | undefined {
    return target.kind === "strikeDamage" || target.kind === "areaDamage"
        ? target.damage
        : undefined;
}

function mainFormula({ main }: StrikeDamage): string {
    return formatFormula({ dice: main.dice, flat: main.flat });
}

function shown(stat: NpcStat | undefined): string {
    if (stat === undefined) return "unread";
    const damage = damageOf(stat);
    return damage === undefined ? String(stat.value) : mainFormula(damage);
}

function damageRolls(
    system: object,
): Record<string, { damage?: string; category?: string | null }> {
    return ("damageRolls" in system ? system.damageRolls : {}) as Record<
        string,
        { damage?: string; category?: string | null }
    >;
}

/** Rule elements may store a count as a numeric string, as the precision ability reader allows. */
function numberOrUndefined(value: unknown): number | undefined {
    const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    return typeof number === "number" ? number : undefined;
}

function nameOf(source: NpcSource): string {
    return (source as { name?: string }).name ?? "?";
}

/** Pack NPCs carry no Sliding Scale flag, and a few have fields pf2e's data model fixes on load. */
function enabled(source: object): NpcSource {
    const npc = source as NpcSource & { system: Record<string, unknown> };
    const { adjustment, hp } = npc.system.attributes;
    const attributes = {
        ...npc.system.attributes,
        hp: { value: Number(hp.value), max: Number(hp.max) },
        adjustment: adjustment === "elite" || adjustment === "weak" ? adjustment : null,
    };
    return {
        ...npc,
        system: {
            ...npc.system,
            attributes,
            skills: npc.system.skills ?? {},
            saves: npc.system.saves ?? {},
        },
        flags: { ...npc.flags, [MODULE_ID]: { enabled: true } },
        items: npc.items ?? [],
    } as NpcSource;
}

function report(outcomes: readonly Outcome[]): string {
    const groups = [...new Set(outcomes.map(({ group }) => group))].toSorted();
    const causes = [...INHERENT, "other" as const];
    const rate = (lost: number, total: number) =>
        total === 0 ? "-" : `${((100 * lost) / total).toFixed(1)}%`;
    const rows = groups.map((group) => {
        const all = outcomes.filter((outcome) => outcome.group === group);
        const near = all.filter((outcome) => outcome.near);
        const lost = all.filter(({ cause }) => cause !== undefined);
        const lostNear = near.filter(({ cause }) => cause !== undefined);
        // Each cause as a share of all trips, then of trips of at most two levels.
        const byCause = causes.map((cause) => {
            const lostTo = (trips: readonly Outcome[]) => trips.filter((o) => o.cause === cause);
            return `${rate(lostTo(all).length, all.length)} / ${rate(lostTo(near).length, near.length)}`;
        });
        return [
            group,
            all.length,
            rate(lost.length, all.length),
            rate(lostNear.length, near.length),
            ...byCause,
        ].join(" | ");
    });
    const header = `stat | trips | lost | lost ±2 | ${causes.map((cause) => `${cause} (all / ±2)`).join(" | ")}`;
    return [header, ...rows].join("\n");
}
