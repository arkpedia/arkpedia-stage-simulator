# Expletive and Profanity

Both enemies now compose one shared marked-target melee component. Their blocker receives ordinary physical melee through Attack; an unblocked enemy can instead select a marked ground target through its native circle and use Skill. Both casts use the existing ordinary attack sequence, captured deployments, cooldown receipt and damage pipeline. The native Skill packet is a direct melee-damage action, not a projectile or an SP skill.

Attack lasts 50/30 seconds and releases at 28/30 seconds. Skill lasts 1.5 seconds and releases at 23/30 seconds. Removing a selection marker after capture does not replace the captured target; a vanished deployment receives no delayed hit. Control and source death cancel unreleased damage. The source circle has radius 1 with a unit local transform; the lightweight selector includes the ordinary ally collision body and retains the core blocker/taunt/deployment ordering. Native callback, dynamic range scaling and frame parity are not certified.

The source gate checks the sole mode, ordinary and ranged-triggered simple-melee packets, marker filter, ground-target scope, exact circle/transform, animator bindings and exact native event clocks. Shared packet validation is factored out of the ordinary body contract. The shared sequence now exposes its captured attack context to its animation selector. Geometry retention uses the existing explicit geometry scopes, including Weaksauce, instead of another extraction branch.

Sixty-six admission/loading/ordinary-body regressions and 25 geometry/contact regressions pass. Desktop and touch fixtures verify unmarked rejection, marked Skill releases at 0.7667 seconds, blocker Attack releases at 0.9333 seconds, and one defence-reduced hit per cast. Both native bodies decode all six clips and render correctly. Textures differ, so the models are not aliased. Artwork is pinned to asset commit 474b8f0f9f8a849af31db9828d015fa01d67a603.

Combat coverage increases from 728 to 730 enemies (795 database levels). Sapidity creation and marking remain stage-device responsibilities; the fixtures inject the native marker explicitly. Existing stage graphs stay pinned until the stages phase, so this admission does not claim a Sapidity device or an original stage clear.

All 970 published stage graphs pass ten-second runtime smoke; this is not a playable-clear or fidelity certificate. The broad suite reports 1,801 passes, three skips and only the two known Chimera failures.
