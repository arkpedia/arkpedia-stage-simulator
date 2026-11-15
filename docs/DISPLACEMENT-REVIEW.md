# Continuous regular-stage displacement

Regular stages now integrate push and pull forces at 30 Hz. One controller owns
the enemy's velocity, unbalanced state, pull duration, stop circle and travel
callbacks. Operator implementations call the existing force API; they do not
implement separate movement loops. The raw `displace()` primitive remains a
single geometric step for scripted transport and explicitly timed capture links.
Legacy battles retain their previous instantaneous force API.

## Evidence and interpretation

The PRTS [push/pull](https://prts.wiki/w/推与拉) and
[unbalanced movement](https://prts.wiki/w/失衡位移机制) descriptions were
cross-checked through the public AUE displacement specification and implementation
at `84a501a221720aecbd719caaa3d9bf9a22630787`:

- [`docs/spec/displacement.md`](https://github.com/ArknightsDevs/Arknights-Universal-Engine/blob/84a501a221720aecbd719caaa3d9bf9a22630787/docs/spec/displacement.md),
  blob `1d927077e9fcd15f5f750afcdf07f66633a18e7a`.
- [`packages/sim/src/displacement.js`](https://github.com/ArknightsDevs/Arknights-Universal-Engine/blob/84a501a221720aecbd719caaa3d9bf9a22630787/packages/sim/src/displacement.js),
  blob `cad81c24188ef05e5916700883549252b77d34c1`.

The local implementation uses the published velocity table (1, 2, 4, 4.5, 5.3,
5.8 tiles/s), deceleration 4.905 tiles/s², speed threshold 0.1 tiles/s, and
0.1-second hard interval. Projectile pushes include an immediate frame;
effect pushes start in the enemy phase. Existing directional force corrections
are shared with the legacy API. New push velocity adds to the current velocity.
Pull force starts at 2, 10, 40, 42, 44 or 46 and falls with the fourth power of
distance relative to the starting distance. Pulls last one second, or half a
second at grade -2. A stop-circle intersection clips travel before overshooting.

Unbalance releases blocking, interrupts attack epochs, and suspends ordinary
movement/attacks until settlement. Static bodies enter the state without moving.
Levitation, disappearance and force immunity retire it. Movement observers can
teleport or remove an enemy without dragging it onward from the destination.
Damage-by-distance consumes actual displacement receipts, including separate
outward and return segments. Enforcer's brush and high-ground effects now run on
actual travel/collision; a brush target is not stunned before contact.

## Arc Frontliners

The two `enemy_1328_cbjedi` records use a source-reviewed state-conditioned
periodic-damage controller. Original `enemy_cbjedi_bleed` checks
`CheckEnemyUnbalanced` and creates/removes `cbjedi_blood`; the child uses
`periodic_damage_without_modify`. Both inherit the talent interval of 0.066 s.
The child waits for its first interval, then deals 400 sourceless, unmodified
true damage, without defensive SP. Silence does not disable either buff.
This follows the original template rather than treating the handbook's
distance wording as a direct damage-per-tile formula. A stopped but still
active pull therefore still counts; walking and teleporting do not.

Original components are retained by `extract-enemy-native-abilities.py` from the
hash-verified source bundles, with native timing-index hashes checked. The
feature predicate validates the two source records, ordinary Arts attack,
parent/child templates and damage flags. Changes to those semantics refuse
admission. Original body artwork is now supplied by the shared asset store;
source effects and frame parity remain separate work.

## Limits

The force model is a researched simulation, not a captured-client frame-parity
certificate. The public reference marks parts of interruption and phase ordering
as inferred. This engine advances forces in the enemy phase and samples enemy
abilities afterward; parent polls win ties with child damage. Collision still
uses the existing passability mover and 0.1-tile substeps, not native rigid-body
contact geometry or edge collision. Special friction surfaces and every
operator-specific projectile offset are not implemented by this change. Custom
capture-link movers retain their own source-reviewed clocks and are not
automatically classified as physical unbalance.

Tests cover all six push grades, both start modes, velocity addition, directional
correction, blocking/attacks, static bodies, immunity, pull duration/stop radius,
walls, movement receipts and teleport observers. Operator regressions distinguish
impact from completed movement and verify delayed contact. Arc Frontliner tests
cover delayed periodic damage, silence, damage modifiers, invulnerability,
settlement, independent instances and rejection of changed source semantics.
