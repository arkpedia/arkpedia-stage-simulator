# Roadblocks and Giant Mushrooms

Pinned source tables and native prefabs now retain `trap_001_crate`,
`trap_015_tree` and `sktok_tree`. Original static activation and instance checks
apply before admission. Roadblocks share the obstacle body/account with
Battlefield Ruins; Mushrooms and Jammers share independently owned named auras.
Source data and existing fallback artwork are reused across every stage.

Roadblocks have 100 HP, block three enemies, use the native squared blocking
radius of 0.2 and occupy no deployment slot. Enemies normally route around them
at obstacle cost; enemies they block can attack and destroy them. Retreat clears
the obstacle and refunds half the paid cost. Supplied cards use five DP and a
five-second cooldown and can deploy multiple copies from stock. Their placement
must be on a buildable ground tile and cannot newly disconnect a previously
connected original walking route's start and end. Validation uses a hypothetical
grid and spends neither DP nor stock on refusal. Teleport-only connections are
not inferred from an otherwise disconnected ground route.

Original 7-12 cards serialize level zero and no selected skill; R8-10 also uses
no selected skill. The constant attribute curve clamps to its first frame. The
crate skill has neither a prefab nor blackboard effects, so its omission changes
no behavior. Unknown level/skill tuples remain rejected. Older catalogue entries
with unrelated unsupported challenge rules retain those explicit preflight gaps.
TR-8's tutorial-controlled hidden card has not gained a fabricated reveal timer.

Mushrooms grant 150 flat DEF to allied character bodies in their four adjacent
tiles. Isolation does not exclude them; untargetability and sleep do. Same-name
cover does not stack, and a remaining source takes over immediately when another
source dies or loses coverage. Mushrooms occupy no deployment slot, cannot be
retreated and do not rewrite the underlying tile. Temporary Hire clearing and
Tiacauh stump-destruction mechanics still require their respective token/enemy
implementations; stages depending on them remain blocked.

The shared aura correction also admits multiple supplied Jammers (H5-1 and S5-4
provide two): overlapping coverage halves speed once and retains its control
flags until the final covering source leaves. One owner's retreat does not erase
another owner's effect. Original card stock remains the deployment budget.

Tests cover native-source rejection, real obstacle bodies and refunds, route
sealing without side effects, cooldown/multiple stock, aura overlap, isolation,
target exclusion and source cleanup. Six added stages have browser startup and
complete route/wave receipts. Browser interaction checks the Roadblock retreat
button and Mushroom cover/inspector with a controlled adjacent operator. These
checks do not establish original artwork, compiled callback timing or game-frame
parity. New stages remain developer-only.
