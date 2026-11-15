# Signed stage result values and passive presence

`stagePresenceGauge({key, buffKey, value = 1})` is a reusable compiled enemy
component. Each attached passive contributes to a named result value at spawn
and releases its contribution when the passive or its owner is removed.
Death, leakage and expiry share the same idempotent release path. Silence,
stun, hiding and the end of battle do not remove a surviving contribution.
Independent owners share the value and keep their own lifecycle state.

`recordStageDelta` accepts nonzero signed safe integers, records the ordinary
result event receipt, and checks the accumulated total before changing it.
`recordStageOutcome` retains its existing positive-only contract. Both use the
same result snapshot; no second global store, run wallet or progression state
is introduced. The component loads through the existing outcomes module only
when selected enemy plans need it.

The source use case is Silvernwhite Bulwark (`enemy_2047_smtree`). Its pinned
`enemy_smtree_log` template adds one `alive_cnt` on buff start and subtracts one
on buff finish. This primitive does **not** admit that enemy: its native Graphic
has no Spine skeleton, and its original effect/mesh body needs a separate
rendering implementation. The original native inspection is cached at
`.cache/arkpedia/is-objects-native-inspection.json`. An attempted normal body
extraction explicitly refused it in `.cache/arkpedia/bulwark-art/extraction.json`.

`test/arkpedia-stage-presence-gauge.test.js` exercises compiled-plan dispatch,
multiple owners, all removal reasons, repeated cleanup, passive removal before
death, hidden/stunned/silenced survival, result isolation and integer overflow.
