# Shared combat core and full-content entry point

Regular stages import `BattleCore.js`, which contains the existing combat
engine and uses shared setup/loadout functions from `content/core.js`. These
modules do not prepare the Stronghold kit tiers or its nine legacy domains.
Selected operator, enemy and device preparation remains unchanged.

`Battle.js` remains the public synchronous full-mode entry point. It prepares
the existing full-content registry and reexports the same class, default export
and `pushTiles` function. `content/index.js` retains its kit/domain exports and
reexports the shared setup functions. There is one combat class and one copy
of setup logic. Loading full content after a content-none battle does not
retroactively install hooks or kits in that battle. A direct core import
refuses unprepared full mode before constructing a partial battle.

The 0-1 browser fixture requests 371 simulation/shared modules instead of 396.
Their measured response bytes fall from 911,388 to 555,073, a 39.10% reduction.
MB-8 and TW-3 save the same 356,315 bytes and 25 requests. These measurements
exclude data, artwork and other application scripts. All three stages load
and restart without errors. They request no full content entry point or kit
tier modules. Common legacy enemy/device helpers still remain in their graph.

A separate browser check loads the public full-mode API after a regular
stage. It verifies class identity, all 129 current legacy kits, nine domains,
full-mode enemy hooks, and unchanged state/hooks in the existing stage.

Validation: all 969 available stages pass ten-second smoke checks; 55 focused
stage/runtime tests pass. The full simulation/content suite reports 1,800
passed, three skipped and two Chimera pollution failures. Both failures were
reproduced on the previous commit in an isolated checkout using
`test/content/feedback1d-solvent.test.js`; they are unchanged by this refactor.
Evidence: `data/arkpedia-combat-core-loading-review.json`.
