# Firelight Guards and Spec Ops

Five additional source enemies now use shared mechanics: two Dublinn Flamechaser
Guards and three Spec Ops variants, including The Brigadier. They unlock ten
more stages through the source loader, bringing this checkpoint to 642 supported
enemies and 855 loadable combat stages. No individual stage combat code was
added. FC-8 and FC-EX-8 remain blocked by Eblana's unreviewed mechanics.

Guards reuse the Soldier ember lifecycle with ten hit-count HP. Both native
forms retain the Guard marker, use their own buff-template names and play a
1.2-second Revive animation. Their ordinary attacks gain Burn near burning Reeds.
The second aura buff resolves through the original `damage_resistance[inf]`
database record and `damage_resistance` template: 50% Physical/Arts reduction,
non-stacking and not silenceable. Runtime protection uses the existing Sanctuary
channel, so a stronger reduction wins; true damage remains unchanged. A damage
hook refreshes terrain membership before mitigation, including ignition or
movement during the current tick. Ember entry removes that ordinary-form buff.
The Soldier review's inherited transition and block-release assumptions remain.

Spec Ops use `chargedMeleeSequence`, a reusable attack-recovery cast accepting
source release events, duration and damage scale. Three ordinary attacks charge
MultiAttack. The next eligible combat action spends the charge, locks one target
and delivers five strikes from the original Skill events: 0.3, 16/30, 1, 40/30
and 55/30 seconds, in an 82/30-second clip. The Brigadier uses 1.2× ATK; the other
two use 1×. The events share an attack ID and cannot recover another three SP
from their five strikes. Stun cancels future strikes, a dead/retreated target
is not replaced, and Slow Down stretches the clock. Silence prevents starting
a charged cast while ordinary attacks can still fill the three-SP capacity.
The reviewed wrapper does not reset the ordinary cooldown when its cast ends.

Their separate ignition buff checks the current tile every 0.1 seconds, even
while silenced or stunned. It calls `StageReeds.ignite`, sharing all existing
spread, cooling and extinction logic. Only Reeds under the unit ignite; cooling
Reeds refuse re-ignition. Both the skill and ignition action graphs have source
gates that reject changed counts, retargeting, cadence and damage scale.

These are simulation contracts backed by serialized native components and
skeleton events, not executable native controller parity. Ordinary melee attack
startup still follows the existing enemy attack scheduler. The exact native
ordering of attack-SP readiness, combat cooldowns, interruption and action
selection has not been certified frame by frame. Attached weapon/shield particle
effects are not rendered.

Five distinct original bodies and their source receipts are stored in shared
SD asset commit `9373c18391fe70f19fd9f78f29490d05a5a69442`; all use the pinned
`enm_art_12` bundle. Both Guard forms share one body per variant. Model adoption
updates the on-demand index in the same operation. Desktop and touch galleries
decode all 40 clips. Guard stage reviews cover ten-hit ember entry, revival and
final death on FC-6/FC-EX-6; Spec Ops reviews exercise each five-event combo on
FC-7/FC-EX-3/FC-EX-7. These are diagnostic browser checks, not playable clears.

Validation includes 330 focused/regression tests, 93 SD tests, 3703 validated
complete SD models and 855/855 ten-second stage runtime smoke. The source gates,
operator component graph and static runtime footprint are checked separately.
Historical hashes and browser evidence are retained in
`data/arkpedia-enemy-firelight-melee-review.json`.
