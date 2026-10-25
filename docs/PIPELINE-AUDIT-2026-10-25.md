# Chapter 16 stage route handoff audit

Observed 2026-10-25. Scope: the pinned original 16-3 level, Arkpedia's stage
producer, the canonical preview data snapshot, and the simulator admission
boundary. This is a local replay and preview repair, not a production-site audit.

The canonical enemy handoff works. The existing stage geometry handoff loses
information required by the Hidden Tunnel, so 16-3 must remain unadmitted until
both that export and its simulator device/route consumers are verified.

| Requirement | Evidence state | Observation |
|---|---|---|
| Canonical enemy bytes and receipts | verified working | Simulator at `7cc8d93e` consumes checksum-verified `arkpedia-data@79e81a8a872b2ecc592647d81a864ccbf1f8ca06`; no substitute source repository. |
| Conditional wave route identity after deduplication | broken in existing snapshot | Original indices 10 and 14 survive against ten exported routes. Replaying the repaired producer maps both to route 7. |
| Tunnel branch route and checkpoint precision | broken in existing snapshot | The producer computes `extra_routes` but omits them from final geometry, and drops checkpoint reach offsets and traversal settings. |
| Producer correction | verified working locally | `arkpedia/arkpedia@5556df22fd0ec0ec265559d164f4acf4c4b6b963`, draft [PR 763](https://github.com/arkpedia/arkpedia/pull/763); 32 focused route, numeric/CN and workflow tests pass. Hosted CI is separately pending. |
| Corrected canonical preview release | verified working | Compiler output at `arkpedia-data@e49aaf3cc8ab09c5730a3dd81cead2e1a6ae005d`, draft PR #44; both local validators and hosted validation pass. No mutable pointer changed. |
| Hidden Tunnel, facility and branch runtime integration | not implemented completely | Retained native evidence and existing shadow/engagement substrate do not constitute stage admission. |
| Test-only boundary | verified working | Only 16-2 is experimentally admitted; 597 public stages are unchanged. New stage publication remains excluded. |

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
