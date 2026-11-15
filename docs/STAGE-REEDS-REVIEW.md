# Reeds and Special Ops Soldiers

Reeds uses one stage-owned controller for unlit, burning and cooling tiles.
The three source tile variants share their effect code; their height and
placement rules remain in the original geometry. Stage rules provide ignition,
extinguishing and cooldown durations, Arts damage and Burn buildup. Unknown
selectors, duplicate overrides, extra tile effects and map mismatches fail
compilation. Adding another compatible stage requires its source data only.

The retained native tile prefabs and action templates establish the targeting,
buff ownership, three modes and result logging. Unlit Reeds grants allies 0.2
seconds of invisibility on entry and camouflage while unblocked. Burning Reeds
removes the camouflage and applies the source Arts damage and Burn each second.
Enemy contact markers are separate: Special Ops Soldiers and their elite
variant gain invisibility only in unlit/cooling Reeds. Their native checker
removes it on attack or blocking and restores it three seconds afterward.
Silence does not disable these source passives. Underlying stealth sources
remain compatible with the shared Rover reveal aura.

Original `x-5` range data gives the four orthogonal spread neighbors. The timer
orchestration follows the documented [Reeds behavior](https://arknights.wiki.gg/wiki/Reeds):
unoccupied burning tiles spread after the configured interval; allied occupancy
prevents spread and eventually extinguishes them, followed by a cooldown.
The default values are 15, 20 and 5 seconds. Occupancy changes restart the newly
selected timer in this implementation. Exact native ticker bodies and their
pause/reset semantics have not been independently verified; this remains a
simulation assumption. Contact scans use 0.1-second intervals. The retained
[ReedTile class reference](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/ReedTile.md)
identifies separate ignition, extinction and cooldown tickers but has no bodies.

Ignition requests go through `StageReeds.ignite`/`igniteAll`; enemy abilities do
not copy the terrain machinery. Spread transitions are collected before being
applied, preventing map insertion order from advancing newly lit neighbors in
the same tick. Each allied contact owns an independent damage clock. Leaving
clears derived camouflage; the short entry invisibility expires independently.
Reentrant damage checks the recipient life before applying its elemental rider.

The client outlines unlit, burning and cooling tiles in green, orange and blue.
These are simplified state indicators, not original flame VFX. Results expose
copied `tile_reed_mode` records and a readable count of tiles in each state.
Mire entry counters also have a readable result label.

FC-1 now compiles both shared terrain programs and its original waves. Other
Firelight stages remain blocked when they require unsupported enemies or rules.
The checkpoint has 631/2,163 supported enemies and 828/3,892 loadable stages.
The integration suite passes 223 checks; all 828 available stages pass the
ten-second runtime smoke. This is not a playable-clear or full-fidelity certificate.
Desktop and touch Chromium load original FC-1, deploy onto Reeds, verify concealment,
apply diagnostic ignition, observe 40 Arts damage and 40 Burn buildup, and show
13 copied tile outcomes after a forced result. The test does not claim to clear FC-1.

Original Special Ops Soldier artwork is pinned to shared SD commit
`cbc99a687537ff79f21f29d1db68b83db959335b` (local, not published). Both variants
have distinct textures and exact native bindings. The store passes 93 tests
and validates 3,692 models. Desktop and touch decode all ten combined clips;
both idle bodies were visually inspected. The enemy artwork registry has 419 entries.
