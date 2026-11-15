# Flayer departure gains and attack modes

Sarkaz Boneguard Flayer and Torturer previously had no working range-based
healing/ATK gain in the regular simulator. Their overloaded `Attack` feature
had emitted an undefined-key death-spawn component instead. Both records now
compose two reusable components loaded only when selected: nearby departure
gains and ordinary blocked/unblocked attack modes.

The original mark templates use `ON_OWNER_FINISH`, excluding bodies carrying
`enemy_bmbcar2_passive`. Their event is broader than killed-only: nearby
operator retreats, enemy leakage and expiry can also supply gains. The native
selector takes both sides, uses the eight operator professions for player
characters, excludes tokens/traps, and ignores target-free/ally-target-free
selection restrictions. The simulator maps its 1-tile range to center distance;
hidden bodies and its own departure are excluded.

Each qualifying departure heals 15% of current Max HP and adds 10% ATK, capped
at 15 stacks. Further departures can still heal. Silence and stun do not
suppress this passive. Listeners belong to the source life, and a source
retired during healing cannot install a late permanent stack.

Ordinary unblocked Physical hits use half ATK and the original `Attack_2` clip;
blocked hits use full ATK and `Attack`. Skill packets retain their separate
path. These two modes reuse the ordinary damage pipeline.

The native evidence retains both variants' attack/aura components and their
custom talent-binding siblings. Predicates check selectors, mode bindings,
templates, excluded marker, stack attributes, flags and clip mappings. Native
frame timing, collision margins, VFX and overlapping native mark arbitration
are not certified here. Their pre-existing Blood Amber spawn adapter is
unchanged; this is a bounded repair, not complete family parity.

Validation: 202 integration tests, including all admitted raw/compiled enemy
plans, event reasons, exclusions, cap/recovery behavior, lifecycle cleanup and
native mutation refusals. All 969 available stages pass ten-second runtime
smoke checks. A controlled browser fixture loads the selected components,
observes the HP/ATK gain and confirms listener release after source removal.
It requests no source registry/compiler. Evidence:
`data/arkpedia-flayer-review.json`.
