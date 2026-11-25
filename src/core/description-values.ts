import {
    damageAverage,
    formatFormula,
    parseFormula,
    rebuildAreaDamage,
    weaponDice,
    type StrikeDamage,
} from "./damage";
import { rescale } from "./scale";
import { AREA_DAMAGE, SPELL_DC } from "./tables";

/**
 * DCs and damage written into an ability's description as fixed numbers, rescaled with a level
 * change like the stats. Values that follow the actor (resolve(...), @actor…), flat checks,
 * recharge rolls and durations do not depend on level and are left alone.
 */
export interface DescriptionRescale {
    readonly text: string;
    /** What changed, as "DC 25 → 28" or "6d6 → 8d6", for a human to check. */
    readonly rescaled: readonly string[];
    /** Level-dependent values left as they were, for a human to do. */
    readonly unscaled: readonly string[];
}

/**
 * DCs are rated on Spell DC, the table GM Core gives for creatures' ability DCs, and damage on
 * Area Damage's nearer column, the closest table to most damaging abilities: both are guesses
 * from the value alone. Plain text is only rewritten where the value appears once, since a
 * second mention may be about something else. `kept` formulas are kept up to date elsewhere.
 */
export function rescaleDescription(
    description: string,
    fromLevel: number,
    toLevel: number,
    kept: readonly string[],
): DescriptionRescale {
    const found: Found = { rescaled: [], unscaled: [] };
    const levels = { fromLevel, toLevel };
    const counts = plainTokenCounts(description);
    const text = description.replaceAll(TOKEN, (token: string, ...rest: unknown[]) => {
        const groups = rest.at(-1) as Groups;
        return rescaleToken(token, groups, { levels, counts, kept, found });
    });
    return { text, rescaled: unique(found.rescaled), unscaled: unique(found.unscaled) };
}

interface Found {
    readonly rescaled: string[];
    readonly unscaled: string[];
}

interface Context {
    readonly levels: Levels;
    readonly counts: ReadonlyMap<string, number>;
    readonly kept: readonly string[];
    readonly found: Found;
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
    if (plainFlat !== undefined) context.found.unscaled.push(`${plainFlat} damage`);
    return token;
}

function rescaleCheck(token: string, body: string, { levels, found }: Context): string {
    const dc = /\|dc:\s*(\d+)\s*(?=\||$)/.exec(body);
    if (body.startsWith("flat|") || dc === null) return token;
    const from = Number(dc[1]);
    const to = rescaleDc(from, levels);
    if (to === undefined) {
        found.unscaled.push(`DC ${from} (too far below the table to move)`);
        return token;
    }
    if (to !== from) found.rescaled.push(`DC ${from} → ${to}`);
    return token.replace(dc[0], dc[0].replace(String(from), String(to)));
}

function rescaleDamageRoll(token: string, body: string, { levels, found }: Context): string {
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
        if (categories.some((category) => /persistent|precision|splash/.test(category ?? ""))) {
            found.unscaled.push(label);
            return partial;
        }
        const to = rescaleDamage(formula, levels);
        if (to === undefined) {
            found.unscaled.push(label);
            return partial;
        }
        if (to !== formula) found.rescaled.push(`${formula} → ${to}`);
        // pf2e needs brackets round a formula with a modifier before its category, and only then.
        const written = /[+-]/.test(to) ? `(${to})` : to;
        return partial.includes(`(${raw})`)
            ? partial.replace(`(${raw})`, written)
            : partial.replace(raw, written);
    });
    return `@Damage[${[rewritten.join(","), ...options].join("|")}]`;
}

function rescaleInlineRoll(token: string, body: string, { levels, found }: Context): string {
    if (/recharge/i.test(body) || followsActor(body)) return token;
    const [formulaText = "", ...label] = body.split("#");
    const formula = compact(formulaText.replaceAll(/\[[^\]]*\]|[()]/g, ""));
    if (!/\d+d\d+/.test(formula)) return token;
    const to = rescaleDamage(formula, levels);
    if (to === undefined) {
        found.unscaled.push(formula);
        return token;
    }
    if (to !== formula) found.rescaled.push(`${formula} → ${to}`);
    const command = /^\[\[\/(\w+)/.exec(token)?.[1] ?? "r";
    const suffix = label.length > 0 ? ` #${label.join("#")}` : "";
    return `[[/${command} ${to}${suffix}]]`;
}

function rescalePlainDc(token: string, dc: string, { levels, counts, found }: Context): string {
    if (counts.get(`DC ${dc}`) !== 1) {
        found.unscaled.push(`DC ${dc} (mentioned more than once)`);
        return token;
    }
    const to = rescaleDc(Number(dc), levels);
    if (to === undefined) {
        found.unscaled.push(`DC ${dc} (too far below the table to move)`);
        return token;
    }
    if (to !== Number(dc)) found.rescaled.push(`DC ${dc} → ${to}`);
    return token.replace(dc, String(to));
}

/** Precision dice follow the precision rules; persistent and splash are left to a human. */
function rescaleSideDice(
    token: string,
    dice: string,
    category: string,
    { found }: Context,
): string {
    if (!/precision/.test(category)) found.unscaled.push(`${compact(dice)}${category}`);
    return token;
}

function rescalePlainDice(token: string, dice: string, context: Context): string {
    const { levels, counts, kept, found } = context;
    const formula = compact(dice);
    if (kept.includes(formula)) return token;
    if (counts.get(formula) !== 1) {
        found.unscaled.push(`${formula} (mentioned more than once)`);
        return token;
    }
    const to = rescaleDamage(formula, levels);
    if (to === undefined) {
        found.unscaled.push(formula);
        return token;
    }
    if (to !== formula) found.rescaled.push(`${formula} → ${to}`);
    return token.replace(dice, to);
}

/** A rescaled DC below 1 means the value was far off the table, so it is left for a human. */
function rescaleDc(dc: number, { fromLevel, toLevel }: Levels): number | undefined {
    const to = rescale(SPELL_DC, fromLevel, toLevel, dc) ?? dc;
    return to >= 1 ? to : undefined;
}

/** Weapon dice the strike rules can rebuild; anything else (1d3, 2d18, flat numbers) is left. */
function rescaleDamage(formula: string, { fromLevel, toLevel }: Levels): string | undefined {
    const parsed = parseFormula(formula);
    const dice = parsed?.dice === undefined ? undefined : weaponDice(parsed.dice);
    if (parsed === undefined || dice === undefined) return undefined;
    const damage: StrikeDamage = {
        main: { key: "main", dice, flat: parsed.flat },
        extras: [],
        sides: [],
    };
    const target = rescale(AREA_DAMAGE, fromLevel, toLevel, damageAverage(damage));
    const rebuilt =
        target === undefined ? undefined : rebuildAreaDamage(damage, target, fromLevel, toLevel);
    return rebuilt?.[0]?.formula ?? formatFormula(parsed);
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
