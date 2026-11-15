# Twigs That Crave preparation

Historical preparation checkpoint; completed runtime integration is reviewed in
[STAGE-TWIGS-REVIEW.md](STAGE-TWIGS-REVIEW.md).

The pinned device and skill prefabs are retained alongside their character,
skill, range and buff-template records. `stage-twigs.js` prepares the static
configuration and checks the pollution, permanent low-HP mode, elemental attack,
death spawn and progress-trigger source contracts. This is preparation; the
device has no public registration yet.

`tools/arkpedia/stage-twigs.mjs` validates instance overrides and the branch's
selected action, original enemy identity and route origin. It maps the observed
initial-capital pollution-key spellings to the same local operands. This is an
explicit importer normalization, not proof of the original dictionary comparer.
Of 148 placements in 28 cached levels, 147 pass this preparation. One original
placement repeats `Polluted_damage_low` with values 100 and 50. It is rejected
instead of choosing which value wins or treating one as the high-ground value.

The pollution runtime now accepts removable persistent footprints. Temporary
Witherer death pools use the same field account, preserving their original
eligibility, duration and damage. Overlap keeps one recipient clock; removing
one producer preserves another's contribution. Focused tests and existing
Witherer and caster regressions pass.

Remaining work is runtime mode transition and source animation binding,
stage-progress interpretation, managed death-spawn integration, device artwork,
stage compilation and browser interaction. Existing stages remain protected by
the unsupported-device gate until these pieces are complete.
