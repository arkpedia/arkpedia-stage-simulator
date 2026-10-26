// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit internal instance adapter. Does not admit 17-14 or define its card
// regeneration, manual withdrawal, story, or initial native FSM dispatch.
import source from '../../../data/candidates/arkpedia-stage-17-14-source.json' with {type:'json'};
import native from '../../../data/arkpedia-native-operators/char_4228_closur.json' with {type:'json'};
import {normalizeChess} from '../simdata.js';
import {CLOSUR_ID as ID,selectedClosurBuild} from './arkpedia-closur-source.js';
import {prepareClosurCombat,CLOSUR_COMBAT_CONTRACT} from './arkpedia-closur-combat.js';
import {installClosurRoster,CLOSUR_ROSTER_CONTRACT} from './arkpedia-closur-roster.js';
import {installClosurDeck} from './arkpedia-closur-deck.js';
import {assertClosurEnemyCompatibility} from '../../../shared/arkpedia/closur-enemy-compatibility.js';

const retained=JSON.stringify(source),roles=new WeakMap();
export const CLOSUR_PREDEFINED_CONTRACT=Object.freeze({
 scope:'Exact canonical 17-14 Closure instance, separate field control, module and command center',
 limits:'Internal explicit installation only. Stage admission, initial native FSM timing, manual withdrawal and card regeneration remain held.',
 frameParity:false,
});
export const CLOSUR_PREDEFINED_KEY='predefined:17-14:char_4228_closur:0';
export function currentClosurPredefined(b){
 const role=roles.get(b),u=role?.u,entry=role?.entry;
 if(!role||b.finished||b._endReq||b.predefinedOperators?.get(CLOSUR_PREDEFINED_KEY)!==entry||entry.unit!==u||entry.life!==role.life
  ||!u.alive||!u.deployed||u.deploySeq!==role.life||u.skill!==role.skill||u.def!==role.def||!b.units.includes(u))return null;
 return Object.freeze({key:CLOSUR_PREDEFINED_KEY,build:entry.build,record:role.def.raw,unit:u,life:role.life,predefined:true});
}

export function selectedClosurPredefined(input=source,{contract}={}){
 if(contract!==CLOSUR_PREDEFINED_CONTRACT||JSON.stringify(input)!==retained)
  throw Error('Unreviewed predefined Closure stage source');
 const p=input.rawLevel.predefines.characterInsts[0];
 const exclusions=input.rawLevel.runes.filter(r=>r.key==='char_exclude');
 const root=native.characters[ID].flatMap(r=>r.components).find(c=>c.data._occupiedRemainingCharacterCnt===1&&c.data._withdrawCostRecoverRatio===.5);
 if(exclusions.length!==1||exclusions[0].difficultyMask!=='ALL'||exclusions[0].blackboard.length!==1
  ||exclusions[0].blackboard[0].key!=='char'||exclusions[0].blackboard[0].valueStr!==ID||!root)
  throw Error('Unreviewed predefined Closure exclusion or deployment slot');
 const build={id:ID,elite:2,level:p.inst.level,potential:p.inst.potentialRank+1,trust:p.inst.favorPoint*2,
  skillId:'skchr_closur_3',skillRank:p.mainSkillLvl,module:p.uniEquipIds[0].key,moduleLevel:p.uniEquipIds[0].level,stage:'17-14'};
 const selected=selectedClosurBuild(build),c=native.tables.character;
 const record={chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
  subProfessionId:c.subProfessionId,stats:selected.stats,rangeGrid:selected.rangeGrid,tags:selected.tags,talents:selected.talents,
  skill:{...selected.source,...selected.source.spData,skillId:build.skillId,rangeGrid:selected.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build};
 return{key:CLOSUR_PREDEFINED_KEY,build,record,row:p.position.row,col:p.position.col,dir:p.direction,deploymentSlotCost:root.data._occupiedRemainingCharacterCnt};
}

export function installClosurPredefined(b,{source:input=source,contract}={}){
 const entry=selectedClosurPredefined(input,{contract});
 assertClosurEnemyCompatibility(b.data.raw);
 if(b.finished||b._endReq||b.time!==0||!b.getPlayer('arkpedia')||b.bench[ID]
  ||roles.has(b)||b.predefinedOperators?.has(entry.key)||b.regularClosurRoster||b.regularDpFloors?.has('arkpedia')
  ||b.allyUnits.some(u=>u.defId===ID)||b.regularSummons?.has(`summon:${ID}`))
  throw Error('Predefined Closure requires a fresh separate stage instance');
 if(!b.grid.inRect(entry.row,entry.col)||b.unitAt(entry.row,entry.col)||b.tileReservation(entry.row,entry.col)||b.downOn(entry.row,entry.col)
  ||b.deployedSlots()+entry.deploymentSlotCost>b.unitLimit)
  throw Error('Predefined Closure source placement is unavailable');
 const u=b._makeAlly(b.getPlayer('arkpedia'),normalizeChess(entry.record),'op',entry.row,entry.col,{dir:entry.dir});
 u.deploymentSlotCost=entry.deploymentSlotCost;
 const prepared=prepareClosurCombat(b,u,{contract:CLOSUR_COMBAT_CONTRACT});
 b._setupUnit(u,prepared.kit);u.mem.closur=prepared;u.mem.regularControlId=entry.key;
 installClosurRoster(b,[entry.build],{contract:CLOSUR_ROSTER_CONTRACT});
 prepared.controller.install();
 // No player card or paid deployment exists for this source characterInst.
 // In particular, do not register a player payment or consume a card discount.
 if(!b._deploy(u,{initial:true,tile:[entry.row,entry.col]}))throw Error('Predefined Closure deployment rejected');
 installClosurDeck(prepared.point);
 entry.unit=u;entry.life=u.deploySeq;entry.predefined=true;
 b.predefinedOperators??=new Map();b.predefinedOperators.set(entry.key,entry);
 roles.set(b,{entry,u,life:u.deploySeq,def:u.def,skill:u.skill});
 return{...prepared,entry,u};
}
