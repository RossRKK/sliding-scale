import { describe, expect, it } from "vitest";
import manifest from "../public/module.json";

describe("module manifest", () => {
    it("is offered in pf2e and sf2e worlds, which share one codebase", () => {
        const systems = manifest.relationships.systems.map((system) => system.id);
        expect(systems).toEqual(["pf2e", "sf2e"]);
    });
});
