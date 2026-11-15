# Originium Flow Generators

The retained trap_013_blower and sktok_blower native records describe the same
directional range at both skill ranks. Original stage instances supply level,
rank and direction; missing or unknown values fail preflight. One controller
serves every instance without duplicating character assets or stage scripts.

The four-cell range includes the device tile and the three tiles ahead. It
does not rewrite terrain or occupy a deployment slot. Operators facing along
the flow receive additive +30% ATK; operators facing against it receive a 0.7
final ATK multiplier. Perpendicular facing has no modifier. Isolation and
target-free states exclude recipients; airborne operators remain eligible.
Summons and devices are excluded by the original character/profession filter.

Enemies receive their first direction check after the retained 0.3-second
interval. Actual movement updates the direction used by later checks; standing
retains the last direction. Tailwind adds 80% movement speed at rank one or 50%
at rank two. Headwind applies a 0.5 final movement multiplier. Perpendicular
movement clears this modifier. Target-free enemies and enemy healers are
excluded; airborne enemies remain eligible. Existing movement modifiers combine
through the shared stat system, including ordinary slows.

Overlap uses one source-owned modifier per recipient, retaining its owner until
that source is no longer eligible and then choosing the first remaining original
instance. Leaving range, isolation, retreat and removal clean up that modifier.
The native UNIQUE families and remove-on-leave flags support nonstacking aura
ownership; compiled arbitration and derived-buff lifetime ordering have not been
verified. Those are explicit local policies, not a claim of original client
frame parity. The 0.3-second float interval is quantized to simulator ticks.

The inspector shows direction and permits retreat. Preplaced devices have no
paid deployment cost or reusable card in the simulator, so retreat refunds no
DP. Native withdrawal permits retreat with a 0.5 recovery ratio; original client
refund accounting for preplaced devices remains unverified. Current rendering
uses the shared device marker and highlighted range; native wind effects/audio
are not implemented. Environmental variants changing perpendicular ATK penalties
remain blocked until their original rule is implemented.

Focused tests cover source rejection, both ranks, additive versus final stat
formulas, overlapping owners, retreat, cleanup, isolation, air, moving-enemy
direction changes and excluded recipients. Stage receipts separately record
browser startup and complete no-deployment wave/route sweeps; these do not prove
playable clears or complete native fidelity.
