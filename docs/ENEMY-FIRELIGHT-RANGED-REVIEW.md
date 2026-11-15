# Firelight ranged enemies and initial burning Reeds

The two Dublinn Cannoneers and two Dublinn Flamecallers now use shared projectile
transport, attack recovery and terrain ignition. Source stage loading admits 13
more stages without a stage-specific combat branch: 637 enemies and 845 combat
stages at this checkpoint. All 845 stages pass a ten-second runtime smoke check;
this does not certify a playable clear or complete native fidelity.

Cannoneers fire two ordinary shots before a 3×3 splash. Their native SP capacity
is three, while PowerAttack costs two. Silence prevents spending but permits
charging, so releasing a fully stored charge leaves one SP. `chargedAttacks`
also serves the existing Yeti family. Released shells survive their source's
death, and splash includes aerial units and camouflage. Original Attack clocks
come from each body's skeleton, with the source OnAttack event at 23/30 seconds.

Flamecaller attacks ignite the recipient tile when their projectile arrives.
The native RangedAttackWithExtraActions event is `ON_HIT_TILE`, separate from
HP damage, so evasion or the target's death does not cancel ignition. The
[public projectile enum evidence](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/evidence/projectile-stop-20261021/order/projectile-events.json)
is retained in `data/arkpedia-projectile-event-source.json`. The
[class declarations](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/Torappu/Battle/Abilities/RangedAttackWithExtraActions.md)
corroborate its event/action fields; these are not executable controller bodies.

The killed-only death buff emits a stationary projectile on the source root
tile. Its fixed circle radius is 1.65; the 1.5 blackboard value does not scale
this non-scalable range. Nearby ground allies receive Arts splash, while tile
selection independently ignites nearby Reeds. Despite the handbook's “all
Reeds” wording, the native tile selector uses that circle. The projectile has
no motion component, a 0.462-second lifetime, only-on-reach hit checks and an
always-reach-at-end flag. The simulator uses that lifetime as its impact delay.
Exact native frame ordering, projectile curvature/mount heights, controller
bodies and native particle effects remain unverified. Source-root rounding and
the shared 0.25 ally collision radius follow the simulator's existing geometry.
The death damage is dodgeable; its independent tile action still runs.

Original Reeds tile blackboards now accept mode 0 or 1. Challenge mode rules
can ignite explicit locations through the same three-state terrain controller.
Source location coordinates are bottom-origin, matching compiled geometry;
FC-EX-4's `(1,10)` and FC-EX-8's six locations verify this convention. Unknown
modes, repeated coordinates, non-Reeds targets and already-burning override
targets are refused. This compiler handles FC-EX-2 and FC-TR-2's initial fires,
and FC-EX-4 challenge ignition. FC-EX-8 still has unsupported enemies.

Four distinct original bodies are stored once in SD asset commit
`859f08bcd43d91eea431a2cfe7272e7022c18f73`. The base Cannoneer, elite Cannoneer and
base Flamecaller use `enm_art_11`; the elite Flamecaller uses `enm_art_12`.
Desktop and touch galleries decode all 20 clips. Actual FC-3 and FC-5 browser
checks load their models through the lightweight index, exercise diagnostic
attacks and ignition, and report no browser/simulation errors. They are not
playable clears. The desktop gallery and touch FC-5 screenshot were inspected.

Validation: 309 focused and legacy regression tests, 93 SD tests, 3698 validated
complete SD models, source-support check, operator-library check and 845/845
stage smoke. The static default two-operator module closure is about 8.43 MB,
versus about 95.97 MB eagerly importing all adapters; this is not measured
network transfer, memory consumption or startup latency. Historical checks and
source hashes are recorded in `data/arkpedia-enemy-firelight-ranged-review.json`.
