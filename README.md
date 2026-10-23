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

## Tests

```bash
npm test
```

All checks run on GitHub-hosted runners only.
