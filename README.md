# Arkpedia Stage Simulator

![Version](https://img.shields.io/badge/version-0.1.3-blue)

A data-driven Arknights stage simulator. The project is standalone: it keeps the GPL-3.0-or-later licence and the original combat-engine attribution, but no longer exposes the Stronghold Protocol lobby, menus or co-op client.

## Run

```bash
npm ci
npm run start:arkpedia
```

Open `http://localhost:3000/arkpedia/`. The root redirects there.

## Data

- Stage/source data comes from [`arkpedia/arkpedia-data`](https://github.com/arkpedia/arkpedia-data).
- Simulator-only generated records live in [`arkpedia/arkpedia-stage-simulator-data`](https://github.com/arkpedia/arkpedia-stage-simulator-data).
- Combat code is GPL-3.0-or-later; see [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Scope

See [ARKPEDIA.md](ARKPEDIA.md), [docs/REMAINING.md](docs/REMAINING.md) and [CHANGELOG.md](CHANGELOG.md) for the implemented stages, enemies, devices and controllers.

The [content plan](docs/CONTENT-PLAN.md) and [addition guide](docs/ADDING-CONTENT.md)
describe the path to complete coverage. `npm run content -- plan stage <slug>`
reports dependencies; `npm run content:library` compiles every supported source
stage automatically. The older `content add stage` command creates regression
fixtures for the legacy catalogue. `npm run content:inventory -- --write`
regenerates the detailed inventory and remaining-work report from pinned sources.

During battle, **Damage** opens a per-operator breakdown of physical, Arts,
elemental and true damage, total damage, and DPS over the last five seconds of
battle time. It counts enemy HP actually removed, excludes overkill, shield
absorption and elemental gauge buildup, and attributes summons to their operator.
Totals survive retreat and redeployment; pause freezes DPS and restart clears all
totals. The results screen also offers **View damage**.

## Tests

```bash
npm test
```

All checks run on GitHub-hosted runners only.

### Stage library

`npm run content:library` discovers combat stages from the pinned source checkout
and compiles every stage whose reusable mechanics are supported. No manual stage
registration or per-stage browser approval is required for library admission.
Unsupported stages remain listed with their missing capabilities.

The browser loads `data/arkpedia-library.json`, then only the selected stage's
shared components from `data/arkpedia-stage-library/objects/`. Normal/challenge
stages share geometry, original wave programs and enemy definitions; changed stats remain separate.
Objects are immutable and cached, and the manifest is published atomically after
all referenced objects exist. Deploy these generated files together with the
application. A deployed browser does not need the source checkout or a compiler
service. The existing per-stage files remain useful regression fixtures and a
compatibility format for older deployments.

Run `npm run content:library:check` to verify every published component and execute
a short runtime smoke test of every available stage. The generated
`data/arkpedia-library-report.json` groups missing capabilities by affected stages
to guide implementation; counts overlap when a stage needs several capabilities.

See [the loader plan](docs/STAGE-LOADER-PLAN.md) for architecture and remaining
shared-mechanic work. Library availability describes current capability checks;
it does not certify complete game fidelity.

The [wave scheduler review](docs/STAGE-WAVES-REVIEW.md) documents original
fragment clocks, wave-clear waits, spawn flags and conditional route resolution.
Scheduled predefined activation and random/branch actions remain explicit gaps.
