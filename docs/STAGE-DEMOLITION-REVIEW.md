# Pillars, Demolition Devices and Battlefield Ruins

The three devices share one battle controller. Static pillars retain their
original activation, level and override validation; supplied demolition cards
reuse the common stock, DP, cooldown, placement, facing picker and retreat paths.
Ruins reuse device bodies, obstacle routing, enemy blocking and removal. No stage
contains a copied behavior script or duplicate asset.

Evidence is retained in the checksum-pinned device tables and native prefab
export (`trap_043_dupilr`, `trap_044_duruin`, `trap_045_dublst`, `sktok_dupilr`,
`sktok_dublst`). The extractor now follows referenced buff templates recursively,
including references inside serialized action trees, and stores each template
once. Source gates reject changed selectors, timing, categories and skill tuples.
PRTS [Pillar](https://prts.wiki/w/破碎支柱),
[Demolition Device](https://prts.wiki/w/爆破装置) and
[Ruins](https://prts.wiki/w/战场废墟) corroborate the interactions.

Pillars accept ordinary damage only from the four orthogonally adjacent tiles.
Sourceless and environment damage are refused before HP loss. The first lethal
hit leaves one HP, removes the initial Undeadable flag after that receipt, and
grants two seconds of invulnerability, untargetability and isolation. A subsequent
lethal hit starts collapse. Tagged demolition and pillar hits can topple an
intact pillar directly; the two-second protection still prevents those hits.

The collapse faces away from the source and releases after 1.5 seconds. Its
native range includes the origin and two forward tiles, deals current ATK as
True damage to enemy characters (including flyers), stuns for ten seconds and
force-kills allied characters/traps. Obstacle bodies are excluded. Buildable
forward ground tiles receive 100-HP, three-block rubble; occupied or unavailable
tiles do not. Ruins use their native squared blocking radius of 0.3, can be broken
by blocked enemies, and can be retreated through the shared device inspector.

Demolition Devices cost five DP, occupy no deployment slot, accept either
buildable tile type, recharge for five seconds and allow one active instance.
The one-shot native trigger waits 0.5 seconds, followed by the fixed 0.65-second
attack delay. Its two-cell directional range deals 2,000 True damage to ground
enemies and applies directional force 1. It then removes itself. Retreat cancels
release without refunding DP or stock.

Tests exercise actual damage receipts rather than fabricated post-damage events:
selection, lethal sequencing, chain reactions, air/ground targets, pushing,
protected allies, rubble creation/destruction, native blocking radius, payment,
stock and cancellation. Browser review uses the actual card, map, direction
picker, rubble inspector and retreat button. All ten added stages pass browser
startup and complete wave sweeps. The sweep explicitly initiates pillar collapse:
an idle no-deployment run can remain blocked by intact pillars. Receipts identify
this controlled setup and do not claim a playable clear.

The source-data/behavior review does not establish original Unity callback frame
parity or device artwork parity. Shared fallback rendering remains. Boss-directed
collapse and Deep Pool Incinerator death attacks still require their own enemy
source integration; generic unrelated explosions do not gain demolition tags.
New stages remain in the developer catalogue.
