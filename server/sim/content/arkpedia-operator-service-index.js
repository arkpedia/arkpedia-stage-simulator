// SPDX-License-Identifier: GPL-3.0-or-later
// Squad-wide services load by source-owner membership, not the receiving card.
// Keep module paths literal so browsers can load them without the eager registry.
export const OPERATOR_SERVICE_INDEX = Object.freeze([
  Object.freeze({ ...{"key":"squad:medics","module":"./arkpedia-medics.js","ids":["char_298_susuro"],"hooks":{},"services":{"installMedicSquad":"noop"}}, load: () => import("./arkpedia-medics.js") }),
  Object.freeze({ ...{"key":"squad:five-star-vanguards","module":"./arkpedia-five-star-vanguards.js","ids":["char_115_headbr","char_102_texas"],"hooks":{},"services":{"prepareFiveStarVanguardSquad":"zero"}}, load: () => import("./arkpedia-five-star-vanguards.js") }),
  Object.freeze({ ...{"key":"squad:five-star-snipers","module":"./arkpedia-five-star-snipers.js","ids":["char_218_cuttle"],"hooks":{},"services":{"prepareFiveStarSniperSquad":"noop"}}, load: () => import("./arkpedia-five-star-snipers.js") }),
  Object.freeze({ ...{"key":"squad:five-star-vanguard-second","module":"./arkpedia-five-star-vanguard-second.js","ids":["char_496_wildmn","char_401_elysm"],"hooks":{},"services":{"adjustFiveStarVanguardSecondCost":"cost","consumeFiveStarVanguardSecondCard":"noop"}}, load: () => import("./arkpedia-five-star-vanguard-second.js") }),
  Object.freeze({ ...{"key":"squad:guard-six-star","module":"./arkpedia-guard-six-star.js","ids":["char_263_skadi","char_172_svrash"],"hooks":{},"services":{"installGuardSixStarSquad":"noop"}}, load: () => import("./arkpedia-guard-six-star.js") }),
  Object.freeze({ ...{"key":"squad:bagpipe","module":"./arkpedia-bagpipe.js","ids":["char_222_bpipe"],"hooks":{},"services":{"installBagpipeSquad":"noop"}}, load: () => import("./arkpedia-bagpipe.js") }),
  Object.freeze({ ...{"key":"squad:rosa","module":"./arkpedia-rosa.js","ids":["char_197_poca"],"hooks":{},"services":{"prepareRosaSquad":"noop"}}, load: () => import("./arkpedia-rosa.js") }),
  Object.freeze({ ...{"key":"squad:jieyun","module":"./arkpedia-jieyun.js","ids":["char_4078_bdhkgt"],"hooks":{},"services":{"adjustJieyunCost":"cost"}}, load: () => import("./arkpedia-jieyun.js") }),
  Object.freeze({ ...{"key":"squad:radiant-knight","module":"./arkpedia-radiant-knight.js","ids":["char_1014_nearl2"],"hooks":{},"services":{"installRadiantKnightSquad":"noop"}}, load: () => import("./arkpedia-radiant-knight.js") }),
  Object.freeze({ ...{"key":"squad:nian","module":"./arkpedia-nian.js","ids":["char_2014_nian"],"hooks":{},"services":{"prepareNianSquad":"noop"}}, load: () => import("./arkpedia-nian.js") }),
  Object.freeze({ ...{"key":"squad:ines","module":"./arkpedia-ines.js","ids":["char_4087_ines"],"hooks":{},"services":{"adjustInesCost":"cost"}}, load: () => import("./arkpedia-ines.js") }),
  Object.freeze({ ...{"key":"squad:closur-roster","module":"./arkpedia-closur-roster.js","ids":["char_4228_closur"],"hooks":{},"services":{"installSelectedClosurRoster":"noop"}}, load: () => import("./arkpedia-closur-roster.js") }),
  Object.freeze({ ...{"key":"squad:muelsyse-public","module":"./arkpedia-muelsyse-public.js","ids":["char_249_mlyss"],"hooks":{},"services":{"installPublicMuelsyseSquad":"noop"}}, load: () => import("./arkpedia-muelsyse-public.js") }),
  Object.freeze({ ...{"key":"squad:marcil","module":"./arkpedia-marcil.js","ids":["char_4141_marcil"],"hooks":{},"services":{"installMarcilSquad":"noop","marcilBenchMana":"noop"}}, load: () => import("./arkpedia-marcil.js") }),
  Object.freeze({ ...{"key":"squad:saileach","module":"./arkpedia-saileach.js","ids":["char_479_sleach"],"hooks":{},"services":{"adjustSaileachCost":"cost","consumeSaileachCard":"noop"}}, load: () => import("./arkpedia-saileach.js") }),
  Object.freeze({ ...{"key":"squad:fang-fire-sharpened","module":"./arkpedia-fang-fire-sharpened.js","ids":["char_1036_fang2"],"hooks":{},"services":{"adjustFangFireSharpenedCost":"cost","consumeFangFireSharpenedCard":"noop","fangFireSharpenedRefund":"required"}}, load: () => import("./arkpedia-fang-fire-sharpened.js") }),
  Object.freeze({ ...{"key":"squad:ash","module":"./arkpedia-ash.js","ids":["char_456_ash"],"hooks":{},"services":{"adjustAshCost":"cost"}}, load: () => import("./arkpedia-ash.js") }),
  Object.freeze({ ...{"key":"squad:muelsyse-squad","module":"./arkpedia-muelsyse-squad.js","ids":["char_249_mlyss"],"hooks":{},"services":{"adjustMuelsyseSquadCost":"cost"}}, load: () => import("./arkpedia-muelsyse-squad.js") }),
  Object.freeze({ ...{"key":"squad:lappland-alter","module":"./arkpedia-lappland-alter.js","ids":["char_1038_whitw2"],"hooks":{},"services":{"installLapplandSquad":"noop"}}, load: () => import("./arkpedia-lappland-alter.js") }),
  Object.freeze({ ...{"key":"squad:thorns-lodestar","module":"./arkpedia-thorns-lodestar.js","ids":["char_1039_thorn2"],"hooks":{},"services":{"captureThornsRoads":"noop"}}, load: () => import("./arkpedia-thorns-lodestar.js") }),
  Object.freeze({ ...{"key":"squad:shu","module":"./arkpedia-shu.js","ids":["char_2025_shu"],"hooks":{},"services":{"installShuRoster":"noop"}}, load: () => import("./arkpedia-shu.js") }),
  Object.freeze({ ...{"key":"squad:specter-alter","module":"./arkpedia-specter-alter.js","ids":["char_1023_ghost2"],"hooks":{},"services":{"prepareSpecterAlterSquad":"noop"}}, load: () => import("./arkpedia-specter-alter.js") }),
]);
