# Silvernwhite Bulwark

Silvernwhite Bulwark now composes the existing passive birth body and presence gauge. The native passive owns immobility, displacement protection, +1 taunt and a signed alive-count contribution together. Removing that passive clears its effects and decrements its contribution once. Death, leakage or a later repeated removal cannot decrement another instance.

The presence component now accepts validated body flags and stat modifiers. A rejected attachment does not create a contribution. If recording the contribution would overflow, attachment effects are rolled back. Ordinary presence-gauge plans retain their existing parameters and behavior.

The root’s one-second birth delay uses the existing shared action/targeting protection. Its native animator has no animation clips or Spine binding, so the body explicitly supplies no birth clip. No Start animation or replacement artwork is invented. Native mesh artwork remains pending; the separate trap/controller interaction is not covered by this actor fixture.

Admission checks the non-attacking record, root/mode, original mesh-animator scope, passive attributes, taunt formula and exact +1/-1 result actions. Native flags 22/8 correspond to UNMOVABLE_PRIVATE/UNBALANCE_IMMUNE; the shared engine maps them to movement and displacement protection. These enum names are also present in public metadata declarations; those declarations do not prove compiled callback ordering.

Fifty-two focused regressions pass, including owned effects and rejected attachment. The additional presence/overflow checks pass, and the actor remains immobile even under a foreign movement-speed grant. Desktop/touch fixtures verify the birth gate, no invented clip, taunt, displacement protection, independent live contributions and cleanup. All 970 published stages pass ten-second runtime smoke. The broad suite has 1,801 passes, three skips and the same two known Chimera failures. These checks do not certify native frame ordering or original-stage clears.

Combat admission increases from 732 to 733 enemies (798 database levels). Existing 970 stage graphs remain pinned until the stages phase. Original mesh delivery and trap-owned placement/lifetime remain pending.
