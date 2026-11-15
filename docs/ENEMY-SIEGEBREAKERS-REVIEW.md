# Siegebreaker landing and ordinary melee

Guerrilla Siegebreaker and its Leader now compose three shared components: the native Inspiration receiver, the existing passive birth-phase mapping, and a data-driven ordinary melee animation sequence. The Leader is newly admitted; the ordinary variant gains its previously missing landing and hit timing.

Both source prefabs have a 1.5-second birth delay and a 1.5-second Start clip. The shared birth mapping holds movement, blocking, targeting and ordinary damage during that phase. The native Start marker is retained at 1 second; it is not substituted for the root's 1.5-second delay. Death now clears a birth helper's own visual without clearing another component's later animation.

Ordinary physical melee waits for the Attack marker at 13/30 seconds in a one-second clip, retaining the existing attack receipt, cooldown and captured deployment. Control and death cancel unreleased hits; a vanished target cannot receive a hit. The sequence follows slowdown. Projectile and melee adapters share one timeline validator and the same ordinary sequence implementation.

The native source gate checks the complete record contract, root birth scope, default mode, simple melee packet, marker wait, animation aliases, exact clocks and Inspiration value. The Leader's 80% Inspired ATK replaces the ordinary variant's 50%; the Herald's separate 10% grant still stacks through the existing percentage channel. Both bodies retain their original assets; the Leader artwork is pinned to `fa3808429cd6972833faf09172ff9ddf150955e7` and is not byte-identical to the ordinary body.

Fifty-six integration tests and the existing body/feature regressions pass. Desktop/touch fixtures verify no early hit, an ordinary melee release 0.4333 seconds after attack start, and Inspired ratios of 1.6/1.9 with a Herald. Both original bodies decode all six clips and render correctly. These are isolated actors on compiled 0-1 geometry, not stage clears. The birth behavior uses the simulator's existing shared mapping; exact native callback/frame ordering and landing particles remain outside this review.

All 970 available stages pass runtime smoke. The broad suite retains the two known Chimera failures; its heavy-field benchmark also exceeded the threshold during concurrent source/browser work, then passed alone at a best 235.3 microseconds per tick against a 500-microsecond limit. Enemy coverage is now 723, with 788 admitted database levels. Stage availability remains 970 because the stages using the new Leader have other unresolved capabilities.
