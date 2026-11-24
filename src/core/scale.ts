import { ADJECTIVES, type Adjective } from "./adjective";
import type { ScaleTable } from "./tables";

/** Where a stat sits on its table: the nearest column and how far it is from it. */
export interface Rating {
    readonly adjective: Adjective;
    readonly offset: number;
}

export function derive(table: ScaleTable, level: number, value: number): Rating | undefined {
    let best: Rating | undefined;
    for (const adjective of adjectivesOf(table)) {
        const column = columnValue(table, level, adjective);
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

/**
 * A column a level lacks (no extreme attribute below level 1, no row past 24) is read at the
 * nearest level that has it, so a stat moved through such a level comes back unchanged.
 */
export function columnValue(
    table: ScaleTable,
    level: number,
    adjective: Adjective,
): number | undefined {
    let nearest: { readonly distance: number; readonly value: number } | undefined;
    for (const [rowLevel, columns] of table) {
        const value = columns[adjective];
        const distance = Math.abs(rowLevel - level);
        if (value !== undefined && (nearest === undefined || distance < nearest.distance)) {
            nearest = { distance, value };
        }
    }
    return nearest?.value;
}

/** Every column the table has at some level, highest first. */
export function adjectivesOf(table: ScaleTable): Adjective[] {
    return ADJECTIVES.filter((adjective) =>
        [...table.values()].some((columns) => adjective in columns),
    );
}
