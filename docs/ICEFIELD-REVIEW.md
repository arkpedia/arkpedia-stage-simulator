# Icefield enemy review

The two Icefield Warrior, two Icefield Hound and two Frigid drone variants are
registered through exact prefab, attack and passive-buff predicates. The native
receipts retain their common-ability references and original serialized bodies.
Warriors use ordinary physical melee attacks. Their native NoCombat helper has
no selector, buff or executable action; its companion only names cold/frozen
visual effects. The helper therefore adds no combat state to the simulation.

Hounds and drones share one permanent resistance handler. The checksum-pinned
native buff database declares `status_resistance[inf]`, infinite lifetime,
non-silenceable behavior and the `ONE_MINUS_STATUS_RESISTANCE` final scaler.
Their original override is -0.5. The shared status engine halves supported
status durations and retains this resistance under silence. Hounds use ordinary
physical melee; drones use ordinary ranged physical direct damage. Their native
attack components contain no projectile or additional status payload.

Tests cover mutation rejection, all six support decisions, actual physical hits,
permanent resistance, silence, stun, cold, freeze and sleep. The supported-enemy
catalogue sweep exercises every registered record. BI-1 has atomic addition,
browser startup and complete wave-schedule receipts, and remains developer-only.

All six original Spine bodies are imported through native prefab bindings into
the shared SD asset store. Desktop and touch galleries decode every clip and
check finite poses. Attached cold/frozen visuals and drone attack effects are
not rendered. Ordinary attacks retain the common simulator attack scheduler;
native first-hit animation-event sequencing and compiled frame parity have not
been established. These additions do not implement Blizzard, later Kjerag
specialists or bosses.

## Icefield Casters

Both variants reuse the Yeti charged-Cold projectile controller. Their native
selector admits two ground-motion targets, with camouflage respected. Each
ordinary volley earns one SP even when it launches two shots; with two charges,
the third volley spends them and applies five-second Cold on impact to each
recipient. Both ordinary and charged projectiles home at ten tiles per second,
have a ten-second lifetime, and survive source death. Cold remains independent
of damage dodge through the shared payload path. The original charged projectile
key contains a literal space (`projectile_enemy_krgscr _s1`); source matching
preserves it rather than normalizing the identifier.

Permanent resistance uses the same handler as Hounds and Frigid. The original
record's silence immunity is retained. Mutation tests cover the selectors,
projectile identity and resistance; runtime tests cover two-target damage,
one-charge-per-volley accounting, five-second Cold, defensive SP, flying-motion
exclusion and released shots after source death. Both original Spine bodies are
shared assets. Native first-hit sequencing, projectile VFX and compiled frame
parity remain outside this registration. Other stages still require Blizzard or
additional enemy families; adding these Casters does not bypass those gates.

## Berserkers (2026-11-15)

The two Berserkers now reuse the same permanent 50% status resistance as the
Icefield Hounds, Drones and Casters, plus the existing Frozen-target attack
multiplier. Their source uses a namespaced blackboard key stripped into the
Frozen buff: 1.6× for the ordinary variant and 2× for the leader. Multiplication
precedes DEF mitigation. The separate Cold-only template has no supplied scale
and its default is 1, so Cold alone adds no damage. No duplicate combat runtime
or per-stage implementation was added.

Source admission checks the normal melee mode, inert null general-ability slot,
resistance database entry, blackboard stripping and both conditional damage
templates. 182 regression tests pass, and an additional original-wave integration
test passes for BI-EX-6 and Challenge Mode. Those two stages now compile directly
from source; with elevated test life and no deployments, every planned enemy
spawns and exits, both wave schedulers complete, and no runtime errors occur.
This verifies schedule execution, not an ordinary squad's successful clear.

The loadable library reaches 907/3,892 stages and 682/2,163 enemies. All 907 stages
pass ten-second smoke checks. Both original bodies pass desktop/touch review
across ten clips; the desktop gallery was inspected. Shared asset validation
reports 3,758 complete models, with 478 additional enemy artwork records.
