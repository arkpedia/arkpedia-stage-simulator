# Steam Tank source preparation

Historical source-preparation checkpoint. The implemented adapter is reviewed in
[ENEMY-STEAM-TANK-REVIEW.md](ENEMY-STEAM-TANK-REVIEW.md).

This family remains outside public enemy admission. The original base and
Scorching prefabs, their Cannon components and both shared projectile prefabs
are now retained by the pinned enemy evidence extractor.

Both records have a 25-second Cannon cooldown, ten-second initial delay and .55
ATK multiplier. The cast wrapper selects one maximum-HP recipient (post-filter
19). Cannon's ten-second Skill clip has exactly one OnAttack marker at the
original float representation of 121/30 seconds. Its later audio markers are
not additional projectile releases.

The released skill projectile immediately reaches its destination, does not
follow the target, lives six seconds and stops when its source becomes invalid.
Its selector samples every .5 seconds after waiting the first period, permits
ten hits, and uses the original x-4 nine-cell range and post-filter 45 (highest
HP percentage). Each selected recipient receives a one-shot .2-second delayed
buff applying source ATK × atk_scale as Arts damage. The buff's attack type is
NORMAL, apply way NONE, with ordinary modifier events and source attribution.

The cast-owned protection includes unbalance immunity and stun, silence,
levitation, freeze and sleep immunity. The wrapper is not generally silence
ignoring. This distinction belongs to the lifetime of the cast protection.

Next work: retain the trigger's actual circle/global geometry; verify selection
and destination timing against the relevant native aliases; compose the shared
timed-cast controller with a bounded sampling projectile; test delayed payload
survival versus source invalidation; import and review both original models;
then admit the family and recompile affected stages. Prepared models and clocks
are cached locally and are not themselves public admission.
