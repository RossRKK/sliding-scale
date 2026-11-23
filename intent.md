# Foundry npc module

The idea here is to create a new actor type in the foundry implementation of
pathfinder/starfinder 2e. I personally play using the pathfinder 2e system with
the starfinder anachronism mod for legacy reasons.

The pathfinder rules describe rules for creature creation. What I'd like is an
npc stat block type that instead of using modifiers uses the descriptions:
- "extreme"
- "high"
- "low"
- "terrible"

https://2e.aonsrd.com/rules/989-building-creatures

The idea is that changing the level or adjective for one of the stats on the
stat block immediately updates the stat as shown on the sheet and used by the
foundry system for rolling dice etc. instantly.

This is inline with my software design philosophy of not storing what can be
derived. We store the level and ability adjective for each stat and derive
the actual value at roll time.

When a range is given we use some reasonable scheme to take a fixed value from
the range. Probably the median.

Existing NPCs should have the option to be converted to our type, preserving
their art, name, ability, inventory etc. But converting their stats to our
system using a reverse lookup.
