# Fountainboil and Rainbowbrew

The pinned records define `DeadBoom.duration=15`, `interval=3`, an ASPD addition
of -40/-50, and zero additional ASPD change per interval. Nonzero periodic
changes remain refused. Both enemies retain their separate four-teaware
`DeadSpawn` feature.

Original `Attack` and `DeadBoom` components, recursive buff templates and both
projectile controllers are retained in `arkpedia-enemy-native-abilities.json`.
Admission checks the Arts attack, projectile speed 5/lifetime 10, ground-only
area selection, radius 1, camouflage handling, source-death continuation, and
the death projectile's radius 1.25. The death template explicitly checks that
the source is not silenced. The ASPD template disables overriding, so distinct
sources stack with separate clocks. Its resistance wrapper is enabled.

Ordinary projectiles reuse the Mortar transport with a circular area selector;
no enemy-specific projectile loop is added. Damage uses live ATK when the source
is alive and launch ATK after death. The death pulse reuses a small
`deathAreaDebuff` factory, also used by the existing Stronghold kit. It uses
one source-keyed ASPD buff per blast, applies resistance to its lifetime and
retains the engine's resistance-aware slowdown clock. Death spawns remain
independent of silence. Escaping does not trigger either death effect.

The circle checks retain the documented midpoint geometry (attack radius 1,
blast radius 1.25). The death projectile is represented as an immediate pulse;
its native lifetime is retained as evidence, not interpreted as a lingering
steam zone. The serialized template's zero periodic change is folded into one
constant debuff. Native derived-buff scheduling and exact animation/frame
parity are not certified. These stages remain developer-only.

Tests exercise travel time, area boundaries, camouflage/stealth/air selection,
source death during flight, silence, four death spawns, independent stacking,
resistance, expiration and refusal of changed source definitions.
