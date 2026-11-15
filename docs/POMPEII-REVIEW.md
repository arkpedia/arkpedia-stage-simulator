# Pompeii

`enemy_1050_lslime` now has one shared factory for both imported database levels
and the legacy boss catalogue. Admission checks the retained original mode,
attack, talent components, buff templates, selector geometry and shared projectile.
No duplicate models or stage-specific behavior are introduced.

The ordinary attack launches up to four ground-targeted homing projectiles at
speed 6, with five-second lifetimes. Each carries its independently unmissable
burn payload. The burn lasts ten seconds, ticks every 0.33 seconds for the
record's fixed Arts damage, has no hook-visible source and grants no damage-taken
SP. Refresh retains its instance and tick cadence; it continues after Pompeii
dies. It is ordinary periodic Arts damage, not Burning elemental buildup.

The blocked-only timer pauses while unable to act and resets on unblocking.
Every ten active seconds it applies the record's fixed Arts splash damage within
radius 1.4, excluding air and stealth while including camouflage. Attack buffs
do not change its fixed base damage. Source/recipient damage modifiers still
apply through the existing damage pipeline; the application has no melee/ranged
path. The retained native HP checker is reversible and includes its upper
threshold: at or below half HP it grants only the record's ASPD. The level-1
`selfbuff.atk` parameter has no native modifier and is intentionally unused.

Evidence: `data/arkpedia-enemy-native-abilities.json`, pinned Global enemy records,
and the corroborating [PRTS page](https://prts.wiki/w/“庞贝”). Gameplay mappings
are tested; native client-frame parity and exact effects are not certified.

`test/arkpedia-pompeii.test.js` covers both levels, flight delay, four targets,
burn refresh/death/evasion/SP behavior, reversible HP buffs, blocked clock reset
and control pause, fixed damage and radius, target eligibility, and rejection of
altered native evidence. Existing boss, stealth splash and airborne-debuff
regressions also pass. The airborne regression now recognizes the corrected
sourceless burn.

FA-6, FA-6 Challenge, OF-8 and OF-F4 retain original rules and are developer-only.
Browser startup and full no-deployment wave sweeps passed. Raised-life route
sweeps are not playable clears or fidelity approval; their scope is retained in
each stage's validation receipt.

FA-6 and FA-6 Challenge override burn damage to 15 and blocked blast damage to
750. These original level values were absent from the map export. The shared
literal-parameter compiler now retains them before challenge multipliers, with
an atomic refresh and stage-specific regression tests.
