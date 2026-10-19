// SPDX-License-Identifier: GPL-3.0-or-later
// Numeric source facts only; no compiled method bodies are reproduced.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {STATUS_DUMP_PIN,parseAbnormalFlags} from './koromaru-status-source.mjs';
const digest=(algorithm,b)=>createHash(algorithm).update(b).digest('hex');
export function parseAbnormalCombos(text){
  const matches=[...text.matchAll(/\/\/ Namespace: Torappu\s+public enum AbnormalCombo\s*\{([^}]+)\}/g)];
  assert.equal(matches.length,1,'Exactly one Torappu AbnormalCombo definition required');
  const definitions={};
  for(const line of matches[0][1].trim().split(/\r?\n/)){
    const m=/^\s*public const AbnormalCombo ([A-Z][A-Z0-9_]*) = (\d+);\s*$/.exec(line);assert.ok(m,'Nonliteral combo field');
    assert.equal(Object.hasOwn(definitions,m[1]),false,'Duplicate combo name');assert.equal(Object.values(definitions).includes(+m[2]),false,'Duplicate combo value');definitions[m[1]]=+m[2];
  }
  assert.equal(definitions.E_NUM,Object.keys(definitions).length-1,'Incomplete combo enum');return definitions;
}
export async function recoverMakotoStatus({read=readFile}={}){
  const dump=await read(new URL('../../.cache/arkpedia/cn-native-source/status-enums-dump.cs',import.meta.url));
  assert.equal(dump.length,STATUS_DUMP_PIN.bytes);assert.equal(digest('sha256',dump),STATUS_DUMP_PIN.sha256);
  assert.equal(digest('sha1',Buffer.concat([Buffer.from(`blob ${dump.length}\0`),dump])),STATUS_DUMP_PIN.gitBlob);
  const all=parseAbnormalFlags(dump.toString('utf8'));
  const comboDefinitions=parseAbnormalCombos(dump.toString('utf8'));assert.deepEqual(comboDefinitions,{SLEEPING:0,SHELTERING:1,ISOLATE:2,E_NUM:3});
  const definitions=Object.fromEntries(['STUNNED','SP_RECOVER_STOPPED','INVINCIBLE','UNDEADABLE','HEAL_FREE','ALLY_TARGET_FREE','FROZEN','FORCE_DISARMED','STUNNED_NO_AMPLIFY_DAMAGE','SKILL_NOT_ACTIVATABLE','E_NUM'].map(k=>[k,all[k]]));
  assert.deepEqual(Object.values(definitions),[0,1,5,6,7,15,16,18,19,24,46]);
  const bytes=await read(new URL('../../data/arkpedia-native-operators/char_4217_makoto.json',import.meta.url));
  assert.equal(digest('sha256',bytes),'7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817');
  const e=JSON.parse(bytes),parts=e.characters.char_4217_makoto.flatMap(r=>r.components),get=id=>{const matches=parts.filter(p=>p.pathId===id);assert.equal(matches.length,1);return matches[0].data;};
  const names=['INVINCIBLE','FORCE_DISARMED','SP_RECOVER_STOPPED','UNDEADABLE','HEAL_FREE','ALLY_TARGET_FREE'];
  const transitions=[
    ['S1 entry','8100680329917746725',true],['S2 entry','5087010491772423717',true],['S3 P1 entry','5855105512771014181',true],
    ['S3 P2 entry','-7833372326858338779',true],['Plain return','1173964339455184421',false],['All-out return','-7444929567886029275',true],
  ].map(([branch,component,forbidSkill])=>{
    const b=get(component)._buffs[0],flagNames=forbidSkill?[...names,'SKILL_NOT_ACTIVATABLE']:names;
    assert.equal(b.buffKey,'makoto_switchbegin');assert.deepEqual(b.attributes.abnormalFlags,flagNames.map(k=>all[k]));
    const immuneNames=['STUNNED','FROZEN','STUNNED_NO_AMPLIFY_DAMAGE'];assert.deepEqual(b.attributes.abnormalImmunes,immuneNames.map(k=>all[k]));
    const comboImmuneNames=['SLEEPING'];assert.deepEqual(b.attributes.abnormalComboImmunes,comboImmuneNames.map(k=>comboDefinitions[k]));
    return {branch,component,flags:b.attributes.abnormalFlags,flagNames,immunes:b.attributes.abnormalImmunes,immuneNames,comboImmunes:b.attributes.abnormalComboImmunes,comboImmuneNames};
  });
  const selectors=parts.filter(p=>Object.hasOwn(p.data,'_abnormalFlag')).map(p=>({component:p.pathId,value:p.data._abnormalFlag}));
  assert.equal(selectors.length,9);assert.ok(selectors.every(s=>s.value===all.E_NUM));
  const p2=e.templates.makoto_switchend.eventToActions.ON_BUFF_START[3]._failNodes[0]._failNodes[0]._succeedNodes[0]._succeedNodes[1]._buff;
  assert.deepEqual(p2.attributes.abnormalFlags,['SP_RECOVER_STOPPED','SKILL_NOT_ACTIVATABLE']);
  const nativeP1=get('-1294480160937161179')._buffs[0],nativeS1=get('-6032850912082670043')._buffs[0],nativeS2=get('-3466145529244168667')._buffs[0];
  assert.deepEqual(nativeP1.attributes.abnormalFlags,[all.SP_RECOVER_STOPPED]);
  for(const b of[nativeS1,nativeS2])assert.deepEqual(b.attributes.abnormalFlags,p2.attributes.abnormalFlags.map(k=>all[k]));
  const heal=e.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START[0];
  assert.ok(heal.$type.includes('+HealViaMaxHpRatio,'));assert.equal(heal._ignoreHealFree,false);assert.equal(heal._skipModifierEvent,true);
  return {operator:'char_4217_makoto',source:{...STATUS_DUMP_PIN,url:`https://github.com/${STATUS_DUMP_PIN.repository}/blob/${STATUS_DUMP_PIN.commit}/${STATUS_DUMP_PIN.path}`,
    versionLimit:'The reference labels its input as the current Android APK without a client version. Its enum end and numeric definitions agree with the pinned Makoto selectors and named P2/normal-Persona status branches. This does not prove identical client version, compiled flag behavior or game frames.'},
    foundationSha256:digest('sha256',bytes),definitions,comboDefinitions,transitions,selectors,
    persona:{p1Flags:nativeP1.attributes.abnormalFlags,s1s2Flags:nativeS1.attributes.abnormalFlags,p2FlagNames:p2.attributes.abnormalFlags},
    healing:{template:'HealViaMaxHpRatio',ignoreHealFree:heal._ignoreHealFree,skipModifierEvent:heal._skipModifierEvent,
      limit:'The literal heal does not bypass HEAL_FREE. OnRallyPointLikeReborn is a separate action; its compiled HP/reset semantics are not recovered by this enum receipt.'},
    enabledOperators:[],frameParity:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const out=new URL('../../data/arkpedia-makoto-status-source.json',import.meta.url),text=JSON.stringify(await recoverMakotoStatus(),null,2)+'\n';
  if(process.argv.includes('--write'))await writeFile(out,text);else assert.equal(await readFile(out,'utf8'),text);
  console.log('Pinned status definitions, Makoto transitions and literal heal restrictions verified.');
}
