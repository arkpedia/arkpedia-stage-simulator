# Plain weighted main-wave groups

The shared wave compiler retains plain weighted SPAWN and activation alternatives from the
original level and reconciles every conditional viewer row, including its
original route identity. Each group is scoped to its wave and fragment. A
single action is selected before expanding `count`; only selected actions
contribute to runtime spawn totals and fragment duration. Non-random actions
and their timing remain in the same program. All candidate enemies and routes
must pass compilation, including candidates not selected in a particular run.

The battle resolves an immutable copy using a dedicated seeded stream. Combat
randomness does not consume group-selection draws, and equal simulator seeds
reproduce choices without mutating cached stage components. Results expose
copied `stageRandomChoices` entries for inspection. The UI currently creates a
new seed for each start/restart, as it already did for combat randomness.

This is the bounded plain-group selection model. It does not claim the native
PRNG sequence, online mode preparation or data-driven continuation parity.
An empty-string activation key is an explicit no-appearance choice. Selecting it
removes the action, including its delay; a fragment with no remaining actions is
empty. Mixed spawn/activation groups select once across both action types.
Pack links, branches, mixed hidden/random conditions,
non-ALWAYS refresh policies, malformed weights and zero-total groups remain
refused. Legacy flattened compilation cannot silently spawn all alternatives.

Source interpretation follows the fixed original level fields and
[pinned public native scheduler research](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/cases/30-scheduler-action-data-fields.md).
That research distinguishes main-wave preprocessing from branch Pack selection
and externally supplied continuation results. Its binary extraction was not
independently rerun here. No implementation was copied. The simulator's bounded
selection policy is explicit; unsupported mode preparation is not inferred from
the mere existence of random fields.

The terminal `postDelay: -1` source sentinel now becomes zero runtime closing
delay while its original value is retained for viewer-duration reconciliation.
The final wave still waits for clearance. Other negative delays remain invalid.

Behavior tests cover selection before count expansion, selected timing, counts,
clearance, deterministic replay, independent repeated group names, source drift
and refused conditions. Browser review loads the three newly compatible ISW-DU
stages on desktop and touch and checks resolved choices, totals and restart.
These reviews are smoke/controlled checks, not normal-play clears or native
frame-order certification. Multi-floor stages still require their timed
environment and mode controllers.
