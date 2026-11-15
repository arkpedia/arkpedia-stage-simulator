# Beach buggies and shared enemy passengers

The Fully-Enclosed and Competitive-Grade Beach Buggies own a shared
EnemyPassengerContainer. Loading keeps the original enemy object, HP, buffs,
deployment identity, wave membership and result accounting. It does not create
replacement spawns or award defeat credit. Each carrier holds at most three
eligible ground, non-Machine, non-Boss enemies; isolation, sleep, hidden bodies
and the carrier marker prevent inappropriate selection.

Passengers use the core hidden state and a suspended route deadline. Their
ordinary cooldown and route stop, they cannot be targeted or blocked, and their
position follows the carrier. Existing buffs retain their own duration behavior.
Entering the hidden state now immediately notifies the shared native cast
controllers, cancelling an unfinished cast consistently with their canAct check.
This avoids resuming an old pending strike when a passenger is released.

Defeat releases the same identities near the carrier, using independent copies
of its remaining route and wait state. Source square scatter is .2 tiles, with
local bounds/passable-ground checks. Source exit accounts for each passenger's
original leak once; timeout retains the original enemy identities. Center-point
pickup within the retained .5 collider, spawn-order selection at capacity,
hidden-state suspension, route-copy timing, exit accounting and bounded scatter
are explicit local mappings, not compiled-client ordering claims.

Both native prefabs have blockVolume three. They now occupy three actual slots
instead of only checking the blocker's nominal capacity. The shared block-weight
feature continues to handle this alongside the existing Bully implementation.
The source admission contract checks both roots, passive marker, capacity,
selector/validator, contact collider/transform, rank/motion masks, host-route
release settings and ordinary combat payload. A reusable geometry scope in the
source extractor retains contact colliders without another extraction branch.

Nine focused cases pass, including preservation, filtering, blocker/cast release,
route/cooldown suspension, independent unloading, exit/timeout accounting and
three-slot blocking. Original KR-2 and its challenge variant complete their full
wave schedules under controlled kills. The combined suite passes 229 tests;
all 959 available stages pass ten-second constructor/runtime smoke checks.
Both original bodies pass ten clip checks on desktop and touch; the desktop
gallery was inspected. The asset repository validates 3,783 complete models.

Passenger visual effects, compiled-client selection/suspension semantics,
native particles/audio and frame/pixel parity remain outside this review.
Two reusable carrier records unlock three stages. Admission reaches 706 of
2,163 enemies and 959 of 3,892 combat stages.

A subsequent integration check also covers boarding and releasing during the
same simulation tick: entering the hidden state now immediately ends an active
push/pull through the shared displacement controller. Field-wide liberation
also resets ordinary prisoners' attack intervals exactly once, matching the
native controller's external liberation behavior. The integration suite passes
224 tests across prisoners, devices, carriers, displacement and enemy features.
