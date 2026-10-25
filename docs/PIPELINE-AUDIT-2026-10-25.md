# Chapter 16 stage route handoff audit

## Reproducible receipt follow-up

Producer commit `e5a96b56e312c3e73a54865da57bc33172119a0b` closes a later
reproducibility gap: the daily raw-level intake now invokes the normal geometry
builder/encoder and writes route receipts itself. It validates the pinned table
membership and slug/level mapping, prepares every selected map before writing,
and declares the geometry/conditional outputs in the refresh rollback graph.
The producer cohort passes 35 checks. The next batch includes 16-5 through 16-7
and 17-2 through 17-4, in addition to the existing 16-3/16-4 inputs. Canonical
export/validation and subsequent consumer pinning remain separate operations;
this producer change does not admit any simulator stage or publish content.

The regenerated 16-4 geometry/conditional bytes match the currently consumed
canonical snapshot exactly. The regenerated 16-3 objects are semantically equal,
with only JSON formatting differences. Existing immutable consumer pins remain
unchanged.

Observed 2026-10-25. Scope: the pinned original 16-3 level, Arkpedia's stage
producer, the canonical preview data snapshot, and the simulator admission
boundary. This is a local replay and preview repair, not a production-site audit.

The canonical enemy and corrected stage handoffs are verified through an
experimental 16-3 build. The original geometry export lost Hidden Tunnel route
information; the repaired canonical preview and runtime now retain it. Both
16-2 and 16-3 remain explicitly test-only; public admission is outside this work.

| Requirement | Evidence state | Observation |
|---|---|---|
| Canonical enemy bytes and receipts | verified working | Simulator at `7cc8d93e` consumes checksum-verified `arkpedia-data@79e81a8a872b2ecc592647d81a864ccbf1f8ca06`; no substitute source repository. |
| Conditional wave route identity after deduplication | broken in existing snapshot | Original indices 10 and 14 survive against ten exported routes. Replaying the repaired producer maps both to route 7. |
| Tunnel branch route and checkpoint precision | broken in existing snapshot | The producer computes `extra_routes` but omits them from final geometry, and drops checkpoint reach offsets and traversal settings. |
| Producer correction | verified working locally | `arkpedia/arkpedia@5556df22fd0ec0ec265559d164f4acf4c4b6b963`, draft [PR 763](https://github.com/arkpedia/arkpedia/pull/763); 32 focused route, numeric/CN and workflow tests pass. Hosted CI is separately pending. |
| Corrected canonical preview release | verified working | Compiler output at `arkpedia-data@e49aaf3cc8ab09c5730a3dd81cead2e1a6ae005d`, draft PR #44; both local validators and hosted validation pass. No mutable pointer changed. |
| Hidden Tunnel, facility and branch runtime integration | verified experimentally | Reviewed checksum-bound 16-3 build; real branch traversal, facility damage, natural SP/manual control, source parity and full-stage tests. |
| Test-only boundary | verified working | 16-2 and 16-3 require experimental access; 597 public stages are unchanged. Browser QA verifies public rejection. |

## Handoffs

| Producer/source | Transform | Output/revision | Consumer | State |
|---|---|---|---|---|
| `ArknightsAssets/ArknightsGamedata@db6f9ef8046ad17dbebe3ff1d0dd88844a5bc78c`, `en/gamedata/levels/obt/main/level_main_16-02.json` | `stage-pipeline/lib/geometry.mjs`, then `encode.mjs` | `source/data/stage-geometry/16-3.json` and `stage-conditional/16-3.json` | Canonical content compiler and simulator stage builder | Existing export is lossy; local corrected replay verified. |
| Arkpedia producer `5556df22` | Hydrate canonical source, compile complete preview release | `arkpedia-data@e49aaf3c`; source receipt includes upstream and producer commits plus hashes | Checksum-verified simulator candidate loader | Verified through retained unadmitted candidate. |
| Canonical candidate enemy records | Strict native evidence/support review | Simulator candidate support | Experimental stage builder | Verified; does not promote public records. |

## Root causes and repair order

1. Conditional wave spawns retain original main-route indices after the producer
   deduplicates main routes. This can address a nonexistent route or silently use
   the wrong route. Remap conditional **wave** references through the same map and
   reject absent inputs. Branch references use an independent extra-route space
   and must remain unchanged. Regression coverage exercises both spaces.
2. The final encoder drops the extra-route array, while the geometry builder
   drops nonzero reach offsets, spawn jitter and explicit traversal settings.
   Preserve those fields and extra-route ordering. The pinned miner branch uses
   extra route 0, including waypoints offset by +0.46 and -0.46 horizontally;
   substituting a main route or rounded tile centers changes its device contact.
3. Compile and validate a canonical preview in `arkpedia-data`; never hand-edit
   the generated release manifest or overlay the old public simulator catalogue.
   Then pin its commit/checksums in the consumer and implement branch traversal,
   manual tunnel activation, facility damage/contact and shadow restrictions.
   Integration and source parity tests must precede test-only 16-3 admission.

The raw level replay SHA-256 is
`fa693b20c843694be0911ba668a910e63074170406cd8881be9fe87a068238c9`.
An independent payload comparison confirms the broken indices and omitted
extra route; this is not inferred from TypeScript declarations alone.

The corrected source is in [data draft PR 44](https://github.com/arkpedia/arkpedia-data/pull/44).
The normal compiler produced 838 pages, 8,125 public files and 9,849 source
records. A complete source comparison found only the two intended corrections
and added route receipt relative to the original canonical pin. Both validators
passed. [Hosted validation run 40148463914](https://github.com/arkpedia/arkpedia-data/actions/runs/40148463914)
passed; `publish` and `propose` were skipped. The draft conflicts with current
data main, so PR merge-triggered checks were not scheduled; validation was run
explicitly against its immutable preview ref, with publishing excluded by the
inspected workflow conditions. No merge reconciliation or promotion is claimed.
The simulator fetched every input from that commit, verified checksums and both
receipts, and retained a source bundle with `testOnly: true, admitted: false`.
Eight canonical enemy/stage loader tests pass, including corrupt/missing bytes,
receipt disagreement, absent routes and separate main/extra-route indices.

## Coverage limits and release boundary

No served-site result, unattended refresh success, merge, deployment or live
pointer advance is claimed. Private application work uses its original private
repository, targets `dev` as a draft, and forces this branch's Check jobs onto
GitHub-hosted Ubuntu. Data preview PR validation uses `ubuntu-latest`; its publish
job requires a main-branch push or dispatch, which is not authorized here.
The original app/data worktrees and their unrelated changes are preserved.

## Complete-level follow-up

The canonical preview advanced to `84f3c8334db1c505429bce848147b32ca6a1cc20`,
generated by producer `d350e0879826d22abd75d08ff8a8d1b1bf63875b`. Compact
geometry cannot establish difficulty or movement semantics: the complete pinned
level has `moveMultiplier: 0.5`, and an optional SIX_STAR rune enables hidden group
`raid`. Treating those four enemies as normal always-spawning entries would
incorrectly change normal 16-3's 22 hostile spawns. This was found before admission.

The producer now copies that full tracked level from its clean pinned EN mirror
and writes a byte receipt, in the established `data/simulator` source family.
The stage refresh calls this importer; local replay and 55 producer/runner
regressions pass. Unattended operation remains unverified until the producer
changes are reviewed and released. The simulator has checksum-fetched the
complete level from the canonical preview and checks its independent receipt
against the manifest and original-level route receipt. No substitute source repo
or local fallback is involved.

Both validators passed for the new compiler output (838 pages, 8,125 public files,
9,851 source records); the output source inventory exactly matched the intended
canonical snapshot. [Hosted run 40150491404](https://github.com/arkpedia/arkpedia-data/actions/runs/40150491404)
passed at `84f3c833`, with publishing/proposal jobs skipped. No production change
or simulator-stage admission follows from this source correction.

## Consumer integration follow-up

The current producer revision is `d350e087`, and the canonical preview is
`84f3c833`. The earlier revisions in the table record intermediate audit evidence.
The consumer's separate reviewed stage record binds all retained evidence hashes.
Its test-only 16-3 build has 22 normal hostiles, four canonical enemy dependencies,
0.5 movement scale, the precise extra route and manual tunnel command. The optional
SIX_STAR `raid` group remains excluded. Enemy data still uses the original
checksum-verified `79e81a8a` snapshot. Integration, route, source-parity and browser
checks exercise this consumer; no production pointer or public catalogue entry
was promoted. Details and reproducible commands are in `CH16-BEHAVIORS.md`.
