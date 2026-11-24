import { registerLevelChange } from "./foundry/level-change";
import { registerSheetControls } from "./foundry/sheet";

Hooks.once("init", () => {
    registerLevelChange();
    registerSheetControls();
});
