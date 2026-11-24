import type { Adjective } from "./adjective";

/** The value each adjective column takes at each level. */
export type ScaleTable = ReadonlyMap<number, Columns>;
export type Columns = Readonly<Partial<Record<Adjective, number>>>;

/** A transcribed cell: a value, a range (either order), or the book's dash for "no such column". */
type Cell = number | readonly [number, number] | "—";
type Row = readonly [level: number, ...cells: Cell[]];
type DamageRow = readonly [
    level: number,
    ...cells: (readonly [formula: string, average: number])[],
];

const EXTREME_TO_LOW = ["extreme", "high", "moderate", "low"] as const;
const EXTREME_TO_TERRIBLE = ["extreme", "high", "moderate", "low", "terrible"] as const;
const LIMITED_TO_UNLIMITED = ["limited", "unlimited"] as const;

// GM Core "Attribute Modifier Scales" table, https://2e.aonsrd.com/rules/996-attribute-modifiers
export const ATTRIBUTE_MODIFIERS = scaleTable(EXTREME_TO_LOW, [
    [-1, "—", 3, 2, 0],
    [0, "—", 3, 2, 0],
    [1, 5, 4, 3, 1],
    [2, 5, 4, 3, 1],
    [3, 5, 4, 3, 1],
    [4, 6, 5, 3, 2],
    [5, 6, 5, 4, 2],
    [6, 7, 5, 4, 2],
    [7, 7, 6, 4, 2],
    [8, 7, 6, 4, 3],
    [9, 7, 6, 4, 3],
    [10, 8, 7, 5, 3],
    [11, 8, 7, 5, 3],
    [12, 8, 7, 5, 4],
    [13, 9, 8, 5, 4],
    [14, 9, 8, 5, 4],
    [15, 9, 8, 6, 4],
    [16, 10, 9, 6, 5],
    [17, 10, 9, 6, 5],
    [18, 10, 9, 6, 5],
    [19, 11, 10, 6, 5],
    [20, 11, 10, 7, 6],
    [21, 11, 10, 7, 6],
    [22, 12, 10, 8, 6],
    [23, 12, 10, 8, 6],
    [24, 13, 12, 9, 7],
]);

// GM Core "Perception" table, https://2e.aonsrd.com/rules/997-perception
export const PERCEPTION = scaleTable(EXTREME_TO_TERRIBLE, [
    [-1, 9, 8, 5, 2, 0],
    [0, 10, 9, 6, 3, 1],
    [1, 11, 10, 7, 4, 2],
    [2, 12, 11, 8, 5, 3],
    [3, 14, 12, 9, 6, 4],
    [4, 15, 14, 11, 8, 6],
    [5, 17, 15, 12, 9, 7],
    [6, 18, 17, 14, 11, 8],
    [7, 20, 18, 15, 12, 10],
    [8, 21, 19, 16, 13, 11],
    [9, 23, 21, 18, 15, 12],
    [10, 24, 22, 19, 16, 14],
    [11, 26, 24, 21, 18, 15],
    [12, 27, 25, 22, 19, 16],
    [13, 29, 26, 23, 20, 18],
    [14, 30, 28, 25, 22, 19],
    [15, 32, 29, 26, 23, 20],
    [16, 33, 30, 28, 25, 22],
    [17, 35, 32, 29, 26, 23],
    [18, 36, 33, 30, 27, 24],
    [19, 38, 35, 32, 29, 26],
    [20, 39, 36, 33, 30, 27],
    [21, 41, 38, 35, 32, 28],
    [22, 43, 39, 36, 33, 30],
    [23, 44, 40, 37, 34, 31],
    [24, 46, 42, 38, 36, 32],
]);

// GM Core "Skills" table, https://2e.aonsrd.com/rules/1000-skills
export const SKILLS = scaleTable(EXTREME_TO_LOW, [
    [-1, 8, 5, 4, [2, 1]],
    [0, 9, 6, 5, [3, 2]],
    [1, 10, 7, 6, [4, 3]],
    [2, 11, 8, 7, [5, 4]],
    [3, 13, 10, 9, [7, 5]],
    [4, 15, 12, 10, [8, 7]],
    [5, 16, 13, 12, [10, 8]],
    [6, 18, 15, 13, [11, 9]],
    [7, 20, 17, 15, [13, 11]],
    [8, 21, 18, 16, [14, 12]],
    [9, 23, 20, 18, [16, 13]],
    [10, 25, 22, 19, [17, 15]],
    [11, 26, 23, 21, [19, 16]],
    [12, 28, 25, 22, [20, 17]],
    [13, 30, 27, 24, [22, 19]],
    [14, 31, 28, 25, [23, 20]],
    [15, 33, 30, 27, [25, 21]],
    [16, 35, 32, 28, [26, 23]],
    [17, 36, 33, 30, [28, 24]],
    [18, 38, 35, 31, [29, 25]],
    [19, 40, 37, 33, [31, 27]],
    [20, 41, 38, 34, [32, 28]],
    [21, 43, 40, 36, [34, 29]],
    [22, 45, 42, 37, [35, 31]],
    [23, 46, 43, 38, [36, 32]],
    [24, 48, 45, 40, [38, 33]],
]);

// GM Core "Armor Class" table, https://2e.aonsrd.com/rules/1004-armor-class
export const ARMOR_CLASS = scaleTable(EXTREME_TO_LOW, [
    [-1, 18, 15, 14, 12],
    [0, 19, 16, 15, 13],
    [1, 19, 16, 15, 13],
    [2, 21, 18, 17, 15],
    [3, 22, 19, 18, 16],
    [4, 24, 21, 20, 18],
    [5, 25, 22, 21, 19],
    [6, 27, 24, 23, 21],
    [7, 28, 25, 24, 22],
    [8, 30, 27, 26, 24],
    [9, 31, 28, 27, 25],
    [10, 33, 30, 29, 27],
    [11, 34, 31, 30, 28],
    [12, 36, 33, 32, 30],
    [13, 37, 34, 33, 31],
    [14, 39, 36, 35, 33],
    [15, 40, 37, 36, 34],
    [16, 42, 39, 38, 36],
    [17, 43, 40, 39, 37],
    [18, 45, 42, 41, 39],
    [19, 46, 43, 42, 40],
    [20, 48, 45, 44, 42],
    [21, 49, 46, 45, 43],
    [22, 51, 48, 47, 45],
    [23, 52, 49, 48, 46],
    [24, 54, 51, 50, 48],
]);

// GM Core "Saving Throws" table, https://2e.aonsrd.com/rules/1005-saving-throws
export const SAVING_THROWS = scaleTable(EXTREME_TO_TERRIBLE, [
    [-1, 9, 8, 5, 2, 0],
    [0, 10, 9, 6, 3, 1],
    [1, 11, 10, 7, 4, 2],
    [2, 12, 11, 8, 5, 3],
    [3, 14, 12, 9, 6, 4],
    [4, 15, 14, 11, 8, 6],
    [5, 17, 15, 12, 9, 7],
    [6, 18, 17, 14, 11, 8],
    [7, 20, 18, 15, 12, 10],
    [8, 21, 19, 16, 13, 11],
    [9, 23, 21, 18, 15, 12],
    [10, 24, 22, 19, 16, 14],
    [11, 26, 24, 21, 18, 15],
    [12, 27, 25, 22, 19, 16],
    [13, 29, 26, 23, 20, 18],
    [14, 30, 28, 25, 22, 19],
    [15, 32, 29, 26, 23, 20],
    [16, 33, 30, 28, 25, 22],
    [17, 35, 32, 29, 26, 23],
    [18, 36, 33, 30, 27, 24],
    [19, 38, 35, 32, 29, 26],
    [20, 39, 36, 33, 30, 27],
    [21, 41, 38, 35, 32, 28],
    [22, 43, 39, 36, 33, 30],
    [23, 44, 40, 37, 34, 31],
    [24, 46, 42, 38, 36, 32],
]);

// GM Core "Hit Points" table, https://2e.aonsrd.com/rules/1006-hit-points
export const HIT_POINTS = scaleTable(
    ["high", "moderate", "low"],
    [
        [-1, 9, [8, 7], [6, 5]],
        [0, [20, 17], [16, 14], [13, 11]],
        [1, [26, 24], [21, 19], [16, 14]],
        [2, [40, 36], [32, 28], [25, 21]],
        [3, [59, 53], [48, 42], [37, 31]],
        [4, [78, 72], [63, 57], [48, 42]],
        [5, [97, 91], [78, 72], [59, 53]],
        [6, [123, 115], [99, 91], [75, 67]],
        [7, [148, 140], [119, 111], [90, 82]],
        [8, [173, 165], [139, 131], [105, 97]],
        [9, [198, 190], [159, 151], [120, 112]],
        [10, [223, 215], [179, 171], [135, 127]],
        [11, [248, 240], [199, 191], [150, 142]],
        [12, [273, 265], [219, 211], [165, 157]],
        [13, [298, 290], [239, 231], [180, 172]],
        [14, [323, 315], [259, 251], [195, 187]],
        [15, [348, 340], [279, 271], [210, 202]],
        [16, [373, 365], [299, 291], [225, 217]],
        [17, [398, 390], [319, 311], [240, 232]],
        [18, [423, 415], [339, 331], [255, 247]],
        [19, [448, 440], [359, 351], [270, 262]],
        [20, [473, 465], [379, 371], [285, 277]],
        [21, [505, 495], [405, 395], [305, 295]],
        [22, [544, 532], [436, 424], [329, 317]],
        [23, [581, 569], [466, 454], [351, 339]],
        [24, [633, 617], [508, 492], [383, 367]],
    ],
);

// GM Core "Strike Attack Bonus" table, https://2e.aonsrd.com/rules/1011-strike-attack-bonus
export const STRIKE_ATTACK_BONUS = scaleTable(EXTREME_TO_LOW, [
    [-1, 10, 8, 6, 4],
    [0, 10, 8, 6, 4],
    [1, 11, 9, 7, 5],
    [2, 13, 11, 9, 7],
    [3, 14, 12, 10, 8],
    [4, 16, 14, 12, 9],
    [5, 17, 15, 13, 11],
    [6, 19, 17, 15, 12],
    [7, 20, 18, 16, 13],
    [8, 22, 20, 18, 15],
    [9, 23, 21, 19, 16],
    [10, 25, 23, 21, 17],
    [11, 27, 24, 22, 19],
    [12, 28, 26, 24, 20],
    [13, 29, 27, 25, 21],
    [14, 31, 29, 27, 23],
    [15, 32, 30, 28, 24],
    [16, 34, 32, 30, 25],
    [17, 35, 33, 31, 27],
    [18, 37, 35, 33, 28],
    [19, 38, 36, 34, 29],
    [20, 40, 38, 36, 31],
    [21, 41, 39, 37, 32],
    [22, 43, 41, 39, 33],
    [23, 44, 42, 40, 35],
    [24, 46, 44, 42, 36],
]);

// GM Core "Spell DC and Spell Attack Modifier" table, https://2e.aonsrd.com/rules/1014-spell-dc-and-spell-attack-modifier
export const SPELL_DC = scaleTable(
    ["extreme", "high", "moderate"],
    [
        [-1, 19, 16, 13],
        [0, 19, 16, 13],
        [1, 20, 17, 14],
        [2, 22, 18, 15],
        [3, 23, 20, 17],
        [4, 25, 21, 18],
        [5, 26, 22, 19],
        [6, 27, 24, 21],
        [7, 29, 25, 22],
        [8, 30, 26, 23],
        [9, 32, 28, 25],
        [10, 33, 29, 26],
        [11, 34, 30, 27],
        [12, 36, 32, 29],
        [13, 37, 33, 30],
        [14, 39, 34, 31],
        [15, 40, 36, 33],
        [16, 41, 37, 34],
        [17, 43, 38, 35],
        [18, 44, 40, 37],
        [19, 46, 41, 38],
        [20, 47, 42, 39],
        [21, 48, 44, 41],
        [22, 50, 45, 42],
        [23, 51, 46, 43],
        [24, 52, 48, 45],
    ],
);

// GM Core "Spell DC and Spell Attack Modifier" table, https://2e.aonsrd.com/rules/1014-spell-dc-and-spell-attack-modifier
export const SPELL_ATTACK = scaleTable(
    ["extreme", "high", "moderate"],
    [
        [-1, 11, 8, 5],
        [0, 11, 8, 5],
        [1, 12, 9, 6],
        [2, 14, 10, 7],
        [3, 15, 12, 9],
        [4, 17, 13, 10],
        [5, 18, 14, 11],
        [6, 19, 16, 13],
        [7, 21, 17, 14],
        [8, 22, 18, 15],
        [9, 24, 20, 17],
        [10, 25, 21, 18],
        [11, 26, 22, 19],
        [12, 28, 24, 21],
        [13, 29, 25, 22],
        [14, 31, 26, 23],
        [15, 32, 28, 25],
        [16, 33, 29, 26],
        [17, 35, 30, 27],
        [18, 36, 32, 29],
        [19, 38, 33, 30],
        [20, 39, 34, 31],
        [21, 40, 36, 33],
        [22, 42, 37, 34],
        [23, 43, 38, 35],
        [24, 44, 40, 37],
    ],
);

// GM Core "Strike Damage" table, https://2e.aonsrd.com/rules/1012-strike-damage
const STRIKE_DAMAGE_ROWS: readonly DamageRow[] = [
    [-1, ["1d6+1", 4], ["1d4+1", 3], ["1d4", 3], ["1d4", 2]],
    [0, ["1d6+3", 6], ["1d6+2", 5], ["1d4+2", 4], ["1d4+1", 3]],
    [1, ["1d8+4", 8], ["1d6+3", 6], ["1d6+2", 5], ["1d4+2", 4]],
    [2, ["1d12+4", 11], ["1d10+4", 9], ["1d8+4", 8], ["1d6+3", 6]],
    [3, ["1d12+8", 15], ["1d10+6", 12], ["1d8+6", 10], ["1d6+5", 8]],
    [4, ["2d10+7", 18], ["2d8+5", 14], ["2d6+5", 12], ["2d4+4", 9]],
    [5, ["2d12+7", 20], ["2d8+7", 16], ["2d6+6", 13], ["2d4+6", 11]],
    [6, ["2d12+10", 23], ["2d8+9", 18], ["2d6+8", 15], ["2d4+7", 12]],
    [7, ["2d12+12", 25], ["2d10+9", 20], ["2d8+8", 17], ["2d6+6", 13]],
    [8, ["2d12+15", 28], ["2d10+11", 22], ["2d8+9", 18], ["2d6+8", 15]],
    [9, ["2d12+17", 30], ["2d10+13", 24], ["2d8+11", 20], ["2d6+9", 16]],
    [10, ["2d12+20", 33], ["2d12+13", 26], ["2d10+11", 22], ["2d6+10", 17]],
    [11, ["2d12+22", 35], ["2d12+15", 28], ["2d10+12", 23], ["2d8+10", 19]],
    [12, ["3d12+19", 38], ["3d10+14", 30], ["3d8+12", 25], ["3d6+10", 20]],
    [13, ["3d12+21", 40], ["3d10+16", 32], ["3d8+14", 27], ["3d6+11", 21]],
    [14, ["3d12+24", 43], ["3d10+18", 34], ["3d8+15", 28], ["3d6+13", 23]],
    [15, ["3d12+26", 45], ["3d12+17", 36], ["3d10+14", 30], ["3d6+14", 24]],
    [16, ["3d12+29", 48], ["3d12+18", 37], ["3d10+15", 31], ["3d6+15", 25]],
    [17, ["3d12+31", 50], ["3d12+19", 38], ["3d10+16", 32], ["3d6+16", 26]],
    [18, ["3d12+34", 53], ["3d12+20", 40], ["3d10+17", 33], ["3d6+17", 27]],
    [19, ["4d12+29", 55], ["4d10+20", 42], ["4d8+17", 35], ["4d6+14", 28]],
    [20, ["4d12+32", 58], ["4d10+22", 44], ["4d8+19", 37], ["4d6+15", 29]],
    [21, ["4d12+34", 60], ["4d10+24", 46], ["4d8+20", 38], ["4d6+17", 31]],
    [22, ["4d12+37", 63], ["4d10+26", 48], ["4d8+22", 40], ["4d6+18", 32]],
    [23, ["4d12+39", 65], ["4d12+24", 50], ["4d10+20", 42], ["4d6+19", 33]],
    [24, ["4d12+42", 68], ["4d12+26", 52], ["4d10+22", 44], ["4d6+21", 35]],
];

/** Columns are the book's listed averages; the example formulas are kept for their dice counts. */
export const STRIKE_DAMAGE: ScaleTable = damageTable(EXTREME_TO_LOW, STRIKE_DAMAGE_ROWS);

// Starfinder GM Core "Area Damage" table, https://2e.aonsrd.com/rules/1025-damage-dealing-abilities
const AREA_DAMAGE_ROWS: readonly DamageRow[] = [
    [-1, ["1d6", 4], ["1d4", 2]],
    [0, ["1d10", 6], ["1d6", 4]],
    [1, ["2d6", 7], ["2d4", 5]],
    [2, ["3d6", 11], ["2d6", 7]],
    [3, ["4d6", 14], ["2d8", 9]],
    [4, ["5d6", 18], ["3d6", 11]],
    [5, ["6d6", 21], ["2d10", 12]],
    [6, ["7d6", 25], ["4d6", 14]],
    [7, ["8d6", 28], ["4d6", 15]],
    [8, ["9d6", 32], ["5d6", 17]],
    [9, ["10d6", 35], ["5d6", 18]],
    [10, ["11d6", 39], ["6d6", 20]],
    [11, ["12d6", 42], ["6d6", 21]],
    [12, ["13d6", 46], ["5d8", 23]],
    [13, ["14d6", 49], ["7d6", 24]],
    [14, ["15d6", 53], ["4d12", 26]],
    [15, ["16d6", 56], ["6d8", 27]],
    [16, ["17d6", 60], ["8d6", 28]],
    [17, ["18d6", 63], ["8d6", 29]],
    [18, ["19d6", 67], ["9d6", 30]],
    [19, ["20d6", 70], ["7d8", 32]],
    [20, ["21d6", 74], ["6d10", 33]],
    [21, ["22d6", 77], ["10d6", 35]],
    [22, ["23d6", 81], ["8d8", 36]],
    [23, ["24d6", 84], ["11d6", 38]],
    [24, ["25d6", 88], ["11d6", 39]],
];

/** Columns are the book's listed averages, which several cells' example dice do not roll. */
export const AREA_DAMAGE: ScaleTable = damageTable(LIMITED_TO_UNLIMITED, AREA_DAMAGE_ROWS);

export function areaDamageFormulas(
    level: number,
): Readonly<Partial<Record<Adjective, string>>> | undefined {
    return formulasAt(LIMITED_TO_UNLIMITED, AREA_DAMAGE_ROWS, level);
}

export function strikeDamageFormulas(
    level: number,
): Readonly<Partial<Record<Adjective, string>>> | undefined {
    return formulasAt(EXTREME_TO_LOW, STRIKE_DAMAGE_ROWS, level);
}

function damageTable(columns: readonly Adjective[], rows: readonly DamageRow[]): ScaleTable {
    return new Map(
        rows.map(([level, ...cells]) => [
            level,
            columnsOf(
                columns,
                cells.map(([, average]) => average),
            ),
        ]),
    );
}

function formulasAt(
    columns: readonly Adjective[],
    rows: readonly DamageRow[],
    level: number,
): Readonly<Partial<Record<Adjective, string>>> | undefined {
    // Like columnValue, a level off the table reads the nearest row.
    const row = rows.reduce<DamageRow | undefined>(
        (nearest, candidate) =>
            nearest === undefined || Math.abs(candidate[0] - level) < Math.abs(nearest[0] - level)
                ? candidate
                : nearest,
        undefined,
    );
    if (row === undefined) return undefined;
    const [, ...cells] = row;
    return Object.fromEntries(cells.map(([formula], index) => [columns[index], formula]));
}

function scaleTable(columns: readonly Adjective[], rows: readonly Row[]): ScaleTable {
    return new Map(rows.map(([level, ...cells]) => [level, columnsOf(columns, cells)]));
}

function columnsOf(columns: readonly Adjective[], cells: readonly Cell[]): Columns {
    const entries = columns.flatMap((adjective, index) => {
        const value = valueOf(cells[index]);
        return value === undefined ? [] : [[adjective, value] as const];
    });
    return Object.fromEntries(entries);
}

/** Ranges take their median, rounded half up, so every column has a single value to scale from. */
function valueOf(cell: Cell | undefined): number | undefined {
    if (cell === undefined || cell === "—") return undefined;
    if (typeof cell === "number") return cell;
    return Math.round((cell[0] + cell[1]) / 2);
}
