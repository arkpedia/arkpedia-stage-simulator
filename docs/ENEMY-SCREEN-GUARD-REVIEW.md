# Arc Screenguard damage response

Arc Screenguard and Arc Screenguard Leader now use the shared damage-response
registry. Each resolved damage instance adds one permanent count. The first
count does not change stats; from two counts onward, every count contributes
−50 DEF and −2 RES. Counts cap at 80 and 85 respectively. The damage that adds a
count uses the previous stats. Silence does not suppress the response;
elemental gauge buildup, cancelled hits and invulnerability do not add counts.

The reusable `damageStatDecay` factory also replaces the older mode-specific
implementation, correcting its first-hit reduction. Each enemy owns its own
buff account. A new spawn starts at zero. Sourceless damage uses the same
post-resolution hook and the usual shared stat clamps remain in effect.

The source extractor retains both original prefabs and their
`enemy_cbshld_t` template in the existing checksum-verified enemy evidence file.
The feature predicate verifies the ordinary physical attack, passive lifetime,
stack account, additive attribute nodes and visual-only branches. Unknown
combat actions, changed attack scaling, stack limits or modifiers are refused.
The native `_useOneAsMinCnt=false` interpretation is corroborated by the
[PRTS Arc Screenguard Leader entry](https://prts.wiki/w/%E5%BC%A7%E5%85%89%E9%95%9C%E5%8D%AB%E9%95%BF),
which specifies that resistance reduction starts at two counts.

This admits two enemy records (609 total). No stage becomes available from this
change alone: their other missing mechanics remain explicit blockers. The
follow-up shared-artwork import now supplies both original bodies; see
`data/arkpedia-reaction-enemy-artwork-review.json`. Native shield-effect
transitions remain separate work. This is not a native frame/visual parity
certificate.
