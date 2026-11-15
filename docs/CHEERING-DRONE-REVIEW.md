# Cheering Sponsor Drone

`enemy_1106_byokai` uses original `buff` and `KilledToLog` components, the recursive
`projectile_on_killed` template, and `projectile_enemy_byokai`. Their retained
hashes are verified by the native evidence/support tooling. The logging helper
is admitted by the existing auxiliary-component review.

The reward gives +100 ASPD and +50% DEF for 20 seconds in radius 30. The native
selector includes both movement types, operators and summons (profession mask
767), excludes traps, and ignores camouflage and target/heal restrictions.
The native timed buff has override type 4, one effective stack, and shared
identity across sources. Repeated rewards add duration; stat bonuses do not
stack. `Battle.addBuff` now has reusable `addTime` behavior which retains the
original instance, source and modifiers and adds finite time to both duration
and remaining time. It ignores infinite input extensions.

The enum and duration behavior are corroborated by public ArkBattle source at
[c011da5](https://github.com/wfrfred/ArkBattle/blob/c011da5a4d178312f95eae1ee2f294b760d2425b/src/data/effect/stacking.ts)
and its [effect contract](https://github.com/wfrfred/ArkBattle/blob/c011da5a4d178312f95eae1ee2f294b760d2425b/docs/architecture/effect.md).
[PRTS 斗志昂扬无人机](https://prts.wiki/w/斗志昂扬无人机) corroborates the reward,
extended duration, selector exceptions, static body and exclusion from kill
counts. These references supplement the retained game definitions.

The shared `deathAreaBuff` factory applies one destruction pulse. Escaping grants
nothing; late deployments do not receive an aura. The native projectile lifetime
of 0.5 seconds is retained as evidence; exact within-projectile-frame entrant
handling is not certified. Source silence is checked by the original template;
ordinary silence cannot affect this naturally silence-immune drone. Static-body
push/pull exclusion uses the existing no-displacement flag.

The explicit handbook kill-counter trait is normalized before both scheduled
and direct-spawn totals are computed. Setting the flag only on spawn would leave
an incorrect precomputed denominator. Original catalogue records are preserved.

`test/arkpedia-cheering-drone.test.js` checks targets, device/trap exclusion,
finite radius, accumulation/expiry, source identity, counting, escape, silence,
and rejection of changed native semantics. MN-5 remains developer-only after
browser and raised-life wave-schedule checks; those are not playable-clear or
client-fidelity certification. The distinct token-dropping Sponsor Drone still
requires its stage-specific drop behavior.
