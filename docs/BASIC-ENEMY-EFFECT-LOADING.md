# Selected reusable enemy effects

Seventeen existing effect factories now live in
`arkpedia-enemy-basic-effects.js`: building and secondary area attacks, block
reduction, periodic attack stun, DEF reduction, death stacks, movement bonus,
named targeting, hit shield, timed stats, blocked DEF/RES, blocked attack
scaling, stealth reveal, attack healing, creation resistance and blocker Block.
The fixed runtime index loads this module for those kinds. The legacy public
factory map uses the same function objects; no mechanic is copied.

Browser checks load and restart AF-2, AF-3 and AW-S-2 without fetching the legacy
enemy catalog. AF-2 and AF-3 select only the basic-effects enemy group; AW-S-2
also selects its two modern enemy groups. The module is a shared implementation
boundary, not a new admission rule. New enemies can compose these effects in
their data plans without adding a per-enemy runtime class.

All 969 available stages pass ten-second smoke checks, and 16 focused runtime
and API tests pass. The broad simulation/content suite reports 1,797 passed,
three skipped and the same two baseline Chimera pollution failures. This refactor preserves the previous parameters and native
coverage. Evidence: `data/arkpedia-basic-enemy-effects-loading-review.json`.
