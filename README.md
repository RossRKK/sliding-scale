# Sliding Scale

A Foundry VTT module for NPCs in Pathfinder Second Edition (the pf2e system, with or
without the Starfinder Anachronism module) and Starfinder Second Edition (the
standalone sf2e system). It reads each NPC stat as an adjective
(extreme/high/moderate/low/terrible) plus an offset from the Building Creatures tables,
lets you change the adjective on the sheet, and rescales every stat when the level
changes.

It is off for every NPC until you press **Enable Sliding Scale** on that NPC's sheet.
Enabling changes no numbers; **Disable Sliding Scale** stops the rescaling and hides the
adjectives again.

**Apply road map** overwrites an enabled NPC with one of GM Core's base or class road
maps (Pathfinder's in pf2e, Starfinder's in sf2e, both with Starfinder Anachronism): its
listed statistics take the road map's adjective, other core statistics become moderate,
missing named skills are added, and it can add a melee and a ranged Strike.

An enabled NPC's sheet lists **Sliding Scale notes**: things to check by hand, such as a
large level change or a strike whose dice are a small part of its damage. The tick
acknowledges a note; a warning comes back only if its cause changes.

## Known limitations

Sliding Scale stores nothing but the opt-in flag: each stat is re-rated from its current
number every time. A level change and its reverse therefore do not always return the
original number. The rates below come from moving every NPC in the pf2e and sf2e packs to
each level from -1 to 24 and back (the round-trip suite under `PF2E_PACKS_DIR`), first for
all moves and then for moves of at most 2 levels. Every case would need the number or
rating from before the move, which is not stored.

**Column hopping.** A stat keeps its adjective and offset, but at the new level the
number can sit nearer another column, and it comes back by that one. An Animated Army's
120 HP at level 8 is moderate −15; at level 6 that is 80, which rates low +9, so it
returns as 110. Max HP 13.0% (7.4% within 2 levels), skills 2.2% (0%), strike damage
3.4% (0.2%), every other stat 1% or less.

**Ties.** A number exactly between two columns is rated on the higher one, and the other
reading may have been the right one. A Cavern Troll's Strength +6 at level 6 becomes +5 at
level 4, a tie there, and stays +5. Attributes 6.8% (5.3%), skills 5.5% (3.7%), strike
damage 3.3% (5.0%), other stats under 2%.

**One-die floor.** Dice counts never go below one, so a count that would have dropped
below one comes back higher. An Ailuran's 1d6+6 club at level 5 is 1d6+3 at level 3 and
2d6+2 back at level 5, the same average. Strike damage 1.7% (2.5%), area damage 2.9%
(1.0%), precision ability dice 6.2% (2.8%), precision partials 6.0% (0%), splash 1.3%
(1.1%).

**One die overshoots.** When even one die averages more than the target, the strike
keeps one die and no flat modifier and reads above its target, so it comes back higher.
A Chelaxian Cleric's 1d6+2 at level 6 is 1d6 at level 4 and 1d6+3 back. Strike damage
9.8% (4.7%), area damage 9.3% (16.1%).

**Dropped dice.** Dice that would push the average past the target are dropped rather
than written with a negative modifier, and they are not added back. A Mindmoppet's 2d12
at level 5 is 1d12+6 at level 4 and 1d12+7 back. Strike damage 2.1% (1.9%), area damage
9.8% (15.0%).

**Current HP at zero.** Current HP moves with max HP but not below zero, so damage taken
past that is forgotten. A Runt with 15 HP left at level 3 has 0 at level 1 and 19 back.
Current HP 0.3% (0.2%).

Area damage has only 1,250 round trips in the packs (193 within 2 levels), so its rates
are rough.

Also worth knowing:

- The tables are Starfinder GM Core's. Pathfinder GM Core's differ in the extreme
  attribute modifier at levels 22 and 23 (+11 rather than +12).
- Players use their class DC for Area Fire and Auto-Fire. Creatures have no class DC
  table, so an area attack's DC is rated on the Spell DC table, the table GM Core gives
  for creatures' ability DCs; GM Core does not say so for Area Fire itself.
- A column a level lacks, such as an extreme attribute below level 1, is read at the
  nearest level that has it. Levels above 24 are rated as level 24, so moving between
  24 and higher levels leaves the numbers unchanged.
- Damage dice added by rule elements (sneak attack, property runes) are not counted in
  a strike's average. Persistent damage is not scaled.
- The header's compendium link opens the original stat block, the way to see the
  numbers before any rescaling.

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

Set `PF2E_PACKS_DIR` to the `packs` directory of a
[pf2e](https://github.com/foundryvtt/pf2e) clone and `npm test` also checks every strike and area attack in
the pf2e and sf2e packs rebuilt at every level and adjective.

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
