# Tree Shield and Tree Wall

Both enemies now compose the shared passive birth body and native ordinary melee sequence. The build-only single-mode body contract is shared with Siegebreakers, so future bodies can add validated data without copying combat code.

Their two-second root birth delay holds movement, targeting, blocking and attacks. The native idle-when-born flag maps to a looping Idle pose during this delay. Attack lasts 42/30 seconds and releases physical damage at 17/30 seconds. Control cancels pending releases; death removes only the birth component’s owned visual. Attacker hit rate and defender dodge remain independent checks in the ordinary damage pipeline.

The source gate verifies the record, root, sole mode, combat packet, target-source binding, animator aliases and exact native clock. Shield and Wall adjacency spawning belongs to the stage device and remains gated for the stages phase. This admission does not claim implementation of that device or native callback/frame parity.

Fifty focused integration/regression tests pass. Desktop and touch fixtures verify no early attack, an unblockable birth phase and a release 0.5667 seconds after attack start, with no runtime errors. Both original bodies decode all six clips and render in desktop/touch galleries. Their textures differ, so no shared-model alias is appropriate. Artwork is pinned to asset commit bd647f40d47388bfe1712ace4bacd05ba1a5673b.

Enemy coverage increases from 723 to 725 (790 database levels). Existing 970 stage graphs remain pinned until the stages phase; no new stage availability is claimed.
