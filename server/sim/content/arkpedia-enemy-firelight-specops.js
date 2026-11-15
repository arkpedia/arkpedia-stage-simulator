// SPDX-License-Identifier: GPL-3.0-or-later
import { chargedMeleeSequence } from './arkpedia-enemy-charged-melee.js';
export function firelightSpecOps({attackAnim,...p}) {
  return [
    {iv:.1,spawn(_b,e){e.def={...e.def,attackAnim};},
      tick(b,e){b.stageReeds?.ignite(Math.round(e.y),Math.round(e.x));}},
    chargedMeleeSequence(p),
  ];
}
