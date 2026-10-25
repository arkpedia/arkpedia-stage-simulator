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
