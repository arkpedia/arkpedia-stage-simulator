# Tidal contact damage and vehicle crew dependencies

The shared Tidal splash adapter omitted Corrosion on its primary target. It
now emits one packet for that target as well as each of its four cardinal
recipients. The ordinary primary HP packet is retained; the primary is excluded
from the secondary HP loop. Corrosion scales from current ATK independently of
Arts mitigation and HP barriers. Nonattack damage cannot recursively splash.
The change covers both Tidal Caster and vehicle variants in raw and compiled
execution plans. Five of six regression tests failed before the correction.

The shared `DeathRattle` feature also read its crew ID from the numeric
blackboard instead of the string blackboard. Both caster and dockworker
vehicles consequently compiled without a spawn key or dependency. The feature
now reads the typed string, validates its enemy identity, and declares that
dependency. The normal stage compiler includes those children, applies stage
rules to them and prepares their required behavior before combat. It does not
fetch an unconfigured child after the vehicle dies.

DH-S-3 and its challenge variant now load through this graph. Their original
fivefold Corrosion rule applies to both the vehicle and its crew: ratio 0.8
becomes 4. The shared feature exposes that numeric ratio while string spawn IDs
remain protected. A shadowed duplicate Tidal feature entry was removed; there
is one effective registration for this behavior.

Validation: 195 integration tests, including both variants' complete original
waves with controlled enemy kills and observed crew spawns; all 969 available
stages pass ten-second runtime smoke checks. Browser checks load/restart both
DH-S-3 variants and kill an injected vehicle, observing one crew with ratio 4
and no errors or source-registry requests. No new artwork is duplicated.

These are bounded repairs to existing adapters. The original vehicle
projectile transport, high-tide passives and serialized crew-release timing
still need their broader native review. Stage smoke and controlled wave
resolution are not original-client fidelity certificates. Evidence:
`data/arkpedia-tidal-crew-review.json`.
