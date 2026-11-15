# Exhausted Flame

Both database variants of Exhausted Flame use one native prefab and one shared
runtime. This checkpoint admits 644 of 2163 enemies; 855 of 3892 stages are
loadable. Eblana remains blocked, so admitting her summoned enemy does not yet
admit FC-8 or FC-EX-8.

The native same-tile aura owns Disarmed and Skill Not Activatable buffs on
characters occupying its tile. Each instance removes only its own suppression.
Losing the host or removing the bound buff kills that flame. The new shared
`skillNotActivatable` flag prevents both manual and automatic skill starts,
including free activation, without spending SP or ending an already active
skill. UI readiness uses the same eligibility check.

The flame cannot move or be displaced. A one-second timer removes 5% of its
maximum HP through unmodified, sourceless true damage without SP recovery.
Its killed event deals Arts damage equal to ATK and a separate Burn packet of
1.25 times ATK in the source `x-5` cross. The source action graph does not filter
this explosion to player-caused deaths. Natural expiry, host withdrawal and
empty-tile self-destruction therefore use the same death path. Leak/removal does
not explode. Ordinary target eligibility still applies to explosion victims.

Admission checks the native aura, recipient flags, periodic damage action,
death actions, target selectors and cross geometry. Both variants reference
`enemy_1294_duchns`; no duplicate model is created. This prefab has no animator:
the original particle-only body is not yet rendered. Runtime hit effects use
the simulator's existing presentation. Serialized action evidence establishes
the implemented contract, not native frame-order parity.

Validation: 342 focused and regression tests pass, including independent
suppression sources, host withdrawal, automatic skill release, an active skill
surviving suppression, natural expiry, Burn burst and source mutations. All
855 admitted stages pass the ten-second constructor/runtime smoke check. This
is not a certificate of playable clears. Historical evidence is retained in
`data/arkpedia-enemy-exhausted-flame-review.json`.
