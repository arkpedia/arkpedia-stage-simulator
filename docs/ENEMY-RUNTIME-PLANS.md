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
