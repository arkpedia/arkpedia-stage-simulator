# Kichisei source preparation

This is held source selection, not a combat or public-roster approval. The normal preview remains at 385 source forms and 840 skills after Snow Hunter.

`data/arkpedia-native-operators/char_4203_kichi.json` is frozen at 296,251 bytes, SHA-256 `171761adf7b8bc65b03ea6f0d95f2a8bf9c3d0c16bcf836d99e2a1088448b025`. The original CN source commit is `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`, client `26-09-22-07-47-20_6c71fa`. Five bundles retain 71 owner/skill components, original art and nine transitive templates. There are no referenced projectile or token graphs and no unresolved native/JSON templates.

The input selector covers both skills at all ten ranks, promotions, potential and trust. Nineteen source checks verify these inputs on Node 22 and 24. Combat needs separate checks for:

- Direct attacks against all eligible bodies in range, with the source front-row mark applying 150% ATK. Reuse the existing spreadshooter/body/range/damage helpers where their contracts agree.
- S1's four ATK stacks from `ON_AFTER_ATTACK`, rather than one stack per enemy hit. Skill finish clears the source stack buff.
- S2's initial Slow, then Bind, then Stun cycle. The source advances flags after an attack; all targets in a wave must use the same flag state. The attached status is explicitly not damage-missable.
- The talent's source enemy-ID set, two/three-stack cap and additive output-damage coefficient. Repeated kills of the same enemy definition must not fabricate another type.
- Original Begin/Loop/Idle/End and Front downward tracks, uncapped native firing speed and control/cast/end ordering. Back has no death clip. Spine `OnPlayAudio` reload markers are not ammunition mechanics.

The inherited `data/chess.json` snapshot has no Kichisei entry. This is not a claim about other or newer upstream revisions. Modules, native effects/audio, compiled event/FSM dispatch and original frame/pixel parity remain unverified. Art compatibility, combat behavior, public squad selection, original waves and browser controls are still pending.
