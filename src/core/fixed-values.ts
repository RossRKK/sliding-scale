/**
 * DCs and damage written into an ability's description as fixed numbers, which a level change
 * leaves at their old values. Values that follow the actor (resolve(...), @actor…) are not fixed;
 * neither are flat checks, recharge rolls or durations, which do not depend on level.
 */
export interface FixedValues {
    readonly dcs: readonly number[];
    readonly damage: readonly string[];
}

/**
 * Finds the fixed values in pf2e description HTML. `kept` are formulas something else keeps up to
 * date (the precision rewrite), so they are not reported.
 */
export function fixedValuesIn(description: string, kept: readonly string[]): FixedValues {
    const dcs = [...checkDcs(description), ...plainDcs(plainText(description))];
    const damage = [
        ...damageRollFormulas(description),
        ...inlineRollFormulas(description),
        ...plainDice(plainText(description)),
    ].filter((formula) => !kept.includes(formula));
    return { dcs: unique(dcs), damage: unique(damage) };
}

export function hasFixedValues({ dcs, damage }: FixedValues): boolean {
    return dcs.length + damage.length > 0;
}

/** "DC 25, 6d6" for a note. */
export function formatFixedValues({ dcs, damage }: FixedValues): string[] {
    return [...dcs.map((dc) => `DC ${dc}`), ...damage];
}

// @Check[reflex|dc:25|basic]; a flat check's DC is the condition's, not the creature's.
const CHECK = /@Check\[([^\]]*)\]/g;
// @Damage[(2d6+4)[fire],1d6[persistent,fire]|options:area-damage]
const DAMAGE = /@Damage\[((?:[^[\]]|\[[^\]]*\])*)\]/g;
// [[/r 2d6 #label]] and its /gmr, /br, /pr and /roll forms.
const INLINE_ROLL = /\[\[\/(?:r|roll|gmr|gmroll|br|blindroll|pr|publicroll)\s+([^\]]*)\]\]/g;
// Any enricher or inline roll, removed before reading plain text so its numbers are not read twice.
const ENRICHER = /@\w+\[(?:[^[\]]|\[[^\]]*\])*\](?:\{[^}]*\})?|\[\[[^\]]*\]\](?:\{[^}]*\})?/g;
const PLAIN_DC = /\bDC\s+(\d+)(?!\d|\s*flat)/g;
// Dice followed by a duration are how long something lasts, which does not follow level.
const PLAIN_DICE =
    /(?<![\w@.])(\d+d\d+(?:\s*[+-]\s*\d+)?)(?!\d|\s*(?:rounds?|minutes?|hours?|days?|weeks?|months?|years?)\b)/g;

function checkDcs(description: string): number[] {
    return [...description.matchAll(CHECK)].flatMap(([, body = ""]) => {
        const [type, ...options] = body.split("|");
        const dc = options
            .find((option) => option.startsWith("dc:"))
            ?.slice(3)
            .trim();
        return type !== "flat" && dc !== undefined && /^\d+$/.test(dc) ? [Number(dc)] : [];
    });
}

function damageRollFormulas(description: string): string[] {
    return [...description.matchAll(DAMAGE)].flatMap(([, body = ""]) => {
        const [partials = ""] = body.split("|");
        if (followsActor(partials)) return [];
        return partials.split(/,(?![^[]*\])/).flatMap((partial) => {
            const formula = partial.replace(/\[[^\]]*\]$/, "").replaceAll(/[()\s]/g, "");
            return formula === "" ? [] : [formula];
        });
    });
}

function inlineRollFormulas(description: string): string[] {
    return [...description.matchAll(INLINE_ROLL)].flatMap(([roll, body = ""]) => {
        if (/recharge/i.test(roll) || followsActor(body)) return [];
        const formula = body.split("#")[0]!.replaceAll(/\[[^\]]*\]|[()\s]/g, "");
        return /\d+d\d+/.test(formula) ? [formula] : [];
    });
}

function plainDcs(text: string): number[] {
    return [...text.matchAll(PLAIN_DC)].map(([, dc]) => Number(dc));
}

function plainDice(text: string): string[] {
    return [...text.matchAll(PLAIN_DICE)].map(([, formula = ""]) => formula.replaceAll(/\s/g, ""));
}

function followsActor(text: string): boolean {
    return /resolve\(|@/.test(text);
}

function plainText(description: string): string {
    return description.replaceAll(ENRICHER, " ").replaceAll(/<[^>]+>/g, " ");
}

function unique<T>(values: readonly T[]): T[] {
    return [...new Set(values)];
}
