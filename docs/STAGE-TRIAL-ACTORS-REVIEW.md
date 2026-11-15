# Trial actors and player squads

The original `isTrainingLevel` option now distinguishes actor-only tutorials
from ordinary stages with preplaced trial operators. The wave program records
`squadMode: fixed|player`. One shared selector drives the battle constructor,
operator dependency loading and preparation UI. Old programs containing fixed
cards remain compatible.

Ordinary trial actors use their source builds, facing, kits and zero-cost
deployment alongside the chosen squad and support. Their source exclusions
apply to player choices, not to the supplied actor. The compiler requires an
explicit source exclusion for each trial identity, preventing two builds from
colliding in the identity-keyed bench. Player squad caps count player choices;
deployed actors still occupy their normal deployment slots.

Hidden actors without an activation action in the selected variant remain
absent. They do not create hidden cards, reserve a player identity or force an
empty squad. Challenge activation runes remain independently gated.

This admits CB-3, OF-6, 11-3 and its adverse variant, plus the normal TW-S-1 and
TW-S-2 variants. The library reached 820 stages. Module overrides and ambiguous
favor interpolation remain explicit blockers rather than defaulting actor
builds. In particular MN-TR-1 still needs favor interpolation review; the
actor-only tutorial branch is tested with a controlled source-derived fixture.

Validation includes ordinary trial exclusions and builds, fixed empty benches,
hidden actor omission, on-demand player/support/actor loading, and existing
fixed-squad and roster rules. Browser reviews exercise the original fixed-card
stages and ordinary trial stages on desktop and touch.
