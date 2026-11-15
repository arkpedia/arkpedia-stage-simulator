# Waker-Upper one-shot HP buff

Mead-Grade and Whiskey-Grade Waker-Uppers now share a one-shot HP-threshold
controller. The original checker switches on only once, when HP is strictly
below full. It applies a 30-second buff: +100/+150 ASPD and ×2/×2.5 movement
speed. Healing back to full does not cancel the buff. Further damage does not
refresh it, and expiration does not allow another activation.

This reads the native HP checker, so HP loss can trigger the condition without
an ordinary attack receipt. Cancelled damage and elemental gauge buildup alone
do not lower HP and cannot trigger it. The checker is silenceable; both source
records are silence-immune. The active timed buff itself is not silenceable and
adds no control immunity. Steam Tank's different `Rage` talent retains its
separate half-HP permanent boost and control-immunity behavior.

The extractor retains the original root, mode, ordinary physical attack, toggle
ability, referenced HP checker and sibling talent component. The predicate
checks the exact source parameters, single-use toggle, strict threshold,
finite duration and two attribute modifiers. Changes to those semantics refuse
admission. Components are verified against the existing native timing index or
retained with their own digest from the same verified bundle.

The [PRTS enemy entry](https://prts.wiki/w/蜜酿级醒酒助手) independently describes
the first-damage speed increase and silence immunity. The implementation values
come from the pinned source records and native components, rather than the wiki.
Checker phase is sampled on the simulator tick; this is not a native-frame or
visual-parity certificate.

Tests cover both ranks, full-HP inactivity, triggering, healing, expiration,
non-refresh, non-retrigger, HP loss, cancelled damage, elemental buildup,
silence, stun and rejection of changed source contracts.

Both original bodies are available from the shared asset store, with independent
source receipts and five decoded animation clips each. See
`data/arkpedia-reaction-enemy-artwork-review.json` for the six-enemy artwork batch.
