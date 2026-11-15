# Selected spawning mechanics

The shared summons module now owns the existing death-spawn, delayed-death,
periodic-spawn and seed-summoner factories. Its small helper graph does not
import the legacy enemy catalog. The fixed runtime index loads it for these
four kinds, while the legacy factory map references the same implementations.
Direct legacy death spawns also reuse the shared function.

All 198 focused checks, 287 legacy enemy/boss/transformation/crew checks and
969 ten-second stage smoke checks pass. A browser import check verifies that
the spawning group loads without the legacy catalog. The loaded Victoria
stage emits three controlled seeds and restarts without errors; other legacy
abilities in that stage still select the catalog.

No timing, placement or parameters change. In particular, this extraction does
not certify native BornBugs offsets or its delayed release. Evidence:
`data/arkpedia-enemy-spawning-loading-review.json`.
