# Shared capped barrier recharge

`rechargingBarrierAura` lets independent sources add charge to one named barrier
on each eligible same-side recipient. Definitions supply the period, radius,
addition/cap ratios, damage types, marker exclusions and native target-free
options. Each owner keeps one small tick clock and allocates no scheduled timers.

The first pulse waits one period. Additions use current recipient maximum HP.
A lower maximum HP does not discard charge already above the new cap; further
additions resume after damage brings the budget below that cap. Physical/Arts
barriers can exclude True damage through the existing shield pipeline.

Accumulated charge survives leaving the area and source death. Additional owners
add to the same budget and share its cap. Hidden and sleeping recipients are
excluded, while definitions explicitly control untargetable/isolated states.
Source-specific marker exclusions keep unrelated props out of the effect.

Six component regressions cover those behaviors, followed by runtime-loading
and all 780 admitted-record plan comparisons: 18 tests pass. Invalid periods and
nonfinite rates fail before a recharge loop starts. This component is available
through one lazy runtime index entry; no new enemy admission is granted here.
Saint Statue native binding and body registration follow separately.
