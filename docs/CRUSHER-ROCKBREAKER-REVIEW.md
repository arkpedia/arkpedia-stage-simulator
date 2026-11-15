# Defense Crushers and Rockbreakers

This addition covers Defense Crusher/Leader (`enemy_1045_hammer`, `_2`) and
Rockbreaker/Leader (`enemy_1048_hirman`, `_2`) in regular stage battles.

## Retained source

The enemy catalogue supplies all database levels and the native clock index
identifies the exact original components. `extract-enemy-native-abilities.py`
now retains `StunCombat` and `MagicResistance` only for these four prefabs,
including referenced block checkers. Their original bytes come from the pinned
CN `battle/enm_pfb_4.ab` bundle, resource `26-09-22-07-47-20_6c71fa`.
The extractor verifies bundle hashes and each indexed component's original hash.

Crusher records have attack-recovered SP, initial SP 0, maximum/cost 2,
increment 1, initial cooldown/cooldown 1 second, and `stun: 7`. Their wrappers
are silenceable and interruptible. The cast uses the ordinary Attack/Idle pair,
physical damage at 1× ATK, the current single target, and the database stun buff
with status resistance enabled. It has no area selector. Admission checks those
properties and cannot fall through to another `stuncombat` family's predicate.

Rockbreakers start at 40 RES and have a flat blocked bonus of 40 or 50. The
native toggle uses the block checker (minimum 1, no maximum), applies one
`hirman_t_buff` to itself, and has no blocker or toggle-off effects. Its sole
modifier is additive RES loaded from the talent blackboard. The buff is
silenceable; these source enemy records themselves have silence immunity.

## Runtime and checks

Crushers recover up to two charges from completed ordinary attacks. A following
eligible attack spends them on a single-target stun. Silence suppresses that
cast while normal attacks continue charging; control pauses spend nothing.
The source initial/repeat cooldowns remain gates if stage overrides accelerate
ordinary attacks. The existing shared area-stun implementation remains available
for enemies whose source actually specifies an area.

Rockbreaker RES is attached at block acquisition and removed synchronously for
single-enemy and batch release. The common feature dispatcher now forwards both
forms of the engine's `unblocked` event. Tick and incoming-hit reconciliation
also prevent a stale bonus after a state change. Repeated blocking never stacks
the bonus.

`test/arkpedia-crusher-rockbreaker.test.js` checks attack order, single-target
selection, silence/charge retention, control pauses, initial cooldown under a
faster stage interval, actual Arts damage, repeated release/reblock, blocker
death and rejection of changed native mechanics. Existing enemy-feature and
blocking tests cover the shared dispatch change.

These behaviors use the simulator's ordinary attack-action clock. This addition
does not establish client animation-frame parity, precisely reproduce compiled
controller transition timing, or supply missing visual assets. Newly compiled
stages remain developer-only pending their complete review.
