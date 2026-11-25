/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PF2E_DERIVED_IMMUNITIES, TRAIT_IWR, traitIwrToAdd } from "./trait-iwr";

const NONE = { immunities: [], weaknesses: [], resistances: [] };

describe("TRAIT_IWR", () => {
    it.each(Object.entries(PF2E_DERIVED_IMMUNITIES))(
        "leaves %s's immunities to pf2e, which derives them",
        (trait, derived) => {
            const types = (TRAIT_IWR[trait] ?? []).map(({ type }) => type);
            expect(types.filter((type) => derived.includes(type))).toEqual([]);
        },
    );
});

describe("traitIwrToAdd", () => {
    it("values a devil's IWR from Table 2–8 at its level", () => {
        // Level 5: maximum 8, minimum 4.
        expect(traitIwrToAdd(["devil", "fiend"], 5, NONE)).toEqual({
            immunities: [{ type: "fire" }],
            weaknesses: [{ type: "holy", value: 8 }],
            resistances: [
                { type: "physical", value: 4, exceptions: ["silver"], doubleVs: [] },
                { type: "poison", value: 8, exceptions: [], doubleVs: [] },
            ],
            required: [
                "fire immunity",
                "holy weakness 8",
                "physical resistance 4",
                "poison resistance 8",
            ],
            optional: [],
        });
    });

    it("adds only types the NPC lacks, leaving its own values alone", () => {
        const existing = { immunities: ["fire"], weaknesses: ["holy"], resistances: [] };
        const added = traitIwrToAdd(["devil"], 5, existing);
        expect(added.immunities).toEqual([]);
        expect(added.weaknesses).toEqual([]);
        expect(added.resistances.map(({ type }) => type)).toEqual(["physical", "poison"]);
    });

    it("adds a type two traits share once", () => {
        const added = traitIwrToAdd(["devil", "fiend"], 5, NONE);
        expect(added.weaknesses).toEqual([{ type: "holy", value: 8 }]);
    });

    it("marks what the book only says creatures sometimes have as optional", () => {
        expect(traitIwrToAdd(["fire"], 1, NONE)).toMatchObject({
            required: ["fire immunity"],
            optional: ["cold weakness 3", "water weakness 3"],
        });
    });

    it("excepts vitality from an incorporeal creature's resistance only if it is undead", () => {
        const exceptions = (traits: string[]) =>
            traitIwrToAdd(traits, 4, NONE).resistances[0]?.exceptions;
        expect(exceptions(["incorporeal"])).toEqual(["force", "ghost-touch", "spirit"]);
        expect(exceptions(["incorporeal", "undead"])).toEqual([
            "force",
            "ghost-touch",
            "spirit",
            "vitality",
        ]);
    });

    it("gives undead unconscious immunity", () => {
        expect(traitIwrToAdd(["undead"], 1, NONE).immunities).toContainEqual({
            type: "unconscious",
        });
    });

    it("does not add unconscious to undead that are already immune to sleep", () => {
        const existing = { immunities: ["sleep"], weaknesses: [], resistances: [] };
        const types = traitIwrToAdd(["undead"], 1, existing).immunities.map(({ type }) => type);
        expect(types).toEqual(["death-effects", "disease", "paralyzed", "poison"]);
    });

    it("gives cosmic creatures an optional cold immunity and a void resistance", () => {
        // Level 2: maximum 5.
        expect(traitIwrToAdd(["cosmic"], 2, NONE)).toMatchObject({
            immunities: [{ type: "cold" }],
            resistances: [{ type: "void", value: 5 }],
            required: ["void resistance 5"],
            optional: ["cold immunity"],
        });
    });

    it("adds nothing for traits with no IWR", () => {
        expect(traitIwrToAdd(["humanoid", "construct"], 3, NONE)).toMatchObject({
            required: [],
            optional: [],
        });
    });
});

// The pf2e clone's source, next to the packs used by the pack suites.
const PF2E_SOURCE =
    process.env.PF2E_PACKS_DIR === undefined
        ? undefined
        : join(process.env.PF2E_PACKS_DIR, "..", "src");

describe.skipIf(PF2E_SOURCE === undefined)("against pf2e's source", () => {
    const read = (path: string) => readFileSync(join(PF2E_SOURCE ?? "", path), "utf8");

    it("lists what setImmunitiesFromTraits adds", () => {
        const helpers = read("module/actor/creature/helpers.ts");
        const body = helpers.slice(helpers.indexOf("function setImmunitiesFromTraits"));
        for (const [trait, types] of Object.entries(PF2E_DERIVED_IMMUNITIES)) {
            expect(body).toContain(`"${trait}"`);
            for (const type of types) expect(body).toContain(`"${type}"`);
        }
    });

    it("uses only IWR types pf2e defines", () => {
        // Material types such as cold iron are listed, not keyed, in damage.ts.
        const config = read("scripts/config/iwr.ts") + read("scripts/config/damage.ts");
        const types = Object.values(TRAIT_IWR).flatMap((entries) =>
            entries.flatMap((iwr) => [
                iwr.type,
                ...(iwr.kind === "resistance"
                    ? [...(iwr.exceptions ?? []).map(({ type }) => type), ...(iwr.doubleVs ?? [])]
                    : []),
            ]),
        );
        const unknown = [...new Set(types)].filter(
            (type) => !new RegExp(`["\\s{]${type}"?[:,]`).test(config),
        );
        expect(unknown).toEqual([]);
    });
});
