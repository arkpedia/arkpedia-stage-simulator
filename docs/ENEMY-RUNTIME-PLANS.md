# Compiled enemy execution plans

Reviewed enemy registrations compile into schema-1 JSON plans in the existing
shared enemy-definition objects. Statistics remain separate, so normal and
challenge stages reuse one behavior definition. This adds no global runtime data
payload and grants no new enemy or stage admission.

Plans retain feature identity, order, duplicate abilities, unit properties and
traits. Ability kinds resolve through a fixed implementation registry. Factories
receive independently decoded parameters per unit. Undefined optional object
fields are omitted; infinite timer sentinels use explicit `{"$infinity":1}` or
`{"$infinity":-1}` values. NaN, functions, exotic objects, malformed sentinels and
unknown plan fields fail validation. The source compiler reserves the sentinel
field to prevent ambiguous object encodings.

Validation compares two-second controlled battles for all 771 admitted database
levels, including complete snapshots, derived statistics and damage totals. A
separate Rat King stage-override regression preserves the absent Mark timer as
Infinity. Stage packing tests check shared definitions, independent challenge
statistics and immutable source records. The deployed graph smoke executes all
959 available stages for ten seconds. These checks preserve existing behavior;
they do not establish full native client parity for older adapters.

`node tools/arkpedia/enemy-runtime-plans.mjs --check` verifies the deterministic
base-record report. Stage-specific overrides compile during stage publication,
which preserves every previously available stage by identity.

## Selected-stage delivery

The browser prepares the union of behavior kinds in the selected stage's enemy
records, including the spawn dependency closure already shipped in its graph.
The runtime index owns fixed module paths and export mappings. Concurrent loads
coalesce; an import or export-validation failure can retry. Every required
factory must be ready before StandardBattle construction. Module exports are
validated together before any factory from that module is installed.

New families add one factory and one index entry, then reuse that kind from
source registrations. Existing inline helpers moved into the builtin module;
family wrappers retain their original composition and order. No implementation
is copied per enemy or stage. Raw synchronous Node callers retain their source
registry through a conditional import. Legacy browser snapshots explicitly
compile missing plans through a lazy compatibility import. Generated stage
components need neither source predicates nor that compiler in the browser.

Browser requests and restart checks cover 0-1, BB-1 and MB-8. Their selected
adapter groups are respectively none, rope reactions, and prisoner/Jesselton plus
the legacy ability group. The source registry and compatibility compiler were
absent in all three. `data/arkpedia-enemy-runtime-loading-review.json` records the
observations. All 959 available stages passed the constructor/runtime smoke;
72 targeted loading, native-admission, mode and combat regressions passed.

The common legacy `enemies.js` module remains imported by shared combat helpers,
as do its existing dependencies. Consequently this milestone removes the eager
modern-family registry, not every enemy-related module from startup.
