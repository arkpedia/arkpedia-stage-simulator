// SPDX-License-Identifier: GPL-3.0-or-later
import { blockedMeleeProjectileAttack as projectile } from './arkpedia-enemy-projectiles.js';
import { stageOutcomeCounter } from './arkpedia-stage-outcomes.js';
export const blockedMeleeProjectileAttack=p=>[projectile(p),...(p.killedKey?[stageOutcomeCounter({killedKey:p.killedKey})]:[])];
