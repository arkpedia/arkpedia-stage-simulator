# Shared enemy mechanics without eager catalogs

The selected-stage runtime imports the ability dispatcher, elemental helpers,
route/spawn helpers and Active Originium contact from small shared modules.
These modules do not import concrete legacy enemy kits or device controllers.
The old enemy and device entry points reexport the same functions: full mode
and regular stages share one ability list, hook installation and battle state.
Active Originium retains its existing buff identity and damage tick rhythm.

In the browser, 0-1 loads without either legacy catalog. Its simulation/shared
JavaScript response bytes fall from 555,073 to 449,806. TW-3 falls from 560,410
to 457,969; MB-8 falls from 561,899 to 554,203. MB-8 still selects legacy enemy
factories. These figures exclude data, artwork and other application scripts.
All three stages load and restart without errors. Loading the full public API
later retains class identity, 129 kits and nine domains, and leaves the existing
regular battle unchanged.

All 969 available stages pass ten-second smoke checks; 40 focused checks pass.
The broad suite retains its previous result: 1,800 passed, three skipped and
the same two baseline Chimera pollution failures. This is a loading refactor,
not a new enemy admission or a native-fidelity certificate.

Evidence: `data/arkpedia-shared-enemy-core-review.json`.
