# Development priorities

Current continuation: the snake's HP phases, line attack, timeout, firewall and
native hit body are composed as an internal candidate. AMa-10 and both twins now
have source-bound ordinary attacks, target ATK ramps, immobility/teleport markers,
x-4 firewall boundaries, internal three-lane line actors, checkpoint refresh and
the twins' internal HP-loss and native InstantKill rebirth/fake-death recovery.
Saga and Ju wound finishers now use that explicit native kill path. Complete
boss support remains held pending the incoming durability audit, source sequence
dispatch review, canonical wave/branch/story integration, mechanical input
routing and remaining staged-record reviews. The exact 17-18 twin records now
have an explicit internal stage selection, including their canonical room offset.
The canonical boss branch also has an explicit internal scheduler with its own
extra routes and exact local Brute; room-to-branch ordering remains unconnected.
Ordinary operator withdrawals now share captured payment/refund accounting and
an engine-owned entry point for future stage receivers. The room action's own
withdrawal scope and timing remain under review.
The exact predefined 17-14 Closure build now has an internal level-three module
adapter and an explicit separate instance/control adapter. Canonical 17-14
admission, field UI integration, initial native FSM dispatch, withdrawal/card
regeneration rules and S3 compatibility with that stage's enemy clocks remain
gated, along with the four 17-16 modules.
Rockbreaker's eligible split animation now consumes live `slow_down` elapsed
work for both release and completion, rather than fixed world-time callbacks.
Removing a separate same-character operator body now leaves the player's card
cooldown and captured payment untouched. Only the body selected by that card
can start its redeployment cooldown; ordinary death and withdrawal still do so.

The retained native components/canonical record supply the parameters and action
graph. Supplemental first-hand [PRTS HP-loss research, revision 442170](https://prts.wiki/index.php?title=%E7%89%B9%E6%AE%8A%E6%9C%BA%E5%88%B6&oldid=442170)
and [snake corrections, revision 441734](https://prts.wiki/index.php?title=%E2%80%9C%E7%BB%88%E5%A7%8B%E2%80%9D&oldid=441734)
resolve persistent-stage, injury-onset and waiting semantics; their revision
references and factual notes are pinned separately. This is not compiled client
or captured frame proof. No alternate enemy/stage data or wiki timing replaces
the canonical records. Boss/wave integration and the wider operator,
enemy and stage audits remain mechanics work before any new visual campaign.

Owner direction, 2026-10-25: take over development on the Windows workspace and
complete mechanics before expanding visual content. This direction supersedes
the narrower Chapter 16/17 handoff as the overall project scope; that backlog
remains the current mechanical integration work.

## 1. Mechanics

Finish and verify mechanics for all canonical enemies, stages, and operators.
This includes bosses, summoned units, stage devices, conditional/hidden waves,
environmental rules, navigation, targeting, status effects, damage/healing,
operator skills/talents/forms and their interactions. Audit the existing operator
implementations against source evidence; most are already implemented, but a
support count alone is not evidence of complete behavioral coverage.
Include operator modules in that mechanics audit before starting stage art,
models, enemy chibis, or effects, as reaffirmed by the owner on 2026-10-25.

Use checksum-verified canonical arkpedia-data, retained original native evidence,
and the existing exact-record support/receipt gates. Do not guess missing source
facts, flatten unsupported stage conditions, substitute data repositories, or
grant support merely because an asset or source graph was extracted. Add actual
behavior, lifecycle, interaction, source-mutation and stage integration checks.
Use GitHub-hosted Linux/Windows CI for quarantined local tests without disabling
antivirus or requiring the owner to access the PC. Browser checks may verify
mechanical controls/layout; they are not a reason to start new visual work.

The active Chapter 16/17 goal is the current mechanics milestone, not a limit on
this expanded project scope. Finish it, then proceed through the canonical enemy,
stage, and operator mechanical backlog, using coverage reports to select work
that clears shared blockers. Keep explicit evidence and remaining limitations.

## 2. Art and models

After the mechanics phase is complete, add stage art, stage/environment models,
and enemy chibis. Existing visual assets may remain in use during mechanics
validation; do not start a new art/model ingestion campaign before phase 1.

## 3. Effects

After art/model integration, add special effects for operators, enemies, stage
devices, and the environment. Preserve mechanical event ownership and timing;
effects must reflect verified behavior rather than stand in for implementation.

New stage admissions remain test-only. Public catalogue promotion, merging, and
production deployment require explicit owner approval. Keep development moving
autonomously within these priorities.

## Starting inventory

`node tools/arkpedia/mechanics-coverage.mjs` verifies the canonical stage release
manifest and every stage/geometry/conditional/device input it reads. It writes
`data/candidates/arkpedia-mechanics-coverage.json`. The inventory includes all
combat-stage metadata, rather than only the old main-story report: 3,891 records
across normal stages, variants, activities, Integrated Strategies, Contingency
Contract, tower and reclamation modes. This count is source records, not a claim
of unique maps or mode completion.

At the initial Windows mechanics checkpoint: 609 catalogue records (597 public,
12 test-only), 3,282 unbuilt combat-stage records, 463 source-bound supported
enemies out of 1,901 canonical enemies, and 431 registered target operator forms
with 949 skills. Operator registration checks skill identities/talent keys; it
does not certify complete operator mechanics. A separate source/behavior audit
remains required, including module effects and existing candidate limitations.
Generic stage gates overlap; existing reviewed stages can handle some observed
gates, so this report cannot grant or revoke runtime admission on its own.

All 34 normal 16-2..18 / 17-2..18 source levels are now retained with exact
manifest/route/producer/full-level receipts. Retention alone grants no stage or
enemy support. Remaining source-only levels continue to fail the stage-review
gate. Local `useDb=false` enemies in 16-9 and 17-18 require their own source-bound
records; never substitute a same-name catalogue enemy.

The first wider enemy continuation registers Duck Lord's permanent damage-triggered
Run mode against its original prefab/template closure. The normal and strategy
database identities intentionally share the original prefab, with separate exact
blackboard contracts (+400% and +300% movement speed). Nine source/behavior tests
cover all database levels, automatic single attachment, unblockability/no attacks,
accepted shielded/zero-HP-loss damage, control, cleanup and mutation refusal.
At that checkpoint candidate combat support was465/1,901; this does not admit any Integrated
Strategies stage or certify its mode-specific reward/economy rules.
Flyer and Bag native graphs are retained without controller admission.
Brute's original bound Skill events are0.833333313/1.266666651/1.666666627s,
with a2.200000048s clip. A direct candidate now owns normal/enhanced cast clocks,
retains the original target deployment across all hits, reads live ATK per hit,
and cancels pending hits on control, source death and battle end. Twenty-three focused
tests pass. Both original cast components mark `affectedBySlowDown=1`; the candidate
now consumes live slowed elapsed time between markers, rather than scheduling
fixed world-time callbacks. Reentrant death cannot release remaining markers.
The timeMode0/maxAnimScale1 rate mapping samples BAT/interval with a cap of1,
following existing native operator owners rather than the generic clip-fit
fallback. This is still an explicit mapping, not recovered compiled behavior.
The exact-record experimental review now registers both database variants.
Automatic dispatch, no-target charge retention under silence, exact full-graph
and record mutation refusal and wrapper-count checks pass. Callback3 maps to
cast finish consistently with the existing native operator owners; its original
switch-back action explicitly targets Combat with a fresh full cooldown. This
admits source-bound experimental mechanics, not compiled/native-frame parity.
Reading original event-clock bytes for mechanics is not a visual-model import.

The seven-stage continuation checks cover 16-10/11/14/15 and 17-7/8/9. The catalogue
contains614 entries (597 public and17 test-only), with613 file-backed stages.
The613-stage local file-backed load/fight sweep at `54f100ad` passes. Hosted validation found a
stale one-tunnel browser expectation for two-tunnel 16-15 and a generic runner
deadline shorter than the catalogue test's own deadline; both are corrected,
without removing scenarios or changing the simulation's gameplay time cap.

Hosted checkpoint `835d7b26`:409/409 focused tests pass independently on Ubuntu
and Windows; both16-14 and16-15 desktop/touch/restart browser scenarios pass.
The full eight-shard Linux/Windows Node22/24 regression at `4eb108d0` completed
successfully. That frozen checkpoint predates the Brute/Guardian integrations;
it is not a claim that the later head has completed the full matrix.

Stage-local definitions now have an isolated compiler path in
`shared/arkpedia/enemy-records.js`. It requires literal `useDb=false` data and a
separately reviewed native damage type; no catalogue row or handbook is borrowed.
Source tests cover16-9's local miner and17-18's four local infantry/Brute/
rockbreaker/caster records. In particular, the miner's fear-loss parameter is0,
the local rockbreaker's null skill list does not inherit SummonSelf, and the
17-18 children are uncounted while retaining a life cost of1. Compilation alone
grants no support or stage admission; dedicated source/native reviews and builder
integration remain required for these stages.

Brute integration adds normal17-8 (40 scheduled/counted hostiles) and17-9
(22 counted hostiles plus one harmless Leak Source). Their optional Six-Star
groups are excluded only after checking original default/optional enable runes.
All42 continuation integration checks pass, including three seeds per stage,
exact builder reproduction, mutated-source refusal and public/test-only gates.
Original17-8 Leak Source contact arms scheduled Brutes naturally. Separate
legally deployed guard fixtures exercise actual normal and three-packet enhanced
combat, then retreat the explicitly HP-buffed guard and clear the original waves.
The route-only17-9 fixture clears at300.7 seconds under an explicit330-second test
cap; its separate default300-second timeout test passes. The gameplay cap is
unchanged. Candidate support is467/1,901; the coverage report is regenerated.

The16-9 Guardian and fear-projectile graphs, all indexed components,
templates and the explosion projectile are retained against the pinned native
inventories. Source-only checks preserve the Guardian delayed self-HP-loss and
miner fog marker, and the fear projectile's derived miner fear/disarm ending at
full HP. The fear projectile remains source-only; the Guardian is now registered
under the exact experimental contract described below.

The expanded locally available focused suite ran431 tests:430 passed and one
temporary-cache atomic rename was denied by the Windows sandbox. The affected
canonical-stage file then passed5/5 with normal host filesystem access. The four
quarantined test files remain excluded only from that local invocation; hosted
CI runs the complete declared suite with those tracked files intact.

## Guardian and token-only preparation continuation

`25aaff91` fixes the17-8 browser failure: its five Roadblocks accompany an empty
fixed-squad array, which must preserve the player's squad choices. The adapter
now emits null for absent fixed operators, and preparation treats legacy empty
arrays the same way. Real fixed squads remain enforced. The actual local
desktop/touch clock, pause/restart and public rejection scenario passes; its
captures were inspected. Hosted run40186136583 passes both Linux/Windows focused
suites and all four16-14/15 and17-8/9 browser jobs.

The Guardian (`enemy_3011_dyegrd`) now has one automatically attached controller
for its DelayBloodDot talent and AOE skill. Twenty dedicated checks cover exact
native graph/index/record gates, original Attack02/Skill_01 clocks, marked-miner
input and area center, live ATK, selectability/ground filters, brief controls,
slow_down, input life retention, shared fog ownership and retirement. The actual
miner controller resumes shadow suppression after the final Guardian leaves.
An accepted75-second delay parent starts the immobilizing pure-damage child on
disable; early removal also starts it, while rejected parents create no callback.
One-second pulses read current max HP, pass through damage modifiers, survive
silence/stun and can kill the owner. Source retirement cancels future owned work.

The buff-event alias receipt independently matches unchanged action lists at the
same keys in both frozen native and named-template sources. Five aliases have
three retained witnesses each; event25 is ON_BUFF_DISABLE, corroborated by30
matching templates. Only $type assembly suffixes are normalized, and booleans
remain distinct from numbers. The retained named source and complete native
bundle checksums are verified. This recovers serialized aliases, not compiled
methods or frame parity.

Candidate support is468/1,901; the catalogue remains614 entries,597 public and17
test-only. Stage16-9 is still unadmitted: the fear projectile and local miner
contracts must be completed first. The projectile's original skeleton has no
OnAttack events, so no synthetic hit marker or borrowed clock is admitted.
The locally available focused suite passes459/459, excluding only the four
quarantined files retained in Git. Two additional source-plan tests pass.

`fetch-enemy-family-source.mjs` verifies only the seven exact dependency bundles
for Guardian/fear-projectile/Brute and the pinned named template file. Hosted
continuation CI now independently reruns all three graph/indexed/clock extractors
and the alias recovery script from those original bytes. This source job grants
no support on its own. Guardian native callback/FSM ordering and radius/rate
resolution retain explicit shared-engine mappings; compiled/frame parity is not
claimed. The operator-wide mechanics audit remains in phase1; visual integration
waits for that phase to finish.

## Flyer mechanics checkpoint

The two canonical Flyer variants now have an exact-record test-only controller.
Its complete graph includes the death projectile resolved through a blackboard
string, which the earlier source extractor missed. Both extraction and graph
verification now require that dependency. The retained native graph, indexed
components and prefab-bound Change clocks independently reproduce from the
original pinned bundles. The shared trace cursor selects Leak Sources, suspends
original route progress, and returns to that route after source selection ends.
Two distinct source contacts commit growth at the original OnAttack markers;
silence, stun protection, brief interruptions and slow_down have separate tests.
The born one-second projectile survives its owner's death, samples live same-life
ATK and selectable ground bodies at its retained death point, holds battle
completion, and uses a captured ATK fallback after source-object reuse.

Stages17-5/17-6 retain19/31 scheduled source bodies,18/30 counted hostiles and
their original optional-group exclusions. Natural Leak Sources drive scheduled
Flyers through both growth steps. Three seeded no-operator fixtures clear each
stage;17-6 uses an explicit400-second fixture cap, while a separate test retains
the unchanged300-second game timeout. Native compiled/FSM/frame fidelity remains
an explicit limitation of the local mappings. Candidate support is470/1,901;
616 catalogue entries comprise597 public and19 test-only. The canonical coverage
inventory has3,275 unbuilt combat-stage records and1,431 unsupported enemies.
Operator-wide mechanics and modules still require the separate audit before art,
models, chibis or effects begin.

The locally available continuation suite passes499/499; four tracked files remain
unavailable locally and are run by hosted CI. The two new browser scenarios pass
desktop/phone startup, pause, restart and public-access rejection. Both viewport
captures were inspected. The previous09f52106 checkpoint passed all seven hosted
continuation jobs; latest-head hosted results must be recorded separately.

## Further Chapter17 integration and Bag source audit

Flyer checkpoint a36af72b passed all nine hosted continuation jobs: source
reproduction, focused Linux/Windows checks, two Chapter16 browser scenarios and
four Chapter17 browser scenarios. This includes the four tracked test files
unavailable locally; antivirus remains enabled.

17-11 and17-13 use the existing reviewed Infantry, Rockbreaker, Brute and Flyer
controllers. The source levels retain52 scheduled/50 counted and72 scheduled/72
counted bodies respectively, two Leak Markers each, and no optional hidden spawn
groups.17-13 includes finite waits, hidden teleports and stronger Rockbreaker
splits; these remain live mechanics rather than flattened playback paths.
The catalogue is now618 entries,597 public and21 test-only. Enemy support stays
470/1,901; the canonical inventory retains3,273 unbuilt combat-stage records.

The Bag family remains unsupported. Its complete graph,40 indexed components and
two prefab-bound original clock receipts now have source constraints. Feeding
owns a10.5-second timed parent with1-second delayed pulses, while the AtkUp skill
uses its own11-second duration and ignores slow_down. The contact aura is an
infinite parent, despite the separate ReachedAura.duration10 blackboard field.
It creates a derived flag on the Bag with the Leak Source as the special buff
source. Natural feeding completion triggers that flag back to its own contact
parent, which checks the Bag skill is still affecting before killing its owner.
Permanent ATK stacks are not derived from that parent. The runtime must preserve
these identities, interruption and removal semantics; a generic ten-second
delay that kills the nearest source is insufficient. Skill cooldown/re-entry and
overlapping contact ownership still need explicit runtime/lifecycle tests before
admission. Hosted source reproduction includes Bag without granting support.

The17-13 live test exposed a shared path bug: geometry preserves finite wait
lengths but drops DISAPPEAR. Those waits previously remained visible before an
instant teleport. Source-bound generation now matches each deduplicated geometry
route against complete original routes, preserving the hidden interval and
rejecting mismatched or ambiguous visibility/timing. Native indices cannot be
used directly because geometry deduplicates routes. Regeneration corrects16-6,
16-11,16-14,16-15 and17-6 as well as the new17-13 build, without changing pinned
geometry. Three seeded17-13 runs verify each observed tunnel stays hidden for
ten seconds before reappearance. Source mutation/ambiguity checks reject altered
waits and unclosed disappearance. Browser checks for17-11/17-13 pass on desktop
and phone; original-source/runtime suites are rerun against the regenerated paths.

The regenerated-path checkpoint passes513 locally available continuation tests.
The four tracked locally unavailable files remain unchanged in Git and are
included in hosted Linux/Windows checks. The new stages pass independent builder
reproduction, canonical-byte mutation rejection, public-access rejection and
three seeded battle integrations each. No new enemy support is inferred from
the Bag source audit; its runtime controller and stage admissions remain open.

## Bag controller checkpoint

The two Bag variants now register one exact-record test-only controller. Passive
Arts pulses, source-owned contacts, the derived current flag, timed feeding and
permanent ATK stacks have separate owners. Feeding grants ten stacks per complete
cycle, consumes the current flag's source at10.5 seconds and holds the skill for
11 seconds. Multiple cycles clamp at the canonical40-stack limit. Earned stacks
survive interruption; source departure interrupts on the next pulse. Brief
controls, death, battle end and source reuse cannot leave late source kills.
Retiring an older contact cannot remove its replacement flag, and overlapping
Bags retain their own contact parents. A rejected flag grants no feeding state.
The pulse selects current all-motion bodies and reads live ATK; accepted feeding
is non-silenceable and ignores slow_down. New skill admission honors the native
silence wrapper. Cooldown start, callback ordering, collider and blackboard
substitution remain explicit shared-engine mappings rather than compiled/frame
parity claims.

Stages17-10/17-12 retain30/38 scheduled bodies and29/38 counted hostiles.17-10's
Six-Star hidden1 Bag remains excluded; normal hidden2 only displays enemy info,
so it adds no hostile. No-operator300-second fixtures time out while scheduled
Bags consume real recurring Leak Sources and reach40 stacks. Those timeouts are
retained as expected gameplay outcomes, without increasing the game limit.
Separate legal-sniper fixtures use explicit durability/output buffs to exercise
ordinary operator selection, hits, kills and Bag retirement through combat.

The catalogue is620 entries:597 public and23 test-only. Candidate support is
472/1,901, with1,429 unsupported canonical enemies and3,271 unbuilt combat-stage
records. Eleven of the34 retained Chapter16/17 normal candidates remain
unadmitted:16-9/12/13/16/17/18 and17-14/15/16/17/18. Existing operator forms and
skills still need their full mechanics audit before visual work begins.

The28f5ffb1 tunnel checkpoint passed all eleven hosted continuation jobs. The
older09f52106 full-repository checkpoint also completed all eight Linux/Windows,
Node22/24 shards successfully. New Bag results require their own hosted run;
neither older success proves the latest head.

The final Bag controller passes35 dedicated runtime tests and the full locally
available continuation suite passes559/559. The four locally unavailable tracked
files remain unchanged and required on hosted runners. Source admission rejects
missing family evidence, changed native strings, changed skills and added active
components. Reentrant checks cover source death during flag admission, owner
death during parent admission, and battle end during feeding-parent admission;
none may leave newly returned orphan buffs or later output. Both new desktop/
phone scenarios pass startup, pause, restart and test-only access checks; the
desktop17-10 and phone17-12 captures were inspected. Hosted checks for this exact
Bag checkpoint remain separate from the completed earlier runs.

## Stronger channel/carrying variants and normal-only waves

The stronger caster and carrier have exact-record registrations, complete graphs
for both base/strong pairs,40 indexed components, two projectiles, three templates
and four prefab-bound clock receipts. Source comparisons resolve local references
through original hierarchy/script identities; all eight non-visual caster and
four carrier component shapes agree between variants. Collider radii agree and
Spine playback remains1. This comparison grants no support without each record's
own reviewed native/count/record claims. The carrier retains its Leak Source
dependency gate.

The original named x-4 range is the existing3x3 square, including its center and
diagonals. Its complete source range table is retained with upstream commit,
Git-blob hash and SHA256 verification; placement behavior stays source-backed.
Carrier summon attempts now retire once per source life. The shared caster
clears channel/DEF/movement state on retirement, rejects silence at admission,
and interrupts its silenceable link even after a brief accepted forced silence.
Canonical silence immunity still rejects ordinary applications. SP callbacks
revalidate owner and marker state before another pulse. Born ordinary projectiles
preserve current same-life ATK/modifiers; after source-object reuse they use a
birth-deployment view. The same view fixes Flyer death blasts borrowing a new
deployment's modifiers or identity after reuse. Native compiled/frame parity
continues to be unclaimed.

17-15 includes the canonical ALL-enabled n group (one normal War Caster) and
excludes h/h2 Six-Star additions. Its38 counted bodies clear across three seeds.
17-17 includes four NORMAL-enabled group1 Flyers while excluding the group2
Six-Star Bag replacement. Its62 scheduled/60 counted bodies exercise natural
stronger channels, Brute/Flyer reactions and Bag feeding at the unchanged300s
no-operator timeout. The hidden-group compiler accepts explicitly reviewed
default ALL/NORMAL enables while rejecting missing/ambiguous masks, optional
normal enables and contradictory normal disables before mutation.

The catalogue is622 entries,597 public and25 test-only. Candidate support is
474/1,901; the inventory retains1,427 unsupported enemies and3,269 unbuilt combat
stage records. Nine Chapter16/17 normal candidates remain unadmitted:
16-9/12/13/16/17/18 and17-14/16/18. Remaining bosses, predefined Closure and the
stronger War Caster's additional Leave skill require their own mechanics work.
Operator-wide audit remains open; visual integration has not started.

Bag checkpoint8507929e passed all thirteen hosted continuation jobs. Its full
eight-shard Linux/Windows Node22/24 run40192086233 remains independently tracked;
older green results do not certify this newer checkpoint.

This checkpoint passes601 locally available continuation tests, including29
channel/carrier source/runtime cases and88 stage/conditional cases. Both new
desktop/phone scenarios pass startup, pause, restart and test-only rejection;
the phone17-17 capture was inspected. Original graph/index/clock extraction
independently reproduces all four prefabs. Hosted source reproduction includes
this family alongside the prior five families; range-table verification uses
the retained complete original bytes, SHA256 and upstream Git-blob identity.
The four tracked locally unavailable tests remain hosted-run requirements.

## Stronger War Caster and predefined-operator guard

The stronger War Caster now has an exact-record controller including its one-shot
Leave skill. Complete base/strong graphs retain 40 indexed components, two
projectiles, seven templates and two original clock receipts. Leave becomes ready
120 seconds after deployment, ignores silence and disarm, and commits once when
the caster is visible and free of intrinsic action control. The priority-one
retirement interrupts a lock, aliases Die to Leave and uses the native instant-
kill path without marking a route exit. Its zero LP value remains canonical.
Skill scheduling/preemption and refresh/frame timing remain explicit local
mappings rather than compiled/frame claims.

A separate callback receipt independently corroborates event 61 as
ON_BEFORE_TARGET_APPLY_MODIFIER (three unchanged source witnesses) and event 10
as ON_TAKE_DAMAGE (75 matches, three retained witnesses). Existing five-event
receipts remain byte-identical. The shared caster's active lock buff now uses
genuine accepted modifier receipts rather than net HP loss for theft. Full
shield absorption and zero HP damage still allow theft; protected, missed,
cancelled and fabricated receipts do not. A born ordinary splash arriving during
a lock can also trigger this owner buff on each accepted recipient. Two older
channel-only tests now suppress unrelated ordinary attacks in their fixtures.

Source/victim deployment identities, the 2050 gain cap and at-least-one target ATK
remain enforced. Retirement clears owned target reductions, source gains, lock,
shield and restoration callbacks; reentrant source death cannot continue a pulse
or leave a newly accepted hold behind. Born splash retains recipient/source life
guards and the original source view after object reuse. Thirty dedicated checks
cover these behaviors and exact support rejection cases.

17-16 remains unadmitted despite its enemy support: the source also owns
predeployed Viy (phase2 level90, raw potentialRank5/favorPoint100 and
skillIndex2/mainSkillLvl8), four initially hidden
operator cards with ACTIVATE_PREDEFINED tutorial actions, and DIALOG/STORY source
references. Those must be implemented and verified rather than made available
from time zero. 17-14's predefined Closure also carries a level 3 module requiring
its own mechanics audit. The candidate compiler now rejects unsupported
predefined operator instances and hidden/tutorial card activation before output.

Candidate support is 475/1,901; 1,426 canonical enemies remain unsupported. The
catalogue stays 622 entries, 597 public and 25 test-only, with nine normal Chapter
16/17 candidates still gated. The complete operator/module audit and all visual
phases remain open. Hosted results for the newer enemy checkpoint are separate
from earlier successes.

The 2e6ecc00 continuation checkpoint passed all fifteen hosted jobs. The older
8507929e full matrix run 40192086233 completed seven successful shards and failed
Windows Node 22 shard 1 solely when the aggregate stage-continuation file exceeded
its 180-second file deadline. That aggregate now uses the existing bounded 600s
class for long catalogue/match sweeps, retaining every stage, seed and assertion;
ordinary files keep 180s and game timeouts are unchanged. A new exact-head full
run is required rather than treating the timeout as a passing result.

Local verification passes all 631 available focused tests and the six existing
shard/CLI partition checks. Graph, indexed-component, original-clock and new
event-alias extraction independently reproduce the retained receipts. All
test-only generated paths retain their canonical wait/teleport contracts. The
four locally quarantined tracked test files remain required in hosted CI and
are preserved in Git; their local absence is not staged as deletion.

## Chapter 17 firewall boss source and interaction lifetime

The four remaining Chapter 17 firewall bosses (`enemy_1590_muama`,
`enemy_1591_mutwin`, `enemy_1591_mutwin_2`, `enemy_1593_musnake`) now retain complete
original prefab/projectile/template closures, all 99 indexed components, seven
projectiles, 17 templates and four original prefab-bound skeleton clock sources.
The source workflow independently reproduces these from the frozen publisher
bundles. This retains mechanical evidence without importing visual assets or
granting enemy/stage support. All four enemy support policies remain null.

The existing firewall integration port now owns its perimeter/button state by
the owner's deployment identity. Death, removal, reuse or battle end retires the
wall and its listeners. Exposure and ticks discard stale walls; expired buttons
lose partial click progress. An explicit refresh commits the perimeter at the
new owner position, restores its sides and clears the prior button; changing the
owner position alone does not preempt the later native environment action.
Break callbacks clear the completed button before reentrant calls. Tests cover
these interactions, simultaneous owners, all sides, rectangular dimensions and
source/closure mutation rejection. This port still does not implement boss
attacks, damage geometry, deployment restrictions or phase controllers.

The new source audit distinguishes three mechanics that cannot share one button
implementation: firewall vulnerabilities use the existing three-click/five-second
configuration; the snake's HP-step counter needs ten clicks in ten seconds with
different success/failure buffs; its final counter needs fifteen clicks and uses
the retained 999999-second duration with the same finish buff on success/failure.
Snake initialization sets `_createForAllWalls=true`; its native selection scope
still needs verification. The terminal buff
also finishes/skips the current wave, while timeout separately modifies LP by
the canonical -50 value without marking a route exit. Twin recovery depends on
the reciprocal `ally_alive` buff and current modes. These paths, checkpoint
teleportation, line attacks and firewall/deployment geometry remain held for
their complete controllers. The generic firewall port must not substitute for
them or admit 17-18.

The preceding f5c7e5e2 checkpoint passed all fifteen hosted continuation jobs in
run 40197246345. Its full Linux/Windows Node 22/24 matrix (40197258983) is still
running; that handle must be observed to completion rather than restarted.

Verification for this firewall checkpoint: all 13 new source/lifecycle checks
pass; together with the existing parity tests, the targeted run passed 52 tests.
The local focused run exercised 644 tests: 643 passed and the canonical loader
hit a sandbox temporary-file rename denial (`EPERM`). That complete five-test
loader file then passed outside the sandbox. This records the invocation and
permission repair separately, rather than claiming one green aggregate run.
Graph, indexed-component and original-clock extraction also reproduce all four
bosses independently. Hosted continuation/source reproduction remains required
for the committed checkpoint, including the four quarantined local test files.

## Source-bound snake counter subsystem

The two snake button actions now have a reproducible source contract derived
from the complete boss graph and the independently corroborated ON_BUFF_TRIGGER
alias. It pins both original action nodes, their template/event positions and
the exact canonical record. Counter creation rejects unknown kinds, changed
records and missing result dispatchers before replacing an accepted counter.
This is a counter subsystem, not registration of the snake as supported.

Step counters require ten accepted clicks before ten world seconds and dispatch
`enemy_musnake_stun_buff` on success or `enemy_musnake_heal_buff` on expiry.
Terminal counters require fifteen clicks with the original 999999-second
deadline and dispatch `enemy_musnake_kill_self_buff` for either outcome.
Inputs name the owner, deployment life and counter instance, so an old input
cannot progress a replacement counter or another deployment. Expiry resolves
once on the battle clock; silence/action control does not pause the button.
Death, removal, life reuse, undeployment and battle end cancel without applying
a success/failure buff. Completion detaches first, allowing its result dispatcher
to replace the counter or remove its owner without stale cleanup deleting new
state. Snapshots contain plain input/progress data for later mechanical controls.

The caller must still implement the selected result buff, HP-step admission,
Injured scheduling, final/fatal admission, source timeout/LP changes, full wave
completion and all attack/firewall mechanics. No placeholder buff dispatcher,
automatic phase advance, visual work, enemy-support change or stage admission
is introduced. Input/deadline ordering is a declared local simulator mapping;
compiled dispatch and captured frame parity are not claimed.

The preceding 694d5fe5 firewall checkpoint passed all fifteen hosted continuation
jobs in run 40198285662, including source reproduction and both OS focused jobs.
The f5c7e5e2 full matrix run 40197258983 currently has four successful shards and
four still running; it must finish before dispatching a replacement full matrix.

Verification: all 24 new counter checks pass, and all 668 locally available
focused mechanics tests pass in one run with ordinary temporary-file
permissions (no failures, cancellations or skips). The source-contract generator
also reproduces the retained actions with `--check`; hosted source verification
now runs this check. The four quarantined tracked tests remain unmodified in Git
and required in hosted CI. Candidate enemy/stage counts remain unchanged.

## Snake pre-floor terminal transition

A separate native/named callback receipt corroborates event 27 as
ON_BEFORE_TRY_SET_HP_ZERO (22 unchanged matches) and event 44 as
ON_OWNER_ROOT_TILE_CHANGED (eight unchanged matches), retaining three independent
witnesses for each. Default and War Caster alias receipts remain byte-identical.
The latter event is a root-tile change, not a generic Blink-end callback.

The terminal subsystem now attaches the retained non-silenceable UNDEADABLE
parent and observes genuine pre-floor HP-set attempts. Its numeric 6 alias uses
the existing pinned, explicitly version-limited status receipt. It coalesces the
UNIQUE derived child once per active terminal transition, waits its original
0.5 world seconds, then starts the source fifteen-click counter. A completed or
expired terminal counter self-kills the original body and hands off the exact
FinishCurrentWave action, including finishAndSkip, to a required canonical wave
receiver. Native AlwaysNext permits that handoff after the kill, even if a kill
observer revives the body. No route-exit/LP-loss event is substituted. The
literal retained `enemy_musnak_before_dead` finish key is not silently corrected.

HP-attempt observers keep their existing mutable observation object, while a
separate transient immutable receipt authenticates the originating battle,
recipient, deployment and amount. Fabricated observations, later replay and
reentrant reuse of the same attempt cannot create another terminal child.
Remaining HP work also stops if an observer removes or replaces the recipient's
deployment, preventing an old lethal hit from assigning HP to a reused body.
Existing post-floor zero guards retain their ordering and cancellation behavior.

Pending tasks, counters, parent/child buffs and listeners retire by exact owned
instance on death, removal, life reuse or battle end. Removing the parent cancels
its derived child; a rejected/removed child can retry on a later genuine lethal
attempt. Completion detaches before the handoff and cannot replay after receiver
failure. UNIQUE coalescing, pre-floor callback order and cross-receiver wave
handoff remain explicit local mappings, without compiled/frame parity claims.

This subsystem remains unregistered as a complete enemy controller. HP-step
admission/reset rules, Injured scheduling/effects, timeout/LP behavior, attacks,
firewall/deployment geometry and actual canonical wave/branch advancement still
need their full implementations before 17-18 can be admitted. No pending-spawn
clear or no-op wave receiver is supplied as a replacement. All nine remaining
normal-stage gates, operator/module audits and later visual phases remain open.

Verification passes all 846 locally available focused mechanics checks, including
28 terminal/source cases and the added affected HP-attempt consumers, in one
run with no failures/cancellations/skips. A broader existing Makoto, Palamute,
Hsgma2 and HP-attempt regression run passed 1,148 checks with two pre-existing
asset-dependent skips and no failures. Both source contracts and all three
event-alias modes independently reproduce. Hosted run 40199476136 passed all
fifteen continuation jobs at 634c6a2b. Full run 40197258983 passed all eight
Linux/Windows Node 22/24 shards at f5c7e5e2; that is a verified earlier baseline,
not certification of the new damage-hook change. A new exact-head full run is
required for this checkpoint.

## Snake timeout and HP-step source boundary

The snake's TimeOut passive now has its own reproducible source contract and
runtime subsystem. The retained single-trigger buff loads the canonical interval
998 and duration 999; its countdown and one-shot action use world time. The
original noReason InstantKill is mapped to a non-kill, non-leak body retirement,
followed by the distinct AlwaysNext LP modification of -50. The original
`enemy_musnak_before_dead` finish key is retained literally. Camera shake and
audio remain later visual/effects work.

Timeout requires a fresh, exact-record deployment and an existing finite
ordinary-stage life ledger. It does not manufacture default LP, consume the
enemy's route-exit value or award a kill. The real StandardBattle integration
check proves the LP decrease and defeated outcome independently of catalogue
admission; its normal constructor still rejects the complete unsupported snake.
The fixture's inline diagnostic body does not change stage/source/registry gates.

Owned countdown buffs, tasks and listeners cancel on death, removal, life reuse,
undeployment or battle end. A completed terminal sequence cancels the timeout;
timeout cancels a pending terminal button without invoking its successful
wave-finish handoff. Source retirement cannot replay LP changes, including when
a death callback reuses the body. Corrupt life ledgers report an error and stop
the timer rather than initializing new LP. The interval sentinel, world-clock
dispatch and reasonless retirement remain explicit local mappings without
compiled/frame parity claims.

HP-step research found 27 named HpRatioTrigger templates, including other
MarkCurrentHpRatio producers, but no native method body establishing how the
marked ratio resets after healing or injury. The snake source explicitly has
GT, a non-minimum-ratio comparison, its 0.10000000149011612 polling interval and
the canonical 0.2 ratio. Those fields do not by themselves prove a reset policy.
Automatic HP-step admission remains gated; a guessed mark reset is not used to
enable 17-18. Injury, line attacks, firewall/deployment rules, full wave/branch
handling and the other remaining bosses/operators are still open.

All 869 locally available focused mechanics checks pass in one run with no
failures, cancellations or skips, including the 23 timeout source/lifecycle/LP
cases. The source contract reproduces with
`--check` and is included in hosted source validation. Run 40201202488 passed all
fifteen continuation jobs at 8a0a0b7a; full run 40201217661 remains active and
must be observed rather than replaced while it is running. Candidate support
and stage counts remain unchanged.

## Independent firewall side interaction state

The firewall integration port now retains multiple simultaneous side windows
instead of one mutable button per boss. Each selected side owns its three-click
progress and five-second deadline. Reexposure resets the selected side without
erasing another side's live progress; expired or broken sides no longer accept
clicks. A perimeter refresh clears the previous windows, restores its sides and
changes exposure identity. The existing single-side compatibility view remains
available to the earlier Leak Source interaction tests.

Plain snapshots and a mechanical input adapter carry the owner, deployment,
wall-instance, side and exposure identities. Old inputs cannot progress a new
window at the same side index, a refreshed perimeter, another owner's wall or
a replacement wall. A break removes its button before invoking the callback, so
reentrant refresh/exposure cannot have its new state erased by old cleanup.
Wall retirement still removes every owned window and listener.

The port supports explicit all-side exposure for future controller integration.
The retained snake source's `_createForAllWalls=true` flag is asserted as a
source fact; its exact compiled selection scope is not established by that field
alone and is not automatically dispatched into this port. Independent side
windows, reexposure replacement and input ordering are local interaction
mappings. No boss is admitted, deployment/damage geometry is not approved, and
no UI routing or visual/effects work is added by these internal adapters.

The fourteen new source/interaction cases and the existing firewall/parity
checks pass together (66 tests), and all 883 locally available focused mechanics
checks pass in one run with no failures, cancellations or skips. The preceding 1cb06025 timeout checkpoint
passed all fifteen hosted continuation jobs in run 40203285375. The full run
40201217661 remains a separate validation handle for the earlier damage-hook
checkpoint; five shards passed and three were still active at the checkpoint
check. Its authoritative status must be checked again before dispatching
another full matrix. All normal-stage and enemy-support gates remain unchanged.

## HP-loss and injury continuation validation

The health controller at the current continuation has 27 focused checks covering
strict thresholds, healing persistence, overshoot, the initial/live maximum-HP
ratios, true-damage shields, heal prohibition, forced-skill eligibility, terminal
precedence, rejected buffs, source mutation, body reuse and battle termination.
All 908 locally available checks passed together before the last two source
mutation checks were added; all 27 health checks then passed together. The four
previously quarantined tests remain tracked and run on hosted CI.

Full matrix run 40201217661 at 8a0a0b7a completed successfully across all eight
Linux/Windows Node22/24 shards. Continuation run 40204339318 at 0baa9166 passed
all fifteen jobs. These are frozen preceding checkpoints; hosted checks for
the new health controller must be observed separately. Support/stage counts
are unchanged; the complete snake and the nine remaining normal stages have
not been admitted.

## Composed snake action phases and retained firewall environment

`chapter17-snake-core.js` now composes HP-loss/recovery/injury, line casting,
terminal counter/wave intent and the real LP timeout on one deployment. A
successful injury interrupts the actor's actual pending line cast; it does not
reset an unrelated placeholder timer. New casts consult the owned interaction
predicate and injury state. Partial installation rolls back admitted phases,
and terminal handoff retires the full actor even if a kill observer revives the
body. This composition remains an internal candidate until the firewall and
canonical wave/stage receiver are complete.

The original Skill_1 clock releases at 2.4666666984558105 of its 6 seconds.
Canonical GlobalLineAttack keeps initial cooldown15 and repeat cooldown25;
the community page's different displayed cooldowns do not replace those records.
Literal cast time consumes live native slowdown once and is independent of ASPD.
Each retained grid column emits one downward speed10, radius0.5 projectile with
a ten-second life and a one-target cap. Target-free is ignored; liftoff still
has ground motion. Already born projectiles survive source retirement while
unborn output is cancelled by injury. Swept contact, grid border peeling and
clock dispatch are declared local mappings pending actual stage geometry review.

An impact has no initial damage. Its single named parent supplies canonical
300 true damage each second for10 seconds and owns a separate derived stun.
Stun immunity/resistance does not delete or shorten that parent. Replacement
cleans its own child, and parent removal preserves unrelated stuns. Both flying
projectiles and already attached impacts retain source-life snapshots across
body reuse. Hidden-body damage follows the ordinary engine pipeline; the parent
continues its clock without bypassing that pipeline. Battle end removes all
owned output. These are mechanics implementations, without model/effects work
or a claim of compiled client/frame parity.

The native `battle/prefabs/[uc]envsystems.ab` is now retained for the complete
boss/firewall and Leak Source environment closures: two prefabs, eight components.
Its publisher-manifest MD5/size and original bundle SHA256 are verified before
extraction; a separate complete-graph digest prevents self-rehashed component
changes from silently authorizing new rules. It supplies snake width7/height4,
the other three bosses' x-4 range identity, five-second/three-click vulnerabilities
and the generic harmless Leak Source spawn settings. The hosted fetch plan now
has eight deduplicated original dependencies and independently reproduces these
environment graphs. Capturing configuration/effect-key names for mechanics is
not a visual import or environment behavior approval.

All34 new line/core cases pass, and all944 locally available focused mechanics
checks passed together. Four additional environment verification checks and both
fetch-plan tests pass. The new source contract and Python environment extractor
both reproduce with `--check`, and all eight cached dependency bundles verify.
The preceding HP checkpoint cd1180fc passed all fifteen continuation jobs in
run40206399587. Full Linux/Windows Node22/24 run40206399907 remains live at that
checkpoint and must be observed rather than replaced while running. No enemy or
stage support counts change; firewall damage/deployment geometry, initial side
selection, canonical wave/branch integration, the other bosses and the wider
operator audit remain mechanics work before art, models or effects.

## Snake firewall, native target body and direct placement

The composed snake actor now installs its native7×4 firewall and root hit
rectangle. Its nonsilenceable DamageResistance parent supplies one conditional
Physical/Arts multiplier when the source-to-recipient segment crosses a remaining
wall. It applies after DEF/RES and before shields, including corner crossings
only once; it does not edit a reusable area-damage packet. Inside sources,
sourceless output, True/elemental HP damage and ordinary HP loss retain their
separate paths. Breaking one side removes reduction only for segments that no
longer cross a remaining side. Whole-body tile/radius targeting now uses the
retained native root BoxCollider2D and the existing huge-unit body helpers.

The source InitFireButton lifetime owns one initial set of bottom/right/left
three-click windows; top has no initial vulnerability in this encounter, as
corroborated by the separately pinned first-hand snake research. All three
windows keep independent five-second deadlines. A later Leak Source event
still exposes the nearest remaining side. Generic all-side exposure now accepts
an explicit side subset without changing other owners' windows or its earlier
default behavior. Retirement cancels owned windows, modifiers, flags, body
geometry and listeners together, including body reuse and rejected admissions.

Operator cards, skill-delivered operator cards through the normal placement
API, manual summon cards (including custom source decks) and player-placed
stage tokens consult the source-bound firewall checker before spending DP,
stock or deployment slots. The interaction-only firewall port supplies no
placement policy. Automatic conjures and forced movement do not silently gain
new placement checks: their separate native selector/checker contracts remain
authoritative. Snake interior exclusion does not borrow Muama's directional
three-tile release. The retained canonical snake branch starts at row14/col5
on a17×11 grid; its interior footprint already has nondeployable base floor,
and its upper boundary meets the forbidden map border. No alternate map or
stage admission follows from the synthetic interaction checks.

The new source contract pins the full environment graph, canonical parameters,
native passive/init/collider bindings and independently corroborated buff-finish
and take-damage callbacks. Strict segment endpoints, tile-center exclusion,
fixed-tick buff finish and explicit environment refresh remain local mappings.
Teleport/refresh parity, renderer body metadata, real mechanical input routing,
canonical wave/branch/story integration and the other bosses remain open. No
art/models/effects campaign or public support promotion has started.

All975 locally available focused mechanics checks passed together before the
last canonical-footprint cross-check was added. The firewall suite then includes
28 source/behavior/lifecycle/API checks. The separate41 placement/summon/squad/
stage-device regression checks also pass. The previous d2942579 continuation
passed both hosted behavior jobs and all twelve browser scenarios, while its
native-source job failed because the new original-clock parser dependency was
not installed there. That job now runs locked `npm ci` before verification;
the clock/source checks remain required. Full run40206399907 at cd1180fc is still
live, with six successful shards and two WindowsNode22 shards running at the
latest observation; do not replace it while running. Stage/enemy counts and
the nine remaining normal-stage gates are unchanged.

## AMa-10/twin ordinary combat and x-4 boundary rules

One shared candidate now owns the original ordinary Attack/Combat binding for
AMa-10 and both twin prefabs. It retains the literal0.6333333253860474/2-second
Muama release/tail and0.6000000238418579/1.5-second twin release/tail, original
Arts versus Physical output, and speed10 target-tracking projectiles. Native
maxAnimScale1 prevents high ASPD from compressing the whole clip below its
source length. The existing sampled BAT/interval and affectedBySlowDown bridge
is explicitly a local mapping, not recovered compiled timing. Selection uses
the ordinary range/blocker/taunt/deployment rules; the captured target life is
retained through windup and flight. Unborn releases are cancelled by control or
source retirement; born projectiles retain their accepted source view after
removal/reuse and cannot transfer to a new target deployment.

The native SameTargetAtkUp component owns one attribute buff containing the
accepted100..400 flat ATK addition, with its first layer before the first ordinary
release. A changed target deployment starts at one layer, idle retains the
previous accepted count, and damage prevention cannot manufacture a reset.
Forged legacy attack observations grant nothing. The first-layer/persistent
semantics are corroborated by separately pinned [first-hand PRTS research,
revision441735](https://prts.wiki/index.php?title=AMa-10&oldid=441735); source
parameters and serialized components still govern the implementation.

The native environment's x-4 identity now binds to the complete retained named
range table with its immutable Git blob/size/SHA256, and agrees with the prepared
CN range record. Its three-by-three firewall owns incoming Physical/Arts scaling
and direct-placement checks. Breaking a side releases its three boundary tiles,
including its corners; another live adjacent side can still reduce a diagonal
incoming shot. The center remains excluded. Native private-immobility parents
and the exact immune_shu_blink/immune_yu_blink marker keys are owned by the source
deployment. Explicit perimeter refresh restores boundaries, but automatic Blink
and the twins' fake-death/reborn/room transitions are not implemented by this
candidate. Canonical altered room strings will still require exact staged-record
review, rather than broadening the base-record factory.

All1009 locally available focused checks passed together after the receipt fix,
including32 new ordinary-combat/source/lifecycle cases and the LF regression.
A final profile-reuse case also verifies restoration of the source's no-attack
override. None of these internal candidates grants public enemy or stage support.

Hosted run40210032463 at1190e629 exposed a second CI issue after the parser
dependency was installed: Python's Windows text output gave the environment
artifact CRLF bytes, while Git checked it out as LF. Its graph was unchanged,
but the downstream byte receipt was stale. The generator now writes explicit
UTF-8 LF bytes and `--check` compares bytes, with a focused LF regression check.
Dependent firewall/ordinary receipts were regenerated; all13 receipt inputs also
match Git's cleaned bytes locally, so no checksum tolerance or source weakening
was introduced. The earlier full matrix run40206399907 at cd1180fc has now
completed successfully across all eight Linux/Windows Node22/24 shards. New-head
hosted validation remains separate. No art/models/effects work has begun.

## AMa-10/twin three-lane line actors

The internal line controller now handles both canonical skills for all three
prefabs: horizontal rows and vertical columns, each with three parallel rays,
first ground-body collision, physical initial damage, and a named fixed true
damage parent with a separately owned derived stun. Native selectors, transport,
impact actions and original Begin/Loop/End clocks are reproduced into a checked
receipt. The three-lane and initial physical semantics also agree with the
separately retained [PRTS observations, revision 441735](https://prts.wiki/index.php?title=AMa-10&oldid=441735).

Ordinary attacks and ready line skills now share one admission point. This
prevents a tick-order race that could repeatedly admit another ordinary attack
before the skill sees its cooldown reach zero. Casting consumes a ready attack
opportunity; ordinary cooldown continues, each skill resets its own cooldown at
cast end, and equal ready line choices use seeded arbitration only when an
action can actually begin. Blink must join this arbitration before boss support.

Born output survives source death, retirement and object reuse with captured
attribution/modifiers. Target reuse cannot inherit a parent. Same native keys
replace prior parent/child ownership across casters; Muama and twin keys coexist.
Damage rejection or shields do not suppress the separate parent, and stun
immunity, child removal and hidden time do not erase or accelerate its world
clock. Unrelated statuses retain their own ownership.

The original native timeMode0 and sequence fields are retained, but playing each
clip once in literal seconds remains a local dispatch mapping. Root-tile lane
centers, axis direction and exact visual mount projection also need client/frame
review. These limitations remain explicit; no claim of full boss parity or stage
support follows from this candidate. Refresh, twins' fake-death/reborn, staged
room overrides and canonical branch/story/wave integration remain open.

All 1,049 locally available focused checks passed together, followed by 74
ordinary/line cases after the final lifetime/control checks and source-note
receipt update. The preceding checkpoint 184e63bf passed all 15 hosted
continuation jobs, including native reproduction, both behavior platforms and
all browser scenarios. Its full eight-shard Node22/24 Linux/Windows run
40212773386 remains running at the latest observation; it has not been replaced.
The new line source checker and behavior suite are included in continuation CI.
Enemy/stage support counts and the nine remaining normal-stage gates are
unchanged. Mechanics still precede all new art/models/chibis and effects.

## AMa-10/twin checkpoint refresh and action composition

The retained Blink wrappers, instant buff, BlinkNode action, Disappear/Appear
bindings and Move/Start clocks now have an independently reproducible receipt.
The internal action composition installs ordinary combat, both line skills and
refresh together and rolls back partial admission. A failed or retired part
retires its sibling actors; previously born line output retains its independent
ownership. Canonical enemy and stage support gates remain unchanged.

Blink joins the same ready-action arbitration as the two line skills, including
its native silence exemption. Its five-second parent and skill cooldown begin
immediately, while a separately owned state protects the two-second intro and
1.5-second outro. The state prevents ordinary route/checkpoint/exit handling from
consuming the newly arrived body before the outro ends. Original route identity,
cursor index, checkpoint coordinates and cursor offset are revalidated before
committing the jump and discarding path caches. An exhausted checkpoint list
leaves the body's position unchanged.

Native abnormal immunity suppresses the unblockable flag while retaining its
original parents. Blink state supplies its own temporary protection; after the
outro, real blocking works during the remaining immunity window, then existing
unblockable parents resume when immunity expires. Accepted root-tile changes
create the single named, coalescing delayed environment-trigger parent. It
refreshes the current owner's firewall after 0.1 seconds, restoring broken sides
and invalidating stale click receipts. That parent is not derived from the
five-second buff and can finish after the listening buff expires. Source reuse,
retirement and battle end cannot refresh another deployment's wall.

These rules agree with the separately retained [PRTS first-hand observations,
revision 441735](https://prts.wiki/index.php?title=AMa-10&oldid=441735). The native
components remain the parameter/action sources. Literal clip dispatch, state
bridging and root-center geometry remain local mappings, not compiled/frame
proof. Current nonfinal MOVE checkpoints are covered; WAIT/APPEAR/DISAPPEAR
dispatch is explicitly not inferred. The actual canonical 17-18 Muama/twin
routes are all MOVE sequences and now pass cursor-order checks within the full
17-by-11 rectangle. This is route verification, not branch/story/wave admission
or approval of the altered staged twin room records.

All 1,085 locally available focused checks passed, and the separate simulation
core regression passed 632 cases with three skipped. The final refresh suite
then passed 37 cases, including three added composition/admission checks.
The preceding d87b26eb checkpoint passed all 15 hosted continuation jobs.
Full run 40212773386 at 184e63bf has four successful shards and four still running
at the latest observation, and has not been replaced. Native reproduction and
the new Blink receipt checker remain required in continuation CI. Twins'
fake-death/reborn/room behavior and canonical boss/wave integration remain the
next mechanics work. No art/models/chibis/effects campaign has started.

## Twin HP-loss rebirth, recovery and partner ownership

The source-bound twin core now composes the action actors with an authenticated
fatal HP-loss bridge and the native fake-death mode. It binds the full native
mode hierarchy, reciprocal prefab validators, four retained buff keys, heal and
marker actions, and first-twin room parent to a reproducible receipt. Separately
pinned [PRTS observations, revision 441736](https://prts.wiki/index.php?title=AMa-10%E5%BC%82%E6%9E%84%E4%BD%93&oldid=441736)
corroborate the short rebirth, recovery and teleport-immunity behavior.

Fatal damage is accounted before a private one-HP protected rebirth bridge;
after the canonical 0.1-second interval, the body enters fake death at 2% current
maximum HP. The literal heal parent applies 4% current maximum HP each world
second through normal healing modifiers and heal-free checks. Its literal
ally_alive condition has source checking disabled in the native action; the
simulator honors that condition while cleaning only its own exact derived
instances. Recovery to full HP restarts the active mode. Removing an established
partner marker forces final death with no additional rebirth. If no marker can
be established on entry, the first heal-parent check takes the native failure
branch. Late partner arrival, simultaneous knockdowns, repeated cycles and
source reuse have separate checks. One exact live deployment per twin prefab
is admitted by this internal factory; duplicate-copy aura overrides remain held.

Rebirth keeps the source ATK ramp, immobility/firewall and first-twin room parent,
clears teleport immunity and transient buffs, and aborts unborn casts. Explicit
nativeDurable metadata also retains a buff; simulator persist alone is not
treated as proof of native durability. Skill clocks reset at rebirth completion:
root line skills then continue cooling in fake death, while the mode-bound Blink
clock pauses. Born output keeps the same original source life and samples live
ATK after transient modifiers clear. Rebirth does not refresh a broken firewall.
Protection is installed before transient-removal callbacks; nested transitions
cannot kill a newly accepted recovery state or mutate another deployment.

Only the first twin owns the camera/branch finish parent. Its immutable exact
action receipt and base-record room string go once to a required stage receiver;
the factory does not invent camera movement, withdrawal or branch execution.
The altered staged room records, canonical room handoff, native non-skipping
InstantKill/rebirth semantics, incoming durable-buff metadata, and client/FSM
timing still need integration review before boss/stage admission. Existing
scripted kill/removal keeps its bypass behavior. No complete boss policy or new
stage has been granted by the HP-loss candidate.

Whole-core replacement also retains the original generic-attack profile flag
through a source-life change. A private weak ownership record carries its true
baseline across composition teardown, while stale actors still cannot overwrite
the current deployment's flags.

Latest broad local pass: 1,125 available focused checks. The final composed boss
suites, including the profile-transfer regression, pass 149 cases. The core
behavior run passed 631 cases with three skipped and one wall-clock benchmark
miss while suites competed for CPU; both benchmarks then passed in isolation
(worst case 54.7 microseconds/tick against the 500-microsecond threshold).
No threshold was relaxed. The preceding refresh checkpoint 3aa989b3 passed all
15 hosted continuation jobs. Full run 40212773386 at 184e63bf also completed all
eight Linux/Windows Node22/24 shards successfully. New-head native-source,
behavior and full-matrix verification remain separate. The nine remaining
normal-stage gates and all visual-work priorities remain unchanged.

## Native enemy InstantKill and wound interactions

The internal native enemy InstantKill operation now validates its exact retained
action fields and exposes a temporary private rebirth receipt. Non-skipping
requests enter or coalesce the twin's protected short rebirth without damage or
kill credit. The partner-mark finalizer honors skipReborn. Generic Battle.kill
keeps its existing behavior; noReason, rally, exit and state-switch variants are
outside this operation. Stale deployments and forged/replayed events cannot
admit a new rebirth.

Saga's ordinary wound timer, before-appear kill and S2 delayed finisher, Ju's
wound finishers, and the snake terminal kill now use the explicit native path.
Saga's decoded nodes are checked against the retained original serialized
actions. Delayed finishers retain the original source credit and target life;
old timers cannot kill a reused body or remove a replacement deployment's wound.
Real Saga/Ju interactions with the paired twin core exercise the native rebirth
path without granting complete boss or stage support.

The retained wound flag DISABLE_COMBAT now maps to an enemy-only noCombat flag.
It prevents new blocking and blocking attacks, preserves an existing block by
itself, and permits unblocked ranged attacks. It is independent of ordinary
unblockable immunity. The whole cripple bridge also applies its zero-block-count
modifier and explicitly releases the block; it no longer invents blanket disarm.
The native flags are authoritative. Supplemental first-hand
[PRTS abnormal-effect notes, revision 440606](https://prts.wiki/index.php?title=%E5%BC%82%E5%B8%B8%E6%95%88%E6%9E%9C&oldid=440606)
describe DISABLE_COMBAT's blocking restrictions and distinguish BLOCK_FREE's
automatic release. Those notes identify client 2.7.81 and supplement the older
pinned native source; they are not replacement source or captured frame proof.

Latest local verification: all 1,194 available focused checks and all 134 final
kill/wound/lifecycle integration checks passed. The broader simulator suite
passed 632 cases with three skipped and no failures. The four known quarantined test
files remain in Git and hosted validation. All 18 receipt inputs retain identical
Git-normalized bytes. The preceding 5ee1f774 checkpoint passed all 15 hosted
continuation jobs; its full run 40217962392 remains active at this observation.
New-head CI is separate from those results.

Canonical room withdrawal/refund/order, branch/wave/story dispatch, staged room
overrides, incoming durable-buff coverage and client/FSM timing still require
review and integration. Source/support counts and all nine remaining normal-stage
gates are unchanged. Art, models, chibis and effects remain after mechanics.

## Exact 17-18 staged twin records

The internal twin core now accepts the two exact 17-18 database-backed records
only when the caller explicitly selects that stage. A separate source checker
fetches the original level at the locked canonical commit, verifies its length
and SHA-256, and compares it with the retained full level. It checks the complete
base database receipt and binds the source/foundation hashes in a new staged
record contract. The level's complete replacement blackboard keeps all numerical
values and changes only DamageResistance.boss_room from (0,6,0) to (0,10,0).
No active attribute, skill or other field override is discarded by this review.

Combat, line attacks, Blink and lifecycle admission share the stage-aware record
check. The stage selection requires the entire compiled staged record to match,
including stats and count/life rules. An absent or different selection still
rejects these altered records. The first twin snapshots its accepted room string
before callbacks; later record mutation cannot rewrite its room action. The
existing base-record factories and canonical catalogue records retain their
original room string.

Tests exercise both staged twins through rebirth, healing recovery, final death,
the actual retained route's Blink checkpoint and the single first-room callback.
They also reject changed records/source bytes, duplicate references, changed
blackboards and missing room receivers, and verify composition rollback. The
focused suite passed 1,200 cases; the final stage-specific suite passed seven
cases, including one added rollback/admission check after that broad run.
The source checker is now required by hosted native-source validation. All new
receipt source bytes also survive Git normalization unchanged.

The preceding d3c3f663 continuation's native-source, both focused platforms and
all browser test steps succeeded. Its 16-14 job failed solely during GitHub's
artifact upload after five service timeouts; the run is recorded as failed.
The older full run 40217962392 at 5ee1f774 completed all eight Linux/Windows
Node22/24 shards successfully. New-head verification remains separate.

This completes the exact twin-record review, not room execution. Forced operator
withdrawal/refund, camera/branch ordering, conditional boss-wave execution,
story/input routing and remaining local enemy integration still gate 17-18.
No enemy policy, stage admission or public promotion was granted. All nine
remaining normal-stage gates and the mechanics-before-visuals order remain.

## Canonical 17-18 boss branch and local Brute

The internal boss branch now schedules the snake at 3 seconds and the two local
Brutes at 6 and 9 seconds relative to an explicit branch start. These offsets
agree with the retained canonical conditional producer; they are not accumulated
into 3/9/18 or flattened into the ordinary wave schedule. The source checker
reuses the checksum-verified full stage/database intake, binds the retained Brute
review and verifies every scheduler action, route-space choice and traversal
option. Native extra-route MOVE checkpoints and the two 20-second WAITs retain
their order. WAIT's (-8,0) position is sentinel metadata, never a movement target.
The existing 0.05 native checkpoint reach radius is preserved.

The local enemy_10207_mubrut_2_a record compiles independently from the level.
Its literal description, SP, uncounted/life and hit-rate fields remain local;
there is no catalogue alias inheritance. Its exact prefab uses the retained
Brute normal/three-hit attack graph and clocks only with an explicit 17-18
selection and a full compiled-record match. The Brute also now honors the
enemy-only DISABLE_COMBAT restriction for an existing blocking attack.

The scheduler installs the composed snake core and actual Brute ability on fresh
accepted deployments. Pending work holds the battle open; once it has all spawned
and the units have gone, those holds no longer prevent completion. Branch work
outlives the first twin's life. Explicit cancellation stops unborn spawns while
born enemies retain their own combat lifecycle. Repeated/reentrant starts cannot
duplicate the branch, and a reused spawn body cannot acquire the old body's core.
A finished battle or deferred end request during spawn observers prevents late
controller/receipt mutation. Runtime stat overrides require a separate review.

Canonical-terrain tests exercise the real route wait, relative timing, count/life
rules, local Brute pollution triplets and blocking control, the snake's terminal
15-click counter and exact wave-finish intent, cancellation and deployment reuse.
The expanded focused run passed all 1,209 available cases. Two further shutdown
and admission checks were then added, and the final branch/Brute/snake integration
suite passed all 89 cases. The new source
checker is required in hosted native-source checks; its receipt inputs retain
identical bytes after Git normalization.

The preceding da6e2750 checkpoint completed all 15 hosted continuation jobs.
Its full matrix run 40222394497 is still active at this observation and is not
replaced. Room withdrawal/refund, camera/branch start ordering, the actual
main-wave finish receiver, story/input routing and remaining local enemy/device
integration still gate complete 17-18 support. The scheduler exposes an explicit
start and native wave intent; it does not invent those missing receivers or claim
compiled-client/captured-frame parity. No enemy policy or stage admission changed,
and all nine normal-stage gates remain. Mechanics still precede visual work.

## Shared operator withdrawal accounting

Ordinary card deployments now capture the payment, basic-cost refund cap and
selected refund ratio in a private Unit-owned account before deployment hooks.
Manual withdrawal and the engine-owned withdrawOperator entry point use that
same account. The engine entry point accepts only the current bench Unit and
optionally its captured deployment life, independently of the workspace viewport.
The refund is claimed before removal callbacks, so a nested request or later card
mutation cannot pay it again. A new paid card deployment owns a new account.

The general rule is floor(min(deployment cost times refund ratio, basic cost)).
Its supplemental first-hand source is
[PRTS deployment-cost research, revision 434779](https://prts.wiki/index.php?title=%E9%83%A8%E7%BD%B2%E8%B4%B9%E7%94%A8&oldid=434779),
which identifies client 2.7.71 and distinguishes base-cost changes from temporary
card discounts. This fixes Charger over-refunds after Fang's one-use discount,
caps temporary card cost increases, and preserves SilverAsh S3's accepted swapped
base cost after the card override is consumed. Nonrefunding merchant traits stay
zero. The existing local zero-payment skill-delivery policy also returns zero;
the delivery adapter's native deployment/refund parity remains explicitly held.

The caller audit found two original Withdraw actions bypassing refund accounting:
Amiya S3's suicide template and THRM-EX's explosion finish. Both retained nodes
withdraw the source and switch to the dead state. THRM-EX's retained character
component explicitly sets a 0.5 withdrawal recovery ratio. Their controllers now
use the shared engine entry point. Amiya's previous no-refund test was an incorrect
expectation; its natural-completion checks now verify the withdrawal refund at
all ten skill ranks. Token expiry, death, merchant upkeep, transport and other
special removal reasons are not indiscriminately converted into refunds.

The first expanded focused run passed 1,284 cases before these final two caller
corrections. A separate broad operator interaction run passed all 170 cases,
including Fang/Vanguards, Ines, SilverAsh, Kal'tsit, the held delivery adapter and
Swire's economy. The final new withdrawal, caster and utility suites passed all
47 checks, covering the real source-owned automatic withdrawals, stale bodies,
life mismatches, viewport independence, capped refunds and immutable payments.
The final expanded focused mechanics run, including both corrected automatic
withdrawal callers and their existing suites, passed all 1,323 available cases.

The 64a4c414 boss-branch checkpoint passed all 15 hosted continuation jobs.
Full run 40222394497 at da6e2750 is still active at this observation. This shared
withdrawal prerequisite does not establish how Mainline17MoveCameraWithWithdraw
classifies units, orders withdrawal/camera movement, or applies its 2.5-second
delay. Those room-specific semantics, the wave receiver and the remaining stage,
enemy and operator/module audits remain mechanics work. No admission or visual
campaign has begun.

## Predefined module intake and exact 17-14 Closure mechanics

The five level-three modules required by canonical 17-14/17-16 now have a
separate, test-only source lock. Both complete equipment tables are verified by
length, SHA-256 and Git blob at the existing CN commit. The equipment and template
bundles match the existing 2.7.71 publisher manifest and explicit SHA-256 pins.
Each module is checked against its actual canonical predefined owner and level;
the original level bytes are independently verified before selection. A fresh
cache independently reproduces the same table artifact. The native extractor
retains all seven required prefab graphs, 39 components including collision
components, and the five-template closure. Both table and native reproduction
are now required by hosted native-source validation.

The exact 17-14 Closure build (E2 level90, raw potentialRank0/favorPoint50, S3rank10,
uniequip_002_closur level3) now selects its source-owned module data internally.
It receives +180 HP, +30 ATK and +25 DEF; the token does not inherit those owner
stats. Its upgraded roster talent supplies a -5 DP floor and 8% Rhodes Island
operator ATK. Other stage/build/module-level combinations fail closed, and the
public module catalogue remains empty.

The retained closur_e_002_tr callback is event10/ON_TAKE_DAMAGE, corroborated by
the existing separate event-alias receipt. It checks whether the modifier source
is blocked by the recipient, then applies unfiltered nonstacking DamageScale.
The internal controller gives the exact module's ground recipients a 0.85 scale
on post-defence incoming damage from their current blocked attacker. Eligible
recipients are the owner's summons and its exact reinforcement-marked allies;
the owner itself is excluded by the native selector. Supplemental first-hand
[Closure notes, revision 442616](https://prts.wiki/index.php?title=%E5%8F%AF%E9%9C%B2%E5%B8%8C%E5%B0%94&oldid=442616)
corroborate the marked-ally interpretation. They do not replace the retained
native parameters or constitute compiled-client/frame proof.

Module marks belong to one owner/deployment and one recipient life. Source
retirement, target replacement, lost reinforcement marking, rejected admission
and explicit cleanup cannot transfer the reduction or remove foreign buffs.
Retired/reused attackers cannot borrow their old blocking relation. Overlapping
owners contribute one module scale, consistent with the nonstacking action.
The adapter composes with real S3 attacks, range expansion and DP pulses. Its
selector/category aliases, tick scheduling and grouped scale mapping remain
explicit local execution rules. General modules and native visual/frame parity
are not claimed.

The expanded focused run passed all 1,478 available cases. The final composed
Closure integration run passed 93 cases, including the added real S3/module
interaction. That final run includes 13 module-specific checks after stricter
source/provenance guards and rejected/foreign marker checks. All new receipt inputs retain identical bytes through
Git normalization. The 4b9a470f predecessor passed all 15 continuation jobs; full
run 40222394497 at da6e2750 also completed all eight Linux/Windows Node22/24 shards
successfully. New-head hosted validation is separate.

17-14 is still unadmitted: the predefined operator needs its own instance identity,
placement, player controls and roster integration. The existing predefined guard
still rejects it. The four 17-16 module graphs are retained source, not implemented
module kits; hidden-card activation and tutorial/story dispatch remain required.
The other remaining enemies/stages, boss-room and main-wave integration and the
broader operator/module audit remain open. No public module, enemy or stage
promotion, artwork/chibi ingestion or effects campaign has begun.

## Explicit predefined Closure instance and field control prerequisite

The internal 17-14 adapter now selects the complete retained canonical source
contract before installing an operator. It derives the preset's E2/90, potential
one, trust 100, S3 rank ten and level-three module, and places its separate body
at row 3, column 3 facing right. The canonical `char_exclude` rune bans the
player's Closure; the adapter rejects a player card, another source body or a
second roster/deck owner. This is an explicit internal entry point, not automatic
stage admission or a deployable player card.

The source instance has the distinct control key
`predefined:17-14:char_4228_closur:0`. The normal skill command can operate that
body through this key while checking its captured deployment life and workspace
state. A bare character ID cannot select it. Its original combat, S3, command
center, roster and module controllers compose without spending starting DP,
consuming a player card discount, or editing the selected squad. The retained
native character occupies one deployment slot; its command center occupies zero.
The internal instance has no captured player payment and does not enter the
player-card withdrawal/refund path. This does not establish the native stage's
manual withdrawal or subsequent card-generation behavior.

Eight instance checks and the module/withdrawal suites passed all 32 cases.
The expanded focused run then passed all 1,489 available cases.
Checks cover exact source and override rejection, duplicate/card ownership,
source-tile occupancy and slot limits, real S3 DP pulses, actual command-center
placement, actual module incoming damage, stale control lives, retirement and
owned-controller/deck cleanup. The preceding body-identity checkpoint passed all
1,481 available local focused checks; its hosted continuation run 40228409669
also completed successfully. The four unavailable local tests remain tracked
and run on hosted CI.

The predefined adapter preserves `assertClosurEnemyCompatibility`: source
delivery cannot bypass the existing S3 enemy-clock review. 17-14 needs the
candidate enemy controllers and their dependencies reviewed under `slow_down`,
in addition to field UI integration, initial native dispatch and verified
withdrawal/card regeneration. In particular, the retained Rockbreaker Skill
component declares `_affectedBySlowDown=1`; its current fixed world-time split
callbacks need review before that combination can be admitted. Neither the
builder's predefined gate nor the stage catalogue has been relaxed.

## Rockbreaker native split clock under slow_down

Both retained Rockbreaker Skill components explicitly have
`_affectedBySlowDown=1`, `_timeMode=1`, `_maxAnimScale=1`, and
`_waitForAttackEvent=1`. The controller now validates that selected native clock
and consumes its remaining animation work through `sourceAbilityDelta` on each
feature tick. The exact retained OnAttack marker remains 1.1666666269302368
animation seconds and completion remains two animation seconds. Ordinary ASPD
does not change this fixed-time Skill; native slow_down changes its eligible
elapsed work. Applying or removing slowdown before or after release affects only
the remaining work and does not replay a child spawn.

The split claims its release before invoking spawn callbacks. Existing source
flags, independently continuing Combat cooldown, route handoff, exact child
variant, failed-spawn retry after recovery, and completion ownership are retained.
Control, death, retirement and battle-end cleanup remove the owned pending state
without leaving a scheduled world-time release behind. The source and controller
suites passed all 28 cases, including eight new clock/lifecycle checks across
both variants, live speed changes and independent ASPD.
The expanded focused stage/controller run then passed all 1,497 available cases.

This corrects the split timing prerequisite identified above. It does not approve
Closure S3 against the candidate enemy catalogue: all relevant attack, ability,
channel, periodic and dependent-enemy clocks still need their complete source
review before widening that compatibility boundary. Native compiled/frame parity
and 17-14 admission remain held.
