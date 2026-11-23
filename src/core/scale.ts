import { ADJECTIVES, type Adjective } from "./adjective";
import type { ScaleTable } from "./tables";

/** Where a stat sits on its table: the nearest column and how far it is from it. */
export interface Rating {
    readonly adjective: Adjective;
    readonly offset: number;
}

export function derive(table: ScaleTable, level: number, value: number): Rating | undefined {
    const columns = table.get(level);
    if (columns === undefined) return undefined;
    let best: Rating | undefined;
    for (const adjective of ADJECTIVES) {
        const column = columns[adjective];
        if (column === undefined) continue;
        const offset = value - column;
        if (best === undefined || Math.abs(offset) < Math.abs(best.offset))
            best = { adjective, offset };
    }
    return best;
}

/** The stat keeps its adjective and offset across the level change. */
export function rescale(
    table: ScaleTable,
    from: number,
    to: number,
    value: number,
): number | undefined {
    const rating = derive(table, from, value);
    if (rating === undefined) return undefined;
    const column = columnValue(table, to, rating.adjective);
    return column === undefined ? undefined : column + rating.offset;
}

export function columnValue(
    table: ScaleTable,
    level: number,
    adjective: Adjective,
): number | undefined {
    return table.get(level)?.[adjective];
}

export function adjectivesAt(table: ScaleTable, level: number): Adjective[] {
    const columns = table.get(level);
    return columns === undefined ? [] : ADJECTIVES.filter((adjective) => adjective in columns);
}
