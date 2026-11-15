// SPDX-License-Identifier: GPL-3.0-or-later
import { heavyPowerArmor as armor } from './arkpedia-enemy-heavy-power-armor.js';
import { stageOutcomeCounter } from './arkpedia-stage-outcomes.js';
export const heavyPowerArmor=p=>[armor(p),stageOutcomeCounter({killedKey:'killed'})];
