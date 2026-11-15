# Zealous Extra paired-marker blocking

Both enemy_10095_crgst variants now share a type-1 acquisition condition: at least one pair must have both the blocker marker and enemy marker present. Normal block capacity and no-block flags still apply. Existing relationships use an independently owned blocker-side check every 0.1 seconds, including while the enemy is stunned. Loss of the shooting marker releases the enemy; removing its own marker suppresses that release check and denies new acquisition.

The native content gate checks the empty combat component, marker, owner/source bindings, immediate release action and polling clock. Multiple enemies sharing a blocker retain separate checker lifetimes and cleanup. This does not implement other native condition modes or empty-key wildcard forms.

[Native reference](../data/arkpedia-blocker-buff-pairs-reference.json) pins the secondary public method listing and its reported binary provenance. No independent binary extraction or live XLua observation was performed. [Review receipt](../data/arkpedia-zealous-extras-review.json) records source hashes, tests, desktop/touch fixtures and body clips. Both native bodies render correctly; eight clips decode across the pair. Asset commit: a94741b573c9abe87692518b876aa577b5a2c497.

Coverage rises from 719 to 721 enemy definitions. Available stages remain 970 because the associated filming environment is still gated. All 970 stages pass their ten-second runtime smoke. Focused tests pass; the broad run retains the two previously established Chimera failures (1801 pass, 2 fail, 3 skip). Browser fixtures exercise isolated actors and do not certify a filming-stage clear.
