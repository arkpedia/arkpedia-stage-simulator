# Original level enemy attributes and Lancer delay

Enemy attributes now come from the same verified original level blob as its
wave actions and talent overrides. The older map projection can omit immunity
values or contain corrupt fields: DM-EX-6 exported a negative `blockVolume`
that does not exist in the original enemy definition. Both variants now use
the original stun/silence assertions and unchanged database block count.

The shared compiler retains every defined attribute, maps known names, checks
the enemy's database level and rejects unsupported values. It does not mutate
the viewer input or global enemy catalogue. Canonical attributes enter the cloned
geometry before its pathing hash is calculated. Stage-local aliases retain
their separate complete-definition compiler.

The shared Lancer controller now reads a birth-time acceleration delay and a
trigger-attempt budget. The original predelay buff is unaffected by silence,
stun or freeze; its clock continues when acceleration is reset. Suppressed
attempts still consume the trigger budget. DM-EX-3 supplies 170 seconds and 365
half-second attempts, leaving 25 speed additions. The simulator resolves a
same-tick expiry after the trigger; this is explicit timestep behavior, not
client frame-order certification. The challenge's 1.2 multiplier applies only
to the separate movement-speed damage packet, preserving ordinary attack stats.

These reusable changes admit DM-EX-3 and DM-EX-6, each with its challenge variant:
824 of 3,892 combat stages are now loadable. All previous stages were retained.
Validation includes 30 focused compiler/runtime checks, the existing enemy
feature regressions, an 824-stage ten-second smoke run, and desktop/touch
browser checks of the native delay, challenge coefficient and original Sentinel
immunities. The browser runs use controlled high life/time limits and a waiting
Lancer; they are not normal-play clears or artwork certification.

The retained checkpoint is `data/arkpedia-stage-enemy-attributes-review.json`.
