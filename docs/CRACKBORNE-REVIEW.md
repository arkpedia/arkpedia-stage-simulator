# Crackborne source preparation

Crackborne (`char_4225_tanya`) remains outside the public roster. The normal preview stays at 387 frozen source forms and 844 skills, with 44 forms remaining. This preparation does not register attacks, skills, artwork or browser gameplay.

The original foundation contains 236,082 bytes, SHA-256 `03e393621ac50e478e6816846c0fbb9b3d0dc5409e4914d7ec483fc1858c967c`. It is pinned to CN commit `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`, client `26-09-22-07-47-20_6c71fa`. Five native bundles retain 62 owner/skill components and six transitive templates. No referenced projectile/token graph or unresolved template remains.

Independent source audits on Node 22 and 24 reproduce seven outputs and reject 28 altered-source or premature-approval claims per version. Twenty-two source-selection and exact-clock checks pass on both versions, covering all twenty skill ranks, promotions, potential, trust, talent operands, source events and malformed/locked selection rejection.

The source distinguishes two ordinary `Attack_1`/`Attack_2` clips, a mode-mapped `Skill_1_Loop` and a one-shot `Skill_2`. Both ordinary markers occur at approximately 0.566667 seconds, S1 at 0.633333 and S2 at 0.666667. S1 has a 0.4-second Begin, 0.266667-second End and six native End transition pairs. The S2 ability uses native `timeMode=1`, unlike Cairn's attack-speed-based S2 clock; it must not inherit Cairn's timing blindly.

S1 increases maximum HP for twenty seconds and applies fixed self elemental recovery. S2 supplies capped permanent DEF stacks and erosion injury triggered by attacks received. The talent combines its general resistance operand with an additional WATER operand before the native one-minus scale. These are retained inputs, not installed mechanics. Elemental intake/recovery, attack-receipt versus accepted-HP-loss reaction order, stack spending, override priority, native clock/FSM dispatch and artwork require separate review.

Modules, native effects/audio and original frame/pixel parity remain unverified. Arkpedia app dev and production remain untouched.
