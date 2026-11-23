import manifest from "../public/module.json";

Hooks.once("init", () => {
    console.log(`${manifest.id} | initialising for system ${game.system.id}`);
});
