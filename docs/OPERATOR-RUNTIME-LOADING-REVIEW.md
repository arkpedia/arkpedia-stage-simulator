# Operator runtime loading

Battle startup prepares the actual player, support, fixed-card and trial-actor
dependency closure before constructing the synchronous simulator. Restart
reuses it. Missing adapters fail before initialization; they cannot silently
fall back to a generic kit. Operator behavior and source verification still
live in their original modules.

`arkpedia-operator-runtime-eager.js` remains the ordered registration source.
`npm run content:runtime` atomically generates an import index. The compiler
recognizes only immediate identity guards or explicit shared-family membership
guards in every registered hook. It follows literal identity constants through
named imports, without executing controllers. Unrecognized conditions remain
shared dependencies. `npm run content:runtime:check` detects stale registration,
source or family ownership. Tests reject side effects before guards, parameter
defaults and incompatible conditions.

At the initial checkpoint, 218 of 242 adapters could be selected by identity/family
and 24 remained shared.
The Fang/Kroos source closure was 11.04 MB across 482 modules, compared with
98.58 MB across 1,202 modules for all adapters at this revision. These are
uncompressed source bytes, not network timing, compressed transfer or memory
measurements. At that checkpoint the core alone imported 7.32 MB. Shared enemy and device evidence,
several compound operator adapters, and the remaining generic summon helpers
are further opportunities. `runtime-footprint.mjs` reproduces the figures and source hashes.

The later outcome/hover checkpoint removes the full native enemy evidence file
from the browser dependency graph. The two Flux controllers needed only fourteen
range offsets, now shared with their source-admission predicates in
`enemy-flux-ranges.js`. The measured Fang/Kroos closure at that checkpoint was 8.18 MB and the core
4.45 MB. Native source verification remains in the content tools. Browser checks
assert that the evidence file is never requested, including after selecting a
new operator and restarting. These remain uncompressed source measurements.

Node tools and tests retain eager compatibility through a conditional dynamic
import. Browsers and workers explicitly prepare selected adapters. Requests
share in-flight imports; failure clears loader bookkeeping. Native browser
module-loader failures may still require a page reload, especially when a
failed dependency has been cached by the browser.

Validation compares all 431 operator forms and every registered skill against
the eager registry: resulting stats, buffs, registered hooks, skill state and
runtime errors. The existing Thorns field instance serial is normalized only
for comparison between distinct battles. Loader tests cover order, omitted
dependencies, concurrent requests and failure recovery. Browser checks verify
that unrelated native evidence is absent and that later selections can load
their real controllers.

Twenty-two specialized summon factories are installed by their selected owner
adapters. The shared placement transaction still checks tiles, stock, DP,
cooldowns and deployment slots. An absent required factory throws before any
payment or spawn; it cannot substitute a generic summon. Owner callbacks also
supply Ray's placement range and Wang's occupied-tile exception.

Squad-wide preparation, deployment discounts, talent installation and Marcille's
bench mana display use an explicit service dependency table. Services load by
source-owner membership, including support and trial actors, and bind to each
battle's roster. A previously cached operator cannot grant a later squad its
bonuses. Ordering and signatures match the original constructor/cost pipeline.
Node tools still initialize these services synchronously through the eager
compatibility path. `arkpedia-operator-service-index.js` is the small declarative
extension point for additional squad services.

Optional browser fullscreen no longer blocks preparation completion. A pending
request cannot leave Start disabled after exiting; its eventual response is
ignored after leaving or restarting that battle. Browser review holds these
promises open deliberately, changes the selected operator, restarts, then
resolves the stale requests and verifies they cannot mutate either battle.

The family-guard checkpoint now selects all 242 adapters by explicit ownership.
Older compound controllers check their existing family registry before reading
any skill or talent fields; their individual behavior branches remain intact.
Tinman's once-per-battle guard follows its identity check. The generated index
uses the same ordered registration source, with no manually duplicated roster.

The UI and battle core import `arkpedia-summon-deck.js`, a shared placement and
selection module without operator-controller dependencies. Selected summoner
controllers attach their token evidence, factory and installation callback to
the current deployment state. The old module re-exports the deck API for Node
callers. Native token evidence is referenced, not copied. Flux resonators use a
three-entry build-condition projection verified against that same source file.

The Fang/Kroos source closure is now 3,400,904 bytes in 473 modules, versus
8,469,373 bytes before this checkpoint (about 60% less). The eager compatibility
closure is 96,012,154 bytes. These are uncompressed source closure sizes, not
network, memory or startup-time measurements. Full game fidelity and native
artwork are separate from this loading change.

At the family checkpoint, 1,722 summon integration tests pass, alongside the
all-operator/all-skill eager-versus-selected comparison and source projection
checks. Desktop and touch browsers verify an empty specialized-adapter list for
Fang/Kroos, absence of the old summon controller and evidence on that path, then
later loading of selected support/operator controllers and clean restarts. The
touch layout was visually inspected. See
`data/arkpedia-operator-runtime-family-review.json` for hashes and measurements.
