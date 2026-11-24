# Sliding Scale

A Foundry VTT module for the pf2e system (played with the Starfinder Anachronism
module) and the standalone Starfinder Second Edition (sf2e) system. It reads each NPC
stat as an adjective (extreme/high/moderate/low/terrible) plus an offset from the
Building Creatures tables, lets you change the adjective on the sheet, and rescales
every stat when the level changes.

It is off for every NPC until you press **Enable Sliding Scale** on that NPC's sheet.
Enabling changes no numbers; **Disable Sliding Scale** stops the rescaling and hides the
adjectives again.

## One-time setup

Foundry is licensed, so its zip is never downloaded by the build. Download
`FoundryVTT-Linux-14.364.zip` from your Foundry account and add it to the nix store:

```sh
nix-store --add-fixed sha256 ~/Downloads/FoundryVTT-Linux-14.364.zip
```

The build number is pinned in `flake.nix` to match the styx server. To change it, the
build must be listed in the `nix-foundryvtt` input (`nix flake update foundryvtt`).

Then enter the dev shell and install the JS dependencies:

```sh
nix develop
npm ci
```

## Everyday commands

| Command                   | What it does                                    |
| ------------------------- | ----------------------------------------------- |
| `npm run build`           | Bundle `src/main.ts` and `public/` into `dist/` |
| `npm run dev`             | Rebuild `dist/` on every change                 |
| `npm test`                | Unit tests (vitest), no Foundry needed          |
| `npm run test:scripts`    | Tests for the Python dev scripts (pytest)       |
| `npm run check`           | Type-check with the pf2e and Foundry types      |
| `npm run lint` / `format` | oxlint, prettier and ruff                       |

## Running a local Foundry

```sh
npm run foundry:install-pf2e         # pf2e system into .foundry-data/
npm run foundry:install-anachronism  # Starfinder Anachronism module
npm run foundry:install-sf2e         # optional: the standalone sf2e system
npm run build                        # or keep `npm run dev` running in another terminal
npm run foundry                      # serves http://localhost:30000
```

`npm run foundry -- --port=30001` passes extra options through to Foundry (it remembers
the port in `.foundry-data/Config/options.json`). The module
is symlinked from `dist/`, so after a rebuild a browser reload picks it up. Re-running an
install script replaces the package with the latest release.

Manual steps on first start (Foundry stores them in `.foundry-data/`):

1. Open http://localhost:30000, enter your licence key and accept the EULA.
2. Create a world using the Pathfinder Second Edition system.
3. Launch it and enable **Sliding Scale** and **Starfinder Anachronism** under
   Manage Modules.

An sf2e world needs only **Sliding Scale** enabled. sf2e is built from the same
[pf2e repository](https://github.com/foundryvtt/pf2e) with `SYSTEM_ID=sf2e`, so it keeps
`CONFIG.PF2E`, the `NPCSheetPF2e` sheet and the NPC data model, and the module runs
unchanged in it.

## Types

`@7h3laughingman/pf2e-types` publishes the pf2e system's own declarations together with
the Foundry core types pf2e is written against, so globals like `game`, `CONFIG.PF2E` and
the pf2e document classes are typed. It trails the pf2e release (types for 8.0 against
system 8.7), so check field names against the
[pf2e source](https://github.com/foundryvtt/pf2e) when something looks off.
