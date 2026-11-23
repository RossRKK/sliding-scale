import { describe, expect, it } from "vitest";
import manifest from "../public/module.json";

describe("module manifest", () => {
    it("is offered only in pf2e worlds", () => {
        const systems = manifest.relationships.systems.map((system) => system.id);
        expect(systems).toEqual(["pf2e"]);
    });
});
