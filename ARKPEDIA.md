# Arkpedia stage simulator

Public GPL-3.0-or-later fork of [sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol), based on `19a89085a4c9a773a7b88437d7cd79c3e7131cfd`. Preserve [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), the Spine linking permission and upstream contributor credit.

This is the starting point for Arkpedia's regular-stage overhaul. **The inherited application currently still plays Stronghold. Regular-stage combat, the Arkpedia iframe and SD asset consumption are not implemented yet.**

## Integration

The private [arkpedia/arkpedia](https://github.com/arkpedia/arkpedia) app will embed this separately hosted simulator. Battle code stays here and public. Reviewed combat and stage data come from `arkpedia-data`; animated chibi models come from [arkpedia-sd-assets](https://github.com/arkpedia/arkpedia-sd-assets). Do not copy private app files, account records or credentials into this fork. Upstream release artwork is outside its code license; the SD importer uses original model sources with provenance.

Reuse the Three.js board and Spine unit rendering, projection, animation lifecycle, browser-compatible combat primitives and tested mechanics. Adapt arbitrary standard-stage geometry, manual DP-based deployment, retreat/redeployment, stage rules and scripted waves before claiming compatibility. A skill's text does not completely specify its implementation.

## Foundation

`shared/arkpedia/squad.js` defines 1–12 unique squad members, one optional distinct support, real upgrade caps, and support maxima computed inside the simulator. It returns immutable loadouts without accepting supplied combat stats. The catalogue adapter is not wired to Arkpedia data yet.

`canDeployInViewport` defines fullscreen-only placement. It has no UI/command-handler integration yet. Native fullscreen is preferred; a dedicated viewport-filling battle workspace is the mobile fallback. Embedded previews stay view-only. Exiting must pause combat and cancel pending placement.

```sh
npm ci
node --test test/arkpedia-squad.test.js
```

Inherited tests and run/setup instructions remain in [README.md](README.md). Those verify Stronghold behavior, not regular-stage accuracy. No Arkpedia deploy target is configured.

## Milestones

1. Render a simple standard-stage grid with the Amiya/enemy SD pilot; verify Spine versions, alpha, Front/Back, roles and hit timing.
2. Adapt one stage and a small roster: squad selection, DP, tiles/facing, blocking, attacks, healing, SP, skills, retreat and end conditions.
3. Add a versioned iframe protocol, fixed simulation clock/worker, pinned content/assets, responsive fullscreen controls and pause-on-exit.
4. Expand validated skills, talents, modules, summons, enemies, devices and scripts. Publish art/mechanics coverage separately; surface unsupported rules.
5. Integrate into Arkpedia and retire the old range-preview/playback tool after supported battles and page workflows pass regression checks.

Render FPS must not change combat results. Replays record engine/content/SD revisions, seed and ordered commands. Load only the selected stage's actors/effects and release unused resources. The app-side plan is `docs/features/stage-overhaul.md` on Arkpedia's `feat/stage-overhaul` branch.
