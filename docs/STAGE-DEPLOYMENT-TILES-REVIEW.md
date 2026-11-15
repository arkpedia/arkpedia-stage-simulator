# Stage deployment restrictions

`global_forbid_location` accepts an exact pipe-separated list of integer
`(row,column)` coordinates. The original positions use bottom-origin rows,
as do Arkpedia's exported geometry and battle positions. The original level's
map array itself is top first: preflight verifies the selected tile using
`map[rows - 1 - row][column]`, including its key and buildability, against the
exported geometry. The full original blob digest becomes an atomic-publication
dependency. Missing evidence, duplicate coordinates, malformed values and
out-of-bounds locations refuse compilation.

SA-3 Challenge forbids `(4,2)`, `(4,3)`, `(4,4)`, `(5,4)`. The
[PRTS stage reference](https://prts.wiki/w/SA-3_峡道) explicitly identifies these
as `(Y,X)` from the bottom-left origin. They are not mirrored in the battle.

The adapter changes only these tiles' buildability in its private grid;
walkability, height, terrain hazards and the original geometry stay intact.
Manual operator/summon placement follows the grid, and supplied-device
placement checks the same restriction. Red crosses mark the four cells in the
battle renderer, and accessible tile labels describe the restriction.

Tests cover original coordinate parsing, orientation verification, operators,
summons, supplied devices, unchanged movement/terrain, and source immutability.
The developer-only stage retains its original enemy challenge multipliers and
rule provenance. Browser startup and wave-schedule receipts do not certify a
playable clear or native visual parity.
