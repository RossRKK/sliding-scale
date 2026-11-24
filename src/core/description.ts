export interface FormulaRewrite {
    readonly from: string;
    readonly to: string;
}

/**
 * Rewrites each formula that appears exactly once in the text; anything ambiguous is left for a
 * human, since a second mention may be about something else.
 */
export function rewriteFormulas(text: string, rewrites: readonly FormulaRewrite[]): string {
    const placed = rewrites.flatMap((rewrite) => {
        const indices = occurrences(text, rewrite.from);
        return indices.length === 1 ? [{ ...rewrite, index: indices[0]! }] : [];
    });
    return placed
        .toSorted((a, b) => b.index - a.index)
        .reduce(
            (result, { from, to, index }) =>
                result.slice(0, index) + to + result.slice(index + from.length),
            text,
        );
}

export function mentionsFormula(text: string, formula: string): boolean {
    return occurrences(text, formula).length > 0;
}

/** Digit boundaries so "1d6" is not found inside "11d6" or "1d60". */
function occurrences(text: string, formula: string): number[] {
    const escaped = formula.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [...text.matchAll(new RegExp(`(?<!\\d)${escaped}(?!\\d)`, "g"))].map(
        ({ index }) => index,
    );
}
