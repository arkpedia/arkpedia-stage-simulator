# Stage supply cards

Sponsor Drone and Luxury Sponsor Drone use the same source-gated drop feature.
The original level supplies `loot.token_key` and `loot.cnt`; the global enemy
record does not invent either value. Typed injection declarations permit only
those two slots, and a dependency check requires a supported, unambiguous stage
card before publication. Hidden cards and per-instance skill/talent overrides
remain blocked. Zero initial stock stays visible as a disabled card.

A killed drone schedules one delivery using its retained one-second native
projectile lifetime. Delivery survives the source's removal. An escape grants
nothing, and neither variant increases the defeated-enemy counter. The shared
card account validates positive integer stock updates and does not reset an
existing deployment cooldown. The original `GainToken` controller and both
projectile variants are retained by the enemy evidence extractor.

Mr. Boom uses the original passive skill, five-tile plus range, twelve-second
Stun, five-DP cost and five-second deployment cooldown. Its retained half-second
Start and 1.5-second Attack clocks define the local deployment sequence. At
release it samples current ground and flying enemies through the ordinary area
selector, applies the common immunity/resistance-aware status, and withdraws.
It consumes no deployment slot, never blocks a route, and can be placed on a
buildable fence. Retreat cancels the pulse with no DP or stock refund. The card
shows stock, deployment state and cooldown; the existing device inspector shows
the countdown and retreat action.

The native assets and tables are shared references. Stage files retain only
instance configuration and provenance. `tools/arkpedia/stage-supply-cards.mjs`
checks original card instances, and the atomic publisher retains source hashes.
Focused integration tests cover zero stock, typed dependencies, duplicate death,
escapes, ground/air selection, immunity/resistance, cooldown and retreat. Native
visuals, compiled callback ordering and game-frame parity are not established by
these tests; new stages remain in the developer catalogue.

Mieszko Coils share that card account and a single controller for original
preplaced instances and player deployments. They cost five DP, recharge five
seconds after deployment, occupy no deployment slots, and require a ranged
buildable tile. Several may coexist. Only player-deployed coils can retreat;
retreat refunds half the paid DP, rounded down, without returning stock.
Invulnerability and device targeting use the existing battle paths.

The retained `trap_019_electric`, `sktok_electric` and electric projectile
components supply the 21-tile range, 2.3-second interval, 0.7-second beam and
0.65-tile width. Beams select earlier-deployed coils and hit each intersecting
enemy once, including enemies entering during their lifetime. The ordinary
status pipeline applies 1.5 seconds of Sluggish before 250 Arts periodic damage;
RES and damage modifiers still apply. The payload is unmissable and neither an
ordinary attack nor environment damage. The existing polygon/body intersection
helper handles finite strips and large enemy bodies. There are no copied
per-stage scripts or artwork.

Local mappings remain explicit: the retained selector has a one-target limit;
when several earlier coils qualify, stable deployment order selects one. Its
compiled sorting implementation is unavailable. Preplaced ordering follows the
original projected instance order. Flat beam caps, simulation-step sampling,
source-retreat survival and endpoint-removal cancellation are local mappings,
not verified Unity callback parity. The periodic passive runs from deployment;
its separate activation aura controls the inspector state. Visuals are a shared
fallback line and device marker, not native coil skins. These limitations keep
new stages in the developer catalogue. PRTS's
[Mieszko Coil entry](https://prts.wiki/w/%E6%A2%85%E4%BB%80%E7%A7%91%E7%BA%BF%E5%9C%88)
corroborates the earlier-deployment condition, interval, beam dimensions and
periodic damage classification; it does not establish selector tie ordering.

BH-6's stage-local Luxury Sponsor Drone is an explicitly reviewed feature alias.
Its original full definition supplies stats, immunities and exactly one token
identity/count pair. The compiler inherits the reviewed prefab's flight and
handbook behavior, while the runtime repeats a narrow alias shape check. It
cannot introduce another skill, arbitrary talent or alternate asset prefab.
The shared loot declaration validates parameters without installing a second
death handler. Normal and challenge tests verify exactly four delivered coils,
no defeated-enemy credit, and unchanged global records. Global and targeted
additive RES runes reuse the stage attribute compiler; BH-6 challenge adds 40
RES alongside its separate HP/ATK multipliers.

`FEATURE_ALIAS_CONTRACTS` is the atomic extension point for feature-backed
stage variants: each prefab declares its exact inherited ability list, numeric
and string parameter validators, talent-group signature and native predicate.
The compiler and runtime share that shape gate. Cheering Sponsor Drone's
stage-local variant uses the same buff controller and artwork with the original
60-second duration; successive rewards extend time without stacking DEF/ASPD.
Its source has a recovery field of one with zero maximum/initial SP, which the
contract accepts only while that account is inactive. This removes the alias
blocker from 63 stage plans; other stage mechanics still block their admission.
