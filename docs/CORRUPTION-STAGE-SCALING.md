# Shared corruption damage parameters

Six adverse-environment stages now load through the ordinary component graph:
11-7, 11-8, 11-12, 11-15, H11-1 and H11-3. Their original level rules double
the fixed Corruption damage on both recipient root tile heights from 50/25
to 100/50. No stage-specific runtime, copied enemy kit or new artwork is needed.

Rot Eater exposes only its two pollution damage talent slots to multiplicative
stage rules. Both Wither Tank variants expose the equivalent two skill slots;
their plan compiler now reads those values from the selected enemy record
instead of hardcoding the database defaults. Radius, lifespan, launch clocks,
SP and birth-stat floors retain their separate admission requirements.

The shared `nativeCorruptionTemplate` predicate verifies the original root-tile
height branch and both fixed True damage actions, including their lack of SP
credit. Both families require that same predicate. Normal database records and
their compiled plan hashes remain unchanged. Only selected stage definitions
whose parameters differ receive new immutable component objects.

Validation: 28 integration tests, including every admitted database level's
raw/compiled combat comparison; damage checks at both heights and over low
ground while airborne; source mutation refusals; and compilation of all six
original level receipts. All 967 available stages pass the ten-second library
smoke. Browser checks load and restart 11-12 and H11-1 adverse variants with
100/50 in their prepared plans and no source registry/compiler requests or
browser errors. These checks do not claim original-client frame parity or full
playthroughs. Evidence: `data/arkpedia-corruption-stage-scaling-review.json`.
