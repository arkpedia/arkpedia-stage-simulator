# Jammers and Portable Supply Stations

Both devices use the common stage supply-card account, placement validation,
cooldown, stock and retreat paths. Original level and skill selection survive
compilation. The stage compiler applies scoped cost/stat changes after resolving
the instance. No stage owns a copied device script or asset.

`stage-range-supplies.js` admits only reviewed native root, selector, aura and
buff-template contracts. Evidence retains `trap_006_antidr`, `sktok_antidr` and
`trap_009_battery` from the pinned client bundles and the corresponding tables.
PRTS [Jammer](https://prts.wiki/w/干扰装置) and
[Portable Supply Station](https://prts.wiki/w/便携式补给站) corroborate the mechanics.

The Jammer costs 40 DP, uses a ranged tile, and occupies no deployment slot. Its
original level determines HP (5-6 supplies level 10, hence 1,000 HP). It has native
taunt level 1, cannot block or receive healing/regen, and remains targetable by
enemies despite being represented as a device. Its range aura selects enemy
characters tagged `drone`, applies Disarm and Silence and halves movement speed.
Other flyers do not qualify. Leaving the range or removing the Jammer removes
its own aura. Enemy creation now preserves source tags in independent unit sets,
which also fixes other tag-dependent targeting and damage abilities.

Portable Supply Stations cost 10 DP and accept either buildable tile type. They
reuse the operator direction picker and native two-tile range. Each eligible
allied character has a four-second clock and receives three external SP per
period. Isolation does not exclude a recipient; untargetability and sleep do.
Leaving/re-entering resets its clock. The shared skill account still refuses SP
for passive skills, held active accounts, and `noSp`. Stations do not become
ordinary enemy targets. Supplied stock permits multiple deployed copies; cards
recharge for five seconds and refund half the paid DP on retreat without returning
stock. Overlapping Jammers share one named effect: movement is halved once, with
immediate fallback to another covering source when one is removed. They use the
same independently owned, non-stacking aura helper as Giant Mushrooms.

Tests cover original levels, changed-source rejection, placement/payment,
targeting, tagged drone selection, speed and aura cleanup, direction, SP timing,
isolation, SP locks and withdrawal. Browser reviews exercise the actual supply
card and direction picker; stage receipts separately record startup and complete
wave/route sweeps. These checks do not establish compiled Unity callback order,
native device artwork or frame parity. Rendering uses the existing shared device
fallback; the new stages remain in the developer catalogue.
