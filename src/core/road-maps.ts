import type { Adjective } from "./adjective";

/**
 * A Building Creatures road map, transcribed with one adjective per entry: where the book offers
 * a choice the comment quotes it and names the pick, which is the first option unless noted.
 */
export interface RoadMap {
    readonly id: string;
    readonly name: string;
    readonly book: Book;
    /** The Strikes a road map's attack and damage are for; the other kind does one column less damage. */
    readonly primaryStrike: StrikeKind;
    readonly entries: readonly RoadMapEntry[];
}

export type Book = "pathfinder" | "starfinder";
export type StrikeKind = "melee" | "ranged";
export type Attribute = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Save = "fortitude" | "reflex" | "will";

export type RoadMapEntry =
    | { readonly stat: "perception" | "armorClass" | "hitPoints"; readonly adjective: Adjective }
    | {
          readonly stat: "strikeAttack" | "strikeDamage" | "spell" | "areaDC";
          readonly adjective: Adjective;
      }
    | { readonly stat: "attribute"; readonly attribute: Attribute; readonly adjective: Adjective }
    | { readonly stat: "spellcastingAttribute"; readonly adjective: Adjective }
    | { readonly stat: "save"; readonly save: Save; readonly adjective: Adjective }
    | { readonly stat: "skill"; readonly skill: string; readonly adjective: Adjective }
    /** Every skill the system keys to an attribute, such as "Charisma-based skills". */
    | { readonly stat: "skillsOf"; readonly attribute: Attribute; readonly adjective: Adjective }
    | { readonly stat: "everySkill"; readonly adjective: Adjective }
    /** A skill the book leaves to the creature's deity, order, patron and so on. */
    | { readonly stat: "unassignedSkill"; readonly adjective: Adjective }
    /** Book text with no stat to set, left for a human. */
    | { readonly stat: "byHand"; readonly text: string };

const perception = (adjective: Adjective) => ({ stat: "perception", adjective }) as const;
const armorClass = (adjective: Adjective) => ({ stat: "armorClass", adjective }) as const;
const hitPoints = (adjective: Adjective) => ({ stat: "hitPoints", adjective }) as const;
const attack = (adjective: Adjective) => ({ stat: "strikeAttack", adjective }) as const;
const damage = (adjective: Adjective) => ({ stat: "strikeDamage", adjective }) as const;
const spell = (adjective: Adjective) => ({ stat: "spell", adjective }) as const;
const attribute = (name: Attribute, adjective: Adjective) =>
    ({ stat: "attribute", attribute: name, adjective }) as const;
const save = (name: Save, adjective: Adjective) =>
    ({ stat: "save", save: name, adjective }) as const;
const skill = (name: string, adjective: Adjective) =>
    ({ stat: "skill", skill: name, adjective }) as const;
const skillsOf = (name: Attribute, adjective: Adjective) =>
    ({ stat: "skillsOf", attribute: name, adjective }) as const;
const everySkill = (adjective: Adjective) => ({ stat: "everySkill", adjective }) as const;
const unassignedSkill = (adjective: Adjective) => ({ stat: "unassignedSkill", adjective }) as const;
const byHand = (text: string) => ({ stat: "byHand", text }) as const;

// GM Core "Base Road Maps", identical in Pathfinder (https://2e.aonprd.com/Rules.aspx?ID=2874) and
// Starfinder (https://2e.aonsrd.com/rules/996-attribute-modifiers, GM Core p. 118).
const BASE: readonly Omit<RoadMap, "book">[] = [
    {
        id: "brute",
        name: "Brute",
        primaryStrike: "melee",
        entries: [
            perception("low"),
            attribute("str", "high"), // "high or extreme Str modifier" → high
            attribute("con", "high"), // "high to moderate Con modifier" → high
            // "low or lower Dex and mental modifiers" → low, the lowest attribute column
            attribute("dex", "low"),
            attribute("int", "low"),
            attribute("wis", "low"),
            attribute("cha", "low"),
            armorClass("moderate"), // "moderate or low AC" → moderate
            save("fortitude", "high"),
            save("reflex", "low"), // "low Reflex or Will or both" → Reflex
            hitPoints("high"),
            // "high attack bonus and high damage or moderate attack bonus and extreme damage" → first
            attack("high"),
            damage("high"),
        ],
    },
    {
        id: "magical-striker",
        name: "Magical Striker",
        primaryStrike: "melee",
        entries: [
            attack("high"),
            damage("high"),
            spell("moderate"), // "moderate to high spell DCs" → moderate
            byHand("innate spells, or spells of a rank up to half its level (rounded up) minus 1"),
        ],
    },
    {
        id: "skill-paragon",
        name: "Skill Paragon",
        primaryStrike: "melee",
        entries: [
            byHand("high or extreme attribute modifier matching its best skills"),
            save("reflex", "high"), // "typically high Reflex or Will" → Reflex
            save("fortitude", "low"),
            everySkill("moderate"), // "many skills at moderate or high" → moderate
            unassignedSkill("extreme"), // "potentially one or two extreme skills" → one
            byHand("a special ability to use its skills in combat"),
        ],
    },
    {
        id: "skirmisher",
        name: "Skirmisher",
        primaryStrike: "melee",
        entries: [
            attribute("dex", "high"),
            save("fortitude", "low"),
            save("reflex", "high"),
            byHand("higher Speed than typical"),
        ],
    },
    {
        id: "sniper",
        name: "Sniper",
        // "ranged Strikes have high attack bonus and damage … (melee Strikes are weaker)"
        primaryStrike: "ranged",
        entries: [
            perception("high"),
            attribute("dex", "high"),
            save("fortitude", "low"),
            save("reflex", "high"),
            hitPoints("moderate"), // "moderate to low HP" → moderate
            // "high attack bonus and damage or moderate attack bonus and extreme damage" → first
            attack("high"),
            damage("high"),
        ],
    },
    {
        id: "soldier",
        name: "Soldier",
        primaryStrike: "melee",
        entries: [
            attribute("str", "high"),
            armorClass("high"), // "high to extreme AC" → high
            save("fortitude", "high"),
            attack("high"),
            damage("high"),
            byHand("Reactive Strike or other tactical abilities"),
        ],
    },
    {
        id: "spellcaster",
        name: "Spellcaster",
        primaryStrike: "melee",
        entries: [
            // "high or extreme modifier for the spellcasting attribute" → high
            { stat: "spellcastingAttribute", adjective: "high" },
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"),
            attack("low"),
            damage("moderate"), // "moderate or low damage" → moderate
            spell("high"), // "high or extreme spell DCs" → high
            byHand("spells of a rank up to half its level (rounded up)"),
        ],
    },
];

// Pathfinder GM Core "Class Road Maps", https://2e.aonprd.com/Rules.aspx?ID=2922
const PATHFINDER_CLASSES: readonly Omit<RoadMap, "book" | "primaryStrike">[] = [
    {
        id: "alchemist",
        name: "Alchemist",
        entries: [
            perception("low"),
            skill("crafting", "high"),
            attribute("int", "high"),
            attribute("dex", "moderate"), // "moderate or better Dex or Str" → Dex moderate
            hitPoints("low"), // "low to moderate HP" → low
            attack("moderate"), // "moderate attack with bombs"
        ],
    },
    {
        id: "barbarian",
        name: "Barbarian",
        entries: [
            skill("athletics", "high"),
            attribute("str", "high"),
            attribute("con", "high"), // "high to moderate Con" → high
            armorClass("high"),
            save("fortitude", "high"),
            hitPoints("high"),
            attack("moderate"),
            // Rage adds its own damage, so the Strike keeps moderate and the raging total is by hand.
            byHand("extreme damage when raging"),
        ],
    },
    {
        id: "bard",
        name: "Bard",
        entries: [
            skill("occultism", "moderate"),
            skill("performance", "high"),
            skillsOf("cha", "high"),
            attribute("cha", "high"),
            save("fortitude", "low"),
            save("will", "moderate"), // "moderate to high Will" → moderate
            hitPoints("low"), // "low to moderate HP" → low
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "champion",
        name: "Champion",
        entries: [
            perception("low"),
            skill("religion", "moderate"),
            attribute("str", "high"), // "high Str or Dex" → Str
            attribute("cha", "moderate"),
            armorClass("extreme"),
            save("reflex", "low"),
            attack("moderate"),
            damage("high"),
        ],
    },
    {
        id: "cleric-cloistered",
        name: "Cleric (Cloistered Cleric)",
        entries: [
            perception("high"),
            skill("religion", "high"),
            unassignedSkill("moderate"), // "moderate or high skill themed to deity" → moderate
            armorClass("low"),
            attribute("wis", "high"),
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "cleric-warpriest",
        name: "Cleric (Warpriest)",
        entries: [
            perception("moderate"),
            skill("religion", "moderate"),
            unassignedSkill("moderate"), // "moderate or high skill themed to deity" → moderate
            attribute("str", "high"),
            attribute("wis", "moderate"),
            armorClass("high"),
            save("reflex", "low"),
            save("will", "high"),
            spell("high"),
        ],
    },
    {
        id: "druid",
        name: "Druid",
        entries: [
            perception("high"),
            skill("nature", "high"),
            unassignedSkill("moderate"), // "moderate or high skill from order" → moderate
            attribute("wis", "high"),
            save("will", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "fighter",
        name: "Fighter",
        entries: [
            skill("acrobatics", "high"), // "High Acrobatics or Athletics" → Acrobatics
            attribute("str", "high"), // "high Str or Dex" → Str
            armorClass("high"),
            save("will", "low"),
            attack("high"),
            damage("high"),
        ],
    },
    {
        id: "investigator",
        name: "Investigator",
        entries: [
            perception("high"),
            skill("society", "high"),
            unassignedSkill("high"), // "high methodology skill"
            byHand("more skills than usual"),
            attribute("int", "high"),
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("moderate"),
            damage("low"), // "low to moderate damage before strategic strike" → low
            byHand("high damage with strategic strike"),
        ],
    },
    {
        id: "monk",
        name: "Monk",
        entries: [
            skill("acrobatics", "high"), // "High Acrobatics, Athletics, or both" → Acrobatics
            attribute("str", "high"), // "high Str or Dex" → Str
            attribute("wis", "moderate"),
            armorClass("high"), // "high or extreme AC" → high
            attack("moderate"),
            damage("high"),
        ],
    },
    {
        id: "oracle",
        name: "Oracle",
        entries: [
            skill("religion", "high"),
            unassignedSkill("high"), // "high mystery skill"
            unassignedSkill("moderate"), // "moderate or high skill themed to deity" → moderate
            attribute("cha", "high"),
            armorClass("low"),
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "ranger",
        name: "Ranger",
        entries: [
            perception("high"),
            skill("nature", "moderate"),
            skill("survival", "moderate"), // "moderate to high Survival" → moderate
            attribute("str", "high"), // "high Str or Dex" → Str
            armorClass("high"),
            // "moderate attack and high damage (or … high attack and high damage)" → first
            attack("moderate"),
            damage("high"),
        ],
    },
    {
        id: "rogue",
        name: "Rogue",
        entries: [
            perception("high"),
            skill("stealth", "high"),
            skill("thievery", "high"),
            byHand("more skills than usual"),
            attribute("dex", "high"),
            armorClass("high"),
            save("fortitude", "low"),
            save("reflex", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("moderate"),
            damage("low"), // "low to moderate damage before sneak attack" → low
            byHand("high or extreme damage with sneak attack"),
        ],
    },
    {
        id: "sorcerer",
        name: "Sorcerer",
        entries: [
            perception("low"),
            unassignedSkill("moderate"), // "moderate bloodline skills"
            unassignedSkill("high"), // "high Charisma-based bloodline skills"
            attribute("cha", "high"),
            armorClass("low"),
            save("fortitude", "low"),
            hitPoints("low"),
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "swashbuckler",
        name: "Swashbuckler",
        entries: [
            perception("high"),
            skill("acrobatics", "high"),
            unassignedSkill("high"), // "plus high style skill"
            attribute("dex", "high"),
            armorClass("high"),
            save("fortitude", "low"),
            save("reflex", "high"),
            hitPoints("moderate"),
            attack("moderate"),
            damage("low"), // "low to moderate damage before precise strike" → low
            byHand("high or extreme damage with precise strike"),
        ],
    },
    {
        id: "witch",
        name: "Witch",
        entries: [
            perception("low"),
            unassignedSkill("high"), // "high patron skill"
            attribute("int", "high"),
            armorClass("low"),
            save("fortitude", "low"),
            hitPoints("low"),
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "wizard",
        name: "Wizard",
        entries: [
            perception("low"),
            skill("arcana", "high"),
            attribute("int", "high"),
            armorClass("low"),
            save("fortitude", "low"),
            hitPoints("low"),
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
];

// Starfinder GM Core "Class Road Maps", https://2e.aonsrd.com/rules/1037-pc-style-build
const STARFINDER_CLASSES: readonly Omit<RoadMap, "book" | "primaryStrike">[] = [
    {
        id: "envoy",
        name: "Envoy",
        entries: [
            perception("high"),
            skillsOf("cha", "high"),
            attribute("cha", "high"),
            save("fortitude", "low"),
            save("will", "moderate"), // "moderate to high Will" → moderate
            hitPoints("low"), // "low to moderate HP" → low
            attack("moderate"),
            damage("moderate"),
        ],
    },
    {
        id: "mystic",
        name: "Mystic",
        entries: [
            perception("high"),
            unassignedSkill("moderate"), // "moderate to high spellcasting skill" → moderate
            unassignedSkill("high"), // "high connection skill"
            attribute("wis", "high"),
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
    {
        id: "operative",
        name: "Operative",
        entries: [
            perception("high"),
            skillsOf("dex", "high"),
            unassignedSkill("high"), // "high Dex-based skills, plus specialization skill" → high
            attribute("dex", "high"),
            armorClass("moderate"),
            save("fortitude", "low"),
            save("reflex", "high"),
            hitPoints("low"), // "low to moderate HP" → low
            attack("moderate"), // "moderate to high attack" → moderate
            damage("moderate"), // "moderate damage before Aim"
            byHand("high or extreme damage with Aim"),
        ],
    },
    {
        id: "solarian",
        name: "Solarian",
        entries: [
            perception("high"),
            skill("athletics", "high"),
            attribute("str", "high"),
            armorClass("high"),
            save("reflex", "high"),
            save("will", "high"),
            attack("moderate"),
            damage("high"),
        ],
    },
    {
        id: "soldier-class",
        name: "Soldier (class)",
        entries: [
            skill("athletics", "high"),
            skill("intimidation", "high"),
            attribute("con", "high"),
            armorClass("moderate"),
            save("fortitude", "high"),
            save("will", "high"),
            hitPoints("high"),
            attack("moderate"),
            damage("moderate"), // "moderate to high damage" → moderate
            // "including area attack with high to extreme DC" → high
            { stat: "areaDC", adjective: "high" },
        ],
    },
    {
        id: "witchwarper",
        name: "Witchwarper",
        entries: [
            perception("low"),
            unassignedSkill("moderate"), // "moderate paradox skill"
            skillsOf("int", "high"),
            attribute("int", "high"),
            armorClass("low"),
            save("fortitude", "low"),
            save("will", "high"),
            hitPoints("low"),
            attack("low"), // "low accuracy"
            spell("high"), // "high to extreme spell DC" → high
        ],
    },
];

/** Every road map, base ones once per book since both books print them. */
export const ROAD_MAPS: readonly RoadMap[] = [
    ...BASE.map((map) => ({ ...map, book: "pathfinder" as const })),
    ...PATHFINDER_CLASSES.map((map) => ({
        ...map,
        book: "pathfinder" as const,
        primaryStrike: "melee" as const,
    })),
    ...BASE.map((map) => ({ ...map, book: "starfinder" as const })),
    ...STARFINDER_CLASSES.map((map) => ({
        ...map,
        book: "starfinder" as const,
        primaryStrike: "melee" as const,
    })),
];

export function roadMapsFor(books: readonly Book[]): RoadMap[] {
    return ROAD_MAPS.filter(({ book }) => books.includes(book));
}
