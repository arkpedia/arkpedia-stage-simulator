# Individual-stage outcomes

The battle exposes `result().stageOutcomes`: native counter totals and an event
list with the source enemy identity, simulator instance and time. Result reads
return independent copies. Restart creates a fresh account. The public result
panel uses shared descriptors to explain outcomes without an enemy-specific UI
implementation. No run wallet, reward amount or progression is inferred from a
counter name.

Lost Contraption records `trap_758_skzmbx` when killed. Reaching an actual
`tile_end` records `rogue_thief_reach_exit`; a generic leak on another tile does
not. The original counter is one theft event, not an ingot amount. Its ordinary
physical melee attack and zero life-point loss remain intact. Silence does not
disable these native passive logs. Lost Hovercraft reuses the same objective
theft counter, while its kill log uses `killed` with the enemy identity.

Window records `killed` with its enemy identity when defeated. A run caller can
use that event to enter Prosperity. Its original projectile reaches its target
immediately; the shared runtime therefore applies Arts damage at the attack
release without introducing travel time. Both attack and blocked-combat source
components use that projectile. The ten-second birth effect is visual only.

Portal's `ON_OWNER_KILLED` selects the newest-created eligible ground operator,
ignoring camouflage and target-free status and excluding the original
`enemy_entlec_self_mark` buff. Tokens and traps are excluded by its profession
mask. The selected operator's deployment card is removed for the remainder of
the battle, its identity is recorded under `rogue_first_step`, and ordinary
instant-kill handling runs with rebirth permitted. A surviving rebirth does not
restore the card. Leaking and expiration do not invoke this kill event. The
ten-second alert is not an operator-return timer; run return rules remain with
the caller. Simulator creation IDs resolve same-tick ordering, which is not a
claim about native tie ordering.

The native selector's numeric post-filter 34 is interpreted as
`CREATED_TIME_DES` using
[pinned public metadata research](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/evidence/effect-immunity-20261021/selection/enums.json).
That binary extraction was not independently rerun here. The narrow reference
and its source digest are retained in `data/arkpedia-portal-target-reference.json`.
Enemy components, template actions and Window's projectile are independently
retained from the project's pinned source bundles by the existing extractor.

Admission predicates check the source event filters, selector, buffs, card
lifetime, rebirth flag, ordinary combat and projectile transport. Unknown
behavior remains blocked. The shared talent spelling `1` dispatches only to
each reviewed family contract; it is not treated as a generic visual talent.

Behavior tests cover kill versus leak, objective filtering, single delivery,
silence, immutable result snapshots, immediate Arts damage, target order and
exclusions, persistent card removal, rebirth and rejected source drift. The
browser review uses controlled supported-enemy fixtures in the public stage
workspace, checking result text, card removal and restart on desktop and touch.
It is not a normal-play clear, artwork certification or native frame-parity
check. Full stages using these enemies still require their other capabilities.
