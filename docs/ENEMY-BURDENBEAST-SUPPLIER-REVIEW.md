# Burdenbeast Supplier components

Burdenbeast Supplier (`enemy_4007_murino`) and 'Timidthy' (`_2`) use one
parameterized controller. All database levels retain their own HP and attack;
the original Weakness values select 85% and 95% frontal Physical/Arts reduction.
The controller shares Fatty's operator-count facing helper and the common
conditional Sanctuary channel. Same-column, rear, True and sourceless damage
bypass the frontal condition; ordinary Sanctuary does not multiply it again.

The pinned native `Direction` toggle is active only while unblocked. It polls
every float32 0.3 seconds, counts the eight ordinary operator professions,
ignores targetability, includes flying operators and retains facing on a tie.
Block/unblock events reset the polling interval even between simulation ticks.
While blocked, ordinary melee attacks face their target. The Supplier remains
blockable, attacks normally and has no Fatty backward-walking or Special mode.
Silence does not disable either facing or the passive frontal protection.

`TriggerBonus` filters out REACH_EXIT and OTHER finishes. A killed Supplier,
including a fall, dispatches one `stageEnvironmentTrigger` to
`env_010_cooperate`, with the original unit as source and no named event.
The stronger variant uses a different visual template but the same dispatch.
An absent environment has no gameplay effect. The cooperative environment
controller itself is not implemented: source stages requiring it remain blocked
by environment admission. Dispatching the source action does not certify those
stages or fabricate cooperative rewards. Native particles and audio are not
rendered by this controller.

Source evidence retains both prefabs from `battle/enm_pfb_21.ab`, their referenced
blocking checker, passive templates and ordinary attack fields. Original bodies
and exact skeleton event metadata come from `refs/arts/enm_art_19.ab` at the
pinned CN resource version `26-09-22-07-47-20_6c71fa`. Both ordinary Attack clips
last 1.5 seconds and contain an OnAttack event at float32 0.4 seconds. The common
enemy attack engine consumes the clip metadata; this change does not replace
that engine's melee scheduling or claim native frame parity.

The shared SD repository pins the two models at
`cafe7348a501fa27eaff5bd600a8544033389308`. Stats and stage records refer to the
same model entries. The models have distinct original bytes, so no artificial
shared-model alias is introduced.

Focused regressions cover every database level, frontal damage and stacking,
source mutation rejection, the block/poll transition, ordinary melee attacks,
kill/fall/leak/removal triggers, and the existing Fatty and Flux behaviors.

Validation: 631 enemy/engine regressions and all 863 available stage ten-second
smoke checks pass. Support rises to 646 of 2,163 catalogue enemies; these two
variants do not independently unlock stages whose cooperative environment or
other mechanics remain unavailable. The shared SD checks pass 93 tests and
validate 3,705 complete models. Desktop/touch galleries decode all ten clips
across the two bodies with no browser or asset errors; the mobile gallery
was visually inspected. Gallery checks certify asset delivery and finite poses,
not battle frame or pixel parity. See
`data/arkpedia-enemy-burdenbeast-supplier-review.json`.
