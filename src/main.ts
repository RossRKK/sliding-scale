import { registerLevelChange } from "./foundry/level-change";

Hooks.once("init", () => {
    registerLevelChange();
});
