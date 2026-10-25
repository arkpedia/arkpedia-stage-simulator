// SPDX-License-Identifier: GPL-3.0-or-later
// Internal canonical 17-16 instance and literal tutorial SP receiver. This does
// not define dialog pausing, hidden-card activation, withdrawal or stage admission.
import tutorial from '../../../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import native from '../../../data/arkpedia-native-operators/char_4226_veen.json' with{type:'json'};
import{sourceCandidate}from'../../../shared/arkpedia/summons.js';
import{normalizeChess}from'../simdata.js';import{genericKit}from'./generic.js';
import{customizeVeenKit,installVeen,selectedVeenBuild}from'./arkpedia-veen.js';
const ID='char_4226_veen',retained=JSON.stringify(tutorial),roles=new WeakMap();
export const VIY_PREDEFINED_KEY='predefined:17-16:char_4226_veen:0';
export const VIY_SP_TUTORIAL='Obt/Tutorial/Level/main_17-15_c';
export function selectedViyPredefined({source=tutorial}={}){
 if(JSON.stringify(source)!==retained)throw Error('Unreviewed predefined Viy tutorial source');
 const insts=source.predefines.characterInsts,p=insts[0],roots=native.characters[ID].flatMap(r=>r.components??[]).filter(r=>r.data?._occupiedRemainingCharacterCnt!==undefined);
 if(insts.length!==1||p.inst.characterKey!==ID||p.inst.phase!=='PHASE_2'||p.inst.level!==90||p.inst.potentialRank!==5||p.inst.favorPoint!==100
  ||p.skillIndex!==2||p.mainSkillLvl!==8||p.uniEquipIds!==null||p.hidden!==false||p.alias!==ID+'#1'||p.direction!=='RIGHT'||p.position.row!==4||p.position.col!==3
  ||p.overrideSkillBlackboard!==null||p.overrideTalents!==null||roots.length!==1||roots[0].data._occupiedRemainingCharacterCnt!==1
  ||JSON.stringify(source.scripts[VIY_SP_TUTORIAL].instructions)!==JSON.stringify([{kind:'header',tutorial:true},{kind:'ensureMinSp',charId:ID,sp:50}]))throw Error('Unreviewed predefined Viy role or SP instruction');
 const build={id:ID,elite:2,level:90,potential:6,trust:200,skillId:'skchr_veen_3',skillRank:8,module:null,stage:'17-16'},selected=selectedVeenBuild(build),c=native.tables.character;
 const selectedTrait=sourceCandidate(c.trait.candidates,build),trait={...selectedTrait,bb:Object.fromEntries(selectedTrait.blackboard.map(r=>[r.key,r.value]))},record={chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,dmgType:'arts',
  stats:selected.stats,rangeGrid:selected.rangeGrid,tags:selected.tags,talents:selected.talents,trait,
  skill:{...selected.source,...selected.source.spData,skillId:build.skillId,rangeGrid:selected.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:{...build,modifiers:{}}};
 return{key:VIY_PREDEFINED_KEY,build,record,row:4,col:3,dir:'RIGHT',deploymentSlotCost:1};
}
export function installViyPredefined(b,{source=tutorial}={}){
 const entry=selectedViyPredefined({source});
 if(b.finished||b._endReq||b.time!==0||!b.getPlayer('arkpedia')||b.bench[ID]||roles.has(b)||b.predefinedOperators?.has(entry.key)||b.allyUnits.some(u=>u.defId===ID))
  throw Error('Predefined Viy requires a fresh separate stage instance');
 if(!b.grid.inRect(entry.row,entry.col)||b.unitAt(entry.row,entry.col)||b.tileReservation(entry.row,entry.col)||b.downOn(entry.row,entry.col)||b.deployedSlots()+1>b.unitLimit)
  throw Error('Predefined Viy source placement is unavailable');
 const def=normalizeChess(entry.record),u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',entry.row,entry.col,{dir:entry.dir}),kit=genericKit(def.skill.bb,def.raw,def);
 u.deploymentSlotCost=entry.deploymentSlotCost;u.mem.regularControlId=entry.key;
 customizeVeenKit({battle:b,id:ID,unit:u,kit});b._setupUnit(u,kit);installVeen({battle:b,unit:u,def});
 b.addBuff(u,{key:'arkpedia:talent',mods:def.raw.arkpedia.modifiers,persist:true,allowDead:true});
 if(!b._deploy(u,{initial:true,tile:[entry.row,entry.col]}))throw Error('Predefined Viy deployment rejected');
 entry.unit=u;entry.life=u.deploySeq;entry.predefined=true;b.predefinedOperators??=new Map();b.predefinedOperators.set(entry.key,entry);
 roles.set(b,{entry,u,life:u.deploySeq,skill:u.skill});return entry;
}
function currentRole(b){
 const role=roles.get(b),u=role?.u;
 if(!role||b.finished||b._endReq||b.predefinedOperators?.get(VIY_PREDEFINED_KEY)!==role.entry||role.entry.unit!==u||role.entry.life!==role.life
  ||!u.alive||!u.deployed||u.deploySeq!==role.life||!b.units.includes(u)||u.skill!==role.skill||u.skill.unit!==u||u.skill.id!=='skchr_veen_3')return null;
 return role;
}
export const hasCurrentViyPredefined=b=>!!currentRole(b);
export function applyViyTutorialSp(b,{key=VIY_SP_TUTORIAL,source=tutorial}={}){
 if(JSON.stringify(source)!==retained||key!==VIY_SP_TUTORIAL)throw Error('Unreviewed Viy tutorial SP command');
 const role=currentRole(b);if(!role)return{status:'cancelled'};const u=role.u;
 const before=u.skill.spTotal;
 // Explicit existing-engine mapping: a scripted SP modification, capped by
 // the selected skill's capacity; active timed skills reject modification.
 // Canonical source requests 50 even though this selected S3's cap is 49.
 if(u.skill.active&&u.skill.isTimed)return{status:'active-skill',requested:50,before,after:before};
 if(before<50)u.skill.setSpTotal(50);
 return{status:'applied',requested:50,before,after:u.skill.spTotal};
}
