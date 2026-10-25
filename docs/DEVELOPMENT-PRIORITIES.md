# Development priorities

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
Candidate combat support is now465/1,901; this does not admit any Integrated
Strategies stage or certify its mode-specific reward/economy rules.
Flyer, Brute and Bag native graphs are retained without controller admission.
Brute's original bound Skill events are0.833333313/1.266666651/1.666666627s,
with a2.200000048s clip. A direct candidate now owns normal/enhanced cast clocks,
retains the original target deployment across all hits, reads live ATK per hit,
and cancels pending hits on control, source death and battle end. Sixteen focused
tests pass, with 23 related source/pollution regressions also passing. It remains
unregistered: the compiled FSM, cooldown reset event and ASPD/slow-down rate
boundaries still need independent review. Candidate tests exercise the proposed
contract; they do not resolve those source uncertainties or admit stages 17-8/9.
Reading original event-clock bytes for mechanics is not a visual-model import.

The five-stage continuation checks cover 16-10/11/14/15 and 17-7. The catalogue
contains 612 entries (597 public and 15 test-only), with 611 file-backed stages.
The full local file-backed load/fight sweep passes. Hosted validation found a
stale one-tunnel browser expectation for two-tunnel 16-15 and a generic runner
deadline shorter than the catalogue test's own deadline; both are corrected,
without removing scenarios or changing the simulation's gameplay time cap.
