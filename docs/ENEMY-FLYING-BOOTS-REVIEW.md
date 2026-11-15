# Flying Boots mercenaries

The ordinary and elite records use the original PhysicalEvade passive. It gives
40% Physical Dodge against both melee and ranged damage, including when blocked.
It is not removed by Silence, Stun or Freeze. Arts/True damage and explicitly
undodgeable packets continue through the shared damage pipeline normally.

The source's continuing rope trigger finishes the named Physical Dodge buff.
It does not suspend it for a duration or recreate it when contact ends. The
shared triggerEnemyRopeContact entry point dispatches only enemy-owned reactions;
this family removes its own named buff, preserving unrelated dodge modifiers.
Repeated contact is harmless, and newly spawned enemies own fresh passives.
The derived native dodge-effect lifetime is validated; visual effect rendering
remains separate from the combat modifier.

This is the enemy reaction, not a completed Stabilizer Chain stage controller.
Chain construction, geometry, recipient selection, slow and result counters
remain separate capabilities. Stages requiring those unresolved capabilities
remain blocked. This family does not pretend an absent chain system exists.

Admission checks both original passives, nonsilenceable flags, mode combat,
Physical/all-apply-way Evade node, derived effect and exact contact FinishBuffsById
action. Core dodge aggregation, the callback boundary and fixed-tick ordering
are local mappings; compiled-client ordering and frame/pixel parity are not
certified. Normal attacks retain the existing basic attack implementation.

Five focused cases pass. The combined enemy feature/admission suite passes 186
tests. Original BB-1 loads and resolves its full wave schedule under controlled
kills. All 956 available stages pass ten-second runtime smoke checks. The two
original bodies pass ten clip checks on desktop and touch; the desktop gallery
was inspected. The asset repository validates 3,781 complete models.

Two reusable records unlock one stage. Admission reaches 704 of 2,163 enemies
and 956 of 3,892 combat stages.
