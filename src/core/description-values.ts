import { formatFormula, parseFormula, scaleSidePartial } from "./damage";
import { rescale } from "./scale";
import { SPELL_DC } from "./tables";

/**
 * DCs and Strike riders written into an ability's description as fixed numbers, rescaled with a
 * level change like the stats; other damage is listed for a human. Values that follow the actor (resolve(...), @actor…), flat checks,
 * recharge rolls and durations do not depend on level and are left alone.
 */
export interface DescriptionRescale {
    readonly text: string;
    /** Every value rescaled, in the order it appears, whether or not the level change moved it. */
    readonly values: readonly ValueChange[];
    /** Level-dependent values left as they were, for a human to do. */
    readonly unscaled: readonly string[];
}

/** One value a level change moved, and the table it was rated on there. */
export interface ValueChange {
    readonly rating: ValueRating;
    readonly from: string;
    readonly to: string;
}

/** Riders, extra damage added to Strikes, scale with the creature like precision damage does. */
export type ValueRating = "spellDC" | "rider";

/** What a level change moved, once each, as "DC 25 → 28" or "6d6 → 8d6" for a human to check. */
export function changeLabels(values: readonly ValueChange[]): string[] {
    const moved = values.filter(({ from, to }) => from !== to);
    return [...new Set(moved.map(({ from, to }) => `${from} → ${to.replace(/^DC /, "")}`))];
}

/**
 * DCs are rated on Spell DC, the table GM Core gives for creatures' ability DCs, a guess from the
 * value alone. Plain text is only rewritten where the value appears once, since a
 * second mention may be about something else. `kept` formulas are kept up to date elsewhere.
 */
export function rescaleDescription(
    description: string,
    fromLevel: number,
    toLevel: number,
    kept: readonly string[],
): DescriptionRescale {
    const found: Found = { values: [], unscaled: [] };
    const levels = { fromLevel, toLevel };
    const counts = plainTokenCounts(description);
    const text = description.replaceAll(TOKEN, (token: string, ...rest: unknown[]) => {
        const groups = rest.at(-1) as Groups;
        const rider = isRider(description, rest.at(-3) as number, token.length);
        return rescaleToken(token, groups, { levels, counts, kept, found, rider });
    });
    return { text, values: found.values, unscaled: unique(found.unscaled) };
}

interface Found {
    readonly values: ValueChange[];
    readonly unscaled: string[];
}

interface Context {
    readonly levels: Levels;
    readonly counts: ReadonlyMap<string, number>;
    readonly kept: readonly string[];
    readonly found: Found;
    /** The token is extra damage added to the creature's Strikes. */
    readonly rider: boolean;
}

interface Levels {
    readonly fromLevel: number;
    readonly toLevel: number;
}

interface Groups {
    readonly check?: string;
    readonly damage?: string;
    readonly roll?: string;
    readonly plainDc?: string;
    readonly plainDice?: string;
    readonly plainCategory?: string;
    readonly plainFlat?: string;
}

const DURATION = String.raw`\s*(?:rounds?|minutes?|hours?|days?|weeks?|months?|years?)\b`;
const DICE = String.raw`\d+d\d+(?:\s*[+-]\s*\d+)?`;
// Plain dice are damage or healing only when the words say so: "rolling 1d4" picks from a list.
const DAMAGE_WORDS = String.raw`\s+(?:[a-z]+\s+){0,2}(?:damage|Hit Points|HP)\b`;
const ROLL_COMMANDS = "r|roll|gmr|gmroll|br|blindroll|pr|publicroll";

// One pass: tags and enrichers match first, so the plain-text alternatives see only prose.
const TOKEN = new RegExp(
    [
        String.raw`<[^>]+>`,
        String.raw`@Check\[(?<check>[^\]]*)\]`,
        String.raw`@Damage\[(?<damage>(?:[^[\]]|\[[^\]]*\])*)\]`,
        String.raw`\[\[\/(?:${ROLL_COMMANDS})\s+(?<roll>[^\]]*)\]\]`,
        String.raw`@\w+\[(?:[^[\]]|\[[^\]]*\])*\](?:\{[^}]*\})?|\[\[[^\]]*\]\](?:\{[^}]*\})?`,
        // A flat check's DC is the condition's, not the creature's, wherever "flat" sits in the sentence.
        String.raw`(?<!flat[^.<]*)\bDC\s+(?<plainDc>\d+)(?!\d|[^.<]*flat)`,
        String.raw`(?<![\w@.])(?<plainDice>${DICE})(?!\d|${DURATION})(?=${DAMAGE_WORDS})(?<plainCategory>\s+(?:extra\s+|additional\s+)?(?:precision|persistent|splash)\b)?`,
        String.raw`(?<![\w@.+-])(?<plainFlat>\d+)(?=\s+(?:[a-z]+\s+)?damage\b)`,
    ].join("|"),
    "g",
);

function rescaleToken(token: string, groups: Groups, context: Context): string {
    const { check, damage, roll, plainDc, plainDice, plainCategory, plainFlat } = groups;
    if (check !== undefined) return rescaleCheck(token, check, context);
    if (damage !== undefined) return rescaleDamageRoll(token, damage, context);
    if (roll !== undefined) return rescaleInlineRoll(token, roll, context);
    if (plainDc !== undefined) return rescalePlainDc(token, plainDc, context);
    if (plainDice !== undefined && plainCategory !== undefined) {
        return rescaleSideDice(token, plainDice, plainCategory, context);
    }
    if (plainDice !== undefined) return rescalePlainDice(token, plainDice, context);
    if (plainFlat !== undefined) {
        context.found.unscaled.push(leftAsIs(`${plainFlat} damage`, "not dice"));
    }
    return token;
}

function rescaleCheck(token: string, body: string, { levels, found }: Context): string {
    const dc = /\|dc:\s*(\d+)\s*(?=\||$)/.exec(body);
    if (body.startsWith("flat|") || dc === null) return token;
    const from = Number(dc[1]);
    const to = rescaleDc(from, levels);
    if (to === undefined) {
        found.unscaled.push(leftAsIs(`DC ${from}`, "too far below the Spell DC table to move"));
        return token;
    }
    found.values.push({ rating: "spellDC", from: `DC ${from}`, to: `DC ${to}` });
    return token.replace(dc[0], dc[0].replace(String(from), String(to)));
}

function rescaleDamageRoll(token: string, body: string, { levels, found, rider }: Context): string {
    const [partials = "", ...options] = body.split("|");
    if (followsActor(partials)) return token;
    const rewritten = partials.split(/,(?![^[]*\])/).map((partial) => {
        // pf2e nests categories: 2d6[fire], (2d6+4)[fire], (2d8[splash])[acid].
        const raw = /\d+(?:d\d+)?(?:\s*[+-]\s*\d+)*/.exec(partial)?.[0];
        if (raw === undefined) return partial;
        const formula = compact(raw);
        const categories = [...partial.matchAll(/\[([^\]]*)\]/g)].map(([, category]) => category);
        const label = [formula, ...categories].join(" ");
        // Persistent, precision and splash damage follow their own rules, not the ability's.
        const side = categories.join(" ").match(/persistent|precision|splash/)?.[0];
        if (side !== undefined) {
            found.unscaled.push(leftAsIs(label, `${side} damage`));
            return partial;
        }
        const change = rescaleDamage(formula, levels, rider);
        if ("reason" in change) {
            found.unscaled.push(leftAsIs(label, change.reason));
            return partial;
        }
        const { to } = change;
        found.values.push(change);
        // pf2e needs brackets round a formula with a modifier before its category, and only then.
        const written = /[+-]/.test(to) ? `(${to})` : to;
        return partial.includes(`(${raw})`)
            ? partial.replace(`(${raw})`, written)
            : partial.replace(raw, written);
    });
    return `@Damage[${[rewritten.join(","), ...options].join("|")}]`;
}

function rescaleInlineRoll(token: string, body: string, { levels, found, rider }: Context): string {
    if (/recharge/i.test(body) || followsActor(body)) return token;
    const [formulaText = "", ...label] = body.split("#");
    const formula = compact(formulaText.replaceAll(/\[[^\]]*\]|[()]/g, ""));
    if (!/\d+d\d+/.test(formula)) return token;
    const change = rescaleDamage(formula, levels, rider);
    if ("reason" in change) {
        found.unscaled.push(leftAsIs(formula, change.reason));
        return token;
    }
    const { to } = change;
    found.values.push(change);
    const command = /^\[\[\/(\w+)/.exec(token)?.[1] ?? "r";
    const suffix = label.length > 0 ? ` #${label.join("#")}` : "";
    return `[[/${command} ${to}${suffix}]]`;
}

function rescalePlainDc(token: string, dc: string, { levels, counts, found }: Context): string {
    if (counts.get(`DC ${dc}`) !== 1) {
        found.unscaled.push(leftAsIs(`DC ${dc}`, "mentioned more than once"));
        return token;
    }
    const to = rescaleDc(Number(dc), levels);
    if (to === undefined) {
        found.unscaled.push(leftAsIs(`DC ${dc}`, "too far below the Spell DC table to move"));
        return token;
    }
    found.values.push({ rating: "spellDC", from: `DC ${dc}`, to: `DC ${to}` });
    return token.replace(dc, String(to));
}

/** Precision dice follow the precision rules; persistent and splash are left to a human. */
function rescaleSideDice(
    token: string,
    dice: string,
    category: string,
    { found }: Context,
): string {
    const side = /persistent|splash/.exec(category)?.[0];
    if (side !== undefined) found.unscaled.push(leftAsIs(compact(dice), `${side} damage`));
    return token;
}

function rescalePlainDice(token: string, dice: string, context: Context): string {
    const { levels, counts, kept, found, rider } = context;
    const formula = compact(dice);
    if (kept.includes(formula)) return token;
    if (counts.get(formula) !== 1) {
        found.unscaled.push(leftAsIs(formula, "mentioned more than once"));
        return token;
    }
    const change = rescaleDamage(formula, levels, rider);
    if ("reason" in change) {
        found.unscaled.push(leftAsIs(formula, change.reason));
        return token;
    }
    found.values.push(change);
    return token.replace(dice, change.to);
}

/** A rescaled DC below 1 means the value was far off the table, so it is left for a human. */
function rescaleDc(dc: number, { fromLevel, toLevel }: Levels): number | undefined {
    const to = rescale(SPELL_DC, fromLevel, toLevel, dc) ?? dc;
    return to >= 1 ? to : undefined;
}

/**
 * Riders step with sneak attack dice, which the round trip shows holds. No table rebuilds other
 * description damage accurately enough (29% of it lost within two levels on Area Damage, even
 * inside the table's range), so it is left for a human.
 */
function rescaleDamage(
    formula: string,
    { fromLevel, toLevel }: Levels,
    rider: boolean,
): ValueChange | { readonly reason: string } {
    const parsed = parseFormula(formula);
    if (parsed?.dice === undefined) return { reason: "not dice" };
    if (!rider) return { reason: "damage other than a Strike rider isn't rescaled" };
    const scaled = scaleSidePartial("precision", parsed, fromLevel, toLevel);
    return { rating: "rider", from: formula, to: formatFormula(scaled) };
}

function leftAsIs(value: string, reason: string): string {
    return `${value} left as is, ${reason}`;
}

// "deal 1d4 extra damage", "an additional 1d6 fire damage", "its Strikes deal 1d6 fire damage".
const RIDER_BEFORE = /\b(?:extra|additional)\s*$|\bStrikes?\b[^.]*\bdeals?\b[^.]*$/i;
const RIDER_AFTER = /^\s*(?:[a-z]+\s+)?(?:extra|additional)\b/i;

/** Whether the words round a damage value say it is added to the creature's Strikes. */
function isRider(description: string, offset: number, length: number): boolean {
    const prose = (text: string) => text.replaceAll(/<[^>]+>/g, " ");
    const sentenceStart = Math.max(
        description.lastIndexOf(".", offset),
        description.lastIndexOf(">", offset),
    );
    const before = prose(description.slice(Math.max(0, sentenceStart + 1), offset));
    const after = prose(description.slice(offset + length, offset + length + 60));
    return RIDER_BEFORE.test(before) || RIDER_AFTER.test(after);
}

/** How often each plain-text DC and dice formula appears, so only single mentions are rewritten. */
function plainTokenCounts(description: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const match of description.matchAll(TOKEN)) {
        const { plainDc, plainDice } = (match.groups ?? {}) as Groups;
        const key =
            plainDc !== undefined
                ? `DC ${plainDc}`
                : plainDice !== undefined
                  ? compact(plainDice)
                  : undefined;
        if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function followsActor(text: string): boolean {
    return /resolve\(|@/.test(text);
}

function compact(formula: string): string {
    return formula.replaceAll(/\s/g, "");
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}
