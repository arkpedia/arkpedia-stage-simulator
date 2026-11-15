# Visibility auras and Mire immunity

Swamp Rover and the elite variant share one source-gated visibility aura and
Mire-immunity trait. The retained original prefabs require radius blackboard
data, opposing-side/all-motion targeting, target-free bypass, non-silenceable
passives and removal when the target leaves or the source detaches. Their
numeric immunity fields are INVISIBLE=9 and CAMOUFLAGE=17, verified against the
existing checksum-pinned enum dump (`koromaru-status-source.mjs`).

The aura suppresses effective visibility flags without deleting their original
buffs. It reveals affected units to all other enemies and aura selectors.
Independent emitters own separate suppression buffs; leaving or killing the
last emitter restores any still-live stealth/camouflage source. Later grants
are suppressed too. Target-free and other independent restrictions remain.
The new buff field admits only the two reviewed visibility flags.

The aura updates each simulation tick and on deployment. It uses the engine's
existing circular range/body convention, including the 0.25 allied collider
radius. Exact native boundary and frame order are not certified. Admission
callbacks recheck source and receiver lives, preventing source death during
buff application from leaving a stale suppression effect.

The permanent Mire marker prevents both movement and ASPD layers in the shared
terrain controller. Ordinary enemies retain their existing accumulation rules.
This does not separately admit original stages whose Mire controller or other
dependencies remain unimplemented. The source registry admits 627/2,163 enemies;
the complete loadable-stage count is 827/3,892 after resolving the empty
activation branches described in `STAGE-BRANCHES-REVIEW.md`.

Tests cover both variants, visibility for other enemies, restoration, overlap,
later grants, target-free bypass, stun, source death during admission, Mire
comparison and source drift. Existing enemy-feature, targeting, healing and
device regressions pass. Original body models are imported into the shared SD
store through exact prefab/animator/skeleton pointers; the variants have
different textures. Artwork decoding is separate from combat fidelity.

The shared SD pin is `4e7508d411438d582c07fe7dfdbeb75c54f2972d` (local commit).
Its 93 tests and full manifest validation pass. Chromium decodes all ten clips
across the two models on desktop and touch; both idle bodies were visually
inspected. The simulator artwork registry now contains 415 enemy model entries.
