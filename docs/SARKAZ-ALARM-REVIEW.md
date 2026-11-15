# Sarkaz alarms and standby

The two Sentinels and four standby mercenaries share explicit mode transitions.
The original components, templates and selector siblings are retained from the
verified prefab bundles. The leader's ability-finish buff hook is not a timing
component; extraction now retains it separately instead of inferring it from the
handbook. Both original Sentinel skeletons bind Skill to Skill_Begin, lasting
20/30 seconds. Their alarm does not wait for the clip's OnAttack marker.

A Sentinel checks for HP below 99.9% every 0.2 seconds. The ordinary version loses
its initial undeadable protection when changing mode; the leader retains its
separate protection through its alarm cast. After the record's 0.1-second initial
cooldown, the alarm grants permanent additive ATK/DEF modifiers to current
eligible enemies, including its caster. Each alarm owns a separate grant; later
spawns receive no historical buff, and source death does not remove a grant.
The same action wakes only enemies with the reviewed native slumber state.

Standby is disarm, with an independent temporary self-bind (normally 150 seconds).
Expiry permits movement but does not enable attacks. Injury below the original
HP threshold or an alarm switches mode once, removes both restrictions and adds
200% movement speed, giving three times base speed before other modifiers.
This replaces the previous stun, timer-based wake and x2-speed implementation.
Grudgebearer/Worldcurser select two ground targets. Their Arts damage is direct
with a melee application path despite ranged selection; no projectile is invented.

Admission is narrow and rejects changed HP listeners, mode bindings, target
selectors, buff modifiers and finish templates. The original caster pre-delay
and skeleton event clock are retained for further attack-timeline review; its
ordinary attack still uses the simulator's common attack cycle. Exact native
attack and mode-change frame parity and visual effects remain unverified.

Tests cover all six variants, self-bind expiry, injury and alarm wake, additive
speed, independent alarm stacking, late spawns, protection boundaries, source
death, ground targeting, damage path and altered native evidence. The existing
standby test now waits for the actual polling period and asserts disarm/self-bind
instead of the old stun approximation.

Corroboration: [Sentinel](https://prts.wiki/w/萨卡兹哨兵),
[Sentinel Leader](https://prts.wiki/w/萨卡兹哨兵组长),
[Grudgebearer](https://prts.wiki/w/萨卡兹积怨者),
[Bladeweaver](https://prts.wiki/w/萨卡兹魔剑士).

AW-8, AW-8 Challenge, BW-3 and DM-6 are developer-only additions. DM-6's original
level overrides `revive.unmove_duration` to zero; its mercenaries move immediately
while remaining disarmed. The override is retained through the shared stage
parameter compiler, with runtime coverage. Browser startup and complete raised-life
wave sweeps are recorded per stage, not represented as playable clears.
