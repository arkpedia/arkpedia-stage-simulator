# Flamechaser Soldiers and reusable ember forms

Both Dublinn Flamechaser Soldier variants use the same `emberRebirth` and
`burningReedsAttack` features. The original level loader now admits FC-2,
FC-EX-1, its challenge variant and FC-TR-1. No stage-specific runtime branch was
added. This checkpoint has 633 supported enemies and 832 loadable combat stages.

The retained original prefab components include both modes, native rebirth
helpers, mode ancestry, invisibility checker, terrain selector and its circle,
entry skill, marker and buff templates. The source contract rejects changed
mode destinations, HP restoration, hit-count parameters, terrain modes,
invisibility restoration, animation bindings and template action graphs.
`data/arkpedia-flamechaser-animations.json` retains exact clocks from each
prefab's original skeleton in the pinned `enm_art_11.ab` bundle.

The runtime reuses the existing hit-count and rebirth engine. A first defeat
clears removable statuses, releases blocking, and enters a one-second protected
transition. The ember then walks without attacking, takes five damage instances
to defeat and becomes visible while blocked and for three seconds afterward.
Surviving ten seconds restores its ordinary HP and attacks; it can repeat this
cycle. Only final death grants kill credit. The regular renderer uses the
original Die, Start, Idle_2, Move_2, Die_2 and Revive clips from the same model.

Ordinary-form attacks gain Burn build-up equal to ATK when a burning Reeds tile
center is within the source radius of 1.5 tiles. `StageReeds.hasBurningNear`
provides the common predicate; no enemy owns another terrain copy. Unlit or
cooling Reeds, out-of-range terrain and the ember form do not grant this rider.

The source prefab and templates establish the two modes and transition effects.
The one-second protected transition and ten-second ember behavior also agree
with [PRTS](https://prts.wiki/w/深池逐火战士) and the
[enemy description](https://arknights.wiki.gg/wiki/Dublinn_Flamechaser_Soldier).
Native controller bodies and client-frame ordering are not certified. In
particular, the inherited ordering of invisibility application and block release
is a simulation assumption. Start and Revive are presented using original clip
durations; their exact native action-lock timing remains unverified. The native
attached flame effects are not rendered. Registration is not a claim of pixel
or frame parity.

Artwork uses two original bodies in shared SD commit
`0b685d559dcc43cee3dbbcb1c676b639160a25e2`. Each body holds both forms; there is no
second copy for the ember. Desktop and touch galleries decode all 22 clips.
The artwork adoption command now publishes the lightweight client model index
alongside the snapshot, fixing missing models after otherwise valid additions.
Loopback preview also supplies verified local asset transport for the lazy model
index. Model components retain their original bytes and hashes; hosted clients
continue to use published URLs.

Validation covers five-hit death, repeat revival, kill credit, status cleanup,
blocking, delayed invisibility restoration, movement, Burn range boundaries,
source drift, original-stage admission and lazy model hydration. The all-stage
10-second smoke passes 832/832; this is not a playable-clear certificate.

Broader checks also exposed three legacy expectations predating earlier source
reviews. Witherer native death projectiles check Silence despite the old handbook
label; Chimera uses a 56/30-second transformation after its 0.5-second detection
clock. The legacy tests now assert those reviewed behaviors. All 257 legacy enemy
tests pass, alongside the focused Witherer and Originium-pollution tests.
