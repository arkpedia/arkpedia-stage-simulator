# Sarkaz host release and Mark of Epoch

The level-owned parasite environment now reads the original enemy blackboard
markers rather than copying a parasite talent into each enemy. Marker presence
is intentional: two original entries spell their value `truee`. Only verified
instances of this environment may strip those keys before normal enemy/alias
validation. Other overrides remain subject to their original validators.

A defeated marked host, except a fall death, releases Dreadkaz after the original
0.95-second delay. The summon captures its position and remaining route, receives
its own stats, and does not block the previous wave. The pending summon still
holds the battle open. Dreadkaz cannot recursively release another unless both
original marker keys are present. The level compiler includes the environment's
spawn dependencies in the same transitive record graph as enemy death children.

Dreadkaz's birth buff finishes after 0.1 seconds: it deals 50% ATK Arts damage in
the original nine-tile range and summons a Mark for 30 seconds. The native action
explicitly includes all motion modes. Concealment and target-free selection
still apply to the blast. Finishing that buff through early owner removal uses
the same action once, with a guard against the pending timer firing it again.
This models the retained ON_BUFF_FINISH contract; sub-frame client callback
ordering is not independently verified.

Mark of Epoch has the original neutral side, no attack, no movement, target-free
and invincible flags. Neutral actors have their own battle collection and do not
enter enemy selectors, counters, wave-clear checks or victory waits. The small
engine properties are owned by the atomic enemy feature and applied when records
are compiled or normalized for a StandardBattle. Original catalogue records are
not mutated. Its original EmptyAnimator has no missing body to substitute.

A reusable TileBuffField combines emitter tiles while maintaining one recipient
clock. Overlapping Marks do not multiply damage or restart the clock when one
source expires. An eligible ally receives 100 sourceless apoptosis accumulation
per second after its first interval. The filter tag `rogue_4_skhbox` exempts a
recipient. Leaving the field, losing eligibility, or redeploying resets contact.
Enemies receive the original empty marker on the 0.3-second scan. The separate
withdrawal-lock disaster remains unsupported at stage admission.

Validation covers source mutations, the complete host → Dreadkaz → Mark chain,
route retention, fall/expiration exclusions, forced recursion, neutral scheduling
and counters, overlapping fields, contact reset, concealment, flight, immunity,
Arts mitigation and Mark expiry. All 684 registered enemy records also pass the
shared spawn/runtime sweep. All 907 loadable stages pass the ten-second smoke
check; this is not a full combat-clear or client-fidelity certificate.

Dreadkaz's original body decodes six clips on desktop and touch; its desktop
render was inspected. The asset store validates 3,759 complete models. Mark uses
a labeled temporary tile overlay; original particles and audio remain follow-up
visual work. Registration is now 684/2,163 enemies. Stage availability remains
907/3,892 because other components still block the related Sarkaz stages.
