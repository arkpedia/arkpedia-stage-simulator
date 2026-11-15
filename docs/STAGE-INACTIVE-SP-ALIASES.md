# Inactive SP defaults in local enemy definitions

Some original levels serialize `spRecoveryPerSec = 1` for local enemy definitions with no skills and no SP capacity or initial charge. The alias loader previously rejected those definitions before their reviewed prefab behavior could load.

The loader now accepts that exact native default for ordinary feature-free aliases and explicit feature-alias contracts. Sponsor contracts opt in, matching the existing Cheering Drone contract. Definitions with a skill, nonzero SP capacity/charge, another recovery value or an unrelated unsupported attribute remain refused. Values, rewards and identities remain independent; all variants reuse the original prefab model.

Retained original definitions demonstrate three Sponsor aliases in CR-MO-1, the elite Sponsor alias in two IS5 variants, and two ordinary melee aliases in the unnamed guide level. Eleven focused alias/source integration tests pass, including active-SP and unknown-skill refusals. This removes an alias blocker without overriding the remaining device, environment, enemy, conditional-program or missing-title checks. None of these four stages is advertised as complete by this change.
