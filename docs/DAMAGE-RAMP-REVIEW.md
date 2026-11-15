# Forsaken damage stacks

`enemy_2005_axetro` has one imported database level. The original `AtkUp`,
`Checker`, `Combat`, `Attack`, recursive templates and axe projectile are retained
in `arkpedia-enemy-native-abilities.json`, with the pinned bundle/component hashes.
Admission verifies these components and the exact talent signature: +7% ATK and
+5 ASPD per stack, 28 stacks, four-second rest delay.

The native template listens to `ON_AFTER_OUTPUT_DAMAGE`, rather than attack
attempts. The shared enemy dispatcher exposes that resolved damage event. A
reusable factory adds stacks after damage calculation, never before the first
hit. Missed/cancelled hits do not stack. The native infinite, non-silenceable buff
persists until the combat checker resets it. Its separate visual buff contributes
no gameplay attributes.

The rest checker disables itself during attack/combat states. Runtime engagement
uses the same target-candidate helper as ordinary enemy attacks, so an attack
interval longer than four seconds does not accidentally clear stacks. Losing all
eligible targets or control preventing attacks starts the rest clock. This is a
simulation-state mapping, not proof of exact native animation/FSM boundaries.
[PRTS “遗弃者”](https://prts.wiki/w/“遗弃者”) corroborates damage-triggered stacks,
the cap, four-second disengagement reset and exclusion of airborne targets.

The existing projectile transport now supports locked single-target projectiles
and immediate melee hits against the blocker. The axe travels at speed 10,
lifetime 5, tracks its target, and survives source death using launch ATK; it
reads live ATK while its source is alive. The Stronghold kit uses the same
factories, replacing its old attack-attempt stacking and last-attack reset.

`test/arkpedia-damage-ramp.test.js` checks both dispatch paths, first-hit damage,
misses, cap, silence, long attack intervals, disengagement/control, flight and
source death. Native mutations fail admission. Existing area-projectile tests
continue to pass after the transport extension.
