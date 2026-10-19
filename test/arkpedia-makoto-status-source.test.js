// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile}from'node:fs/promises';import{existsSync}from'node:fs';
import proof from '../data/arkpedia-makoto-status-source.json' with {type:'json'};
import e from '../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import {STATUS_DUMP_PIN} from '../tools/arkpedia/koromaru-status-source.mjs';
import {recoverMakotoStatus,parseAbnormalCombos}from'../tools/arkpedia/makoto-status-source.mjs';
const parts=e.characters.char_4217_makoto.flatMap(r=>r.components),get=id=>parts.find(p=>p.pathId===id).data;
test('The pinned numeric reference is explicitly version-limited and does not admit Makoto',()=>{
  for(const key of['repository','commit','path','gitBlob','bytes','sha256'])assert.equal(proof.source[key],STATUS_DUMP_PIN[key]);
  assert.match(proof.source.versionLimit,/without a client version/);assert.match(proof.source.versionLimit,/does not prove identical client version/);
  assert.equal(proof.frameParity,false);assert.deepEqual(proof.enabledOperators,[]);
});
test('Six distinct native transition producers decode through the recovered enum, retaining plain-return skill eligibility',()=>{
  assert.equal(proof.transitions.length,6);
  for(const row of proof.transitions){const b=get(row.component)._buffs[0];assert.deepEqual(b.attributes.abnormalFlags,row.flags);
    assert.deepEqual(row.flagNames.map(k=>proof.definitions[k]),row.flags);assert.deepEqual(row.immuneNames.map(k=>proof.definitions[k]),b.attributes.abnormalImmunes);
    assert.deepEqual(row.comboImmuneNames.map(k=>proof.comboDefinitions[k]),b.attributes.abnormalComboImmunes);
    assert.deepEqual(row.comboImmunes,[0]);assert.deepEqual(row.comboImmuneNames,['SLEEPING']);
    assert.equal(row.flagNames.includes('HEAL_FREE'),true);assert.equal(row.flagNames.includes('FORCE_DISARMED'),true);
    assert.equal(row.flagNames.includes('SKILL_NOT_ACTIVATABLE'),row.branch!=='Plain return');
  }
});
test('Combo immunity0 is sleeping in its own enum, distinct from flag0 stunned',()=>{
  const wrap=s=>`// Namespace: Torappu\r\npublic enum AbnormalCombo\r\n{\r\n${s}\r\n}`;
  const fields='public const AbnormalCombo SLEEPING = 0;\r\npublic const AbnormalCombo E_NUM = 1;';
  assert.deepEqual(parseAbnormalCombos(wrap(fields)),{SLEEPING:0,E_NUM:1});assert.equal(proof.comboDefinitions.SLEEPING,0);assert.equal(proof.definitions.STUNNED,0);
  for(const text of[wrap(fields)+wrap(fields),wrap(fields.replace('E_NUM = 1','E_NUM = 0')),wrap(fields.replace('E_NUM = 1','E_NUM = 1 + 0')),wrap(fields.replace('E_NUM = 1','E_NUM = 3'))])assert.throws(()=>parseAbnormalCombos(text));
});
test('Named P2 statuses corroborate numeric normal-Persona flags, and all nine selectors use the same enum end',()=>{
  const d=proof.definitions;assert.equal(d.SP_RECOVER_STOPPED,1);assert.equal(d.SKILL_NOT_ACTIVATABLE,24);assert.equal(d.E_NUM,46);
  assert.deepEqual(proof.persona.p2FlagNames.map(k=>d[k]),proof.persona.s1s2Flags);assert.deepEqual(proof.persona.p1Flags,[d.SP_RECOVER_STOPPED]);
  assert.equal(proof.selectors.length,9);for(const p of proof.selectors)assert.equal(get(p.component)._abnormalFlag,d.E_NUM);
});
test('Literal full-HP-ratio healing keeps HEAL_FREE restriction and cannot justify guessed rally-point HP repair',()=>{
  const heal=e.templates.HealViaMaxHpRatio.eventToActions.ON_BUFF_START[0];assert.equal(heal._ignoreHealFree,proof.healing.ignoreHealFree);
  assert.equal(proof.healing.ignoreHealFree,false);assert.equal(proof.healing.skipModifierEvent,true);assert.match(proof.healing.limit,/compiled HP\/reset semantics are not recovered/);
});
const cached=existsSync(new URL('../.cache/arkpedia/cn-native-source/status-enums-dump.cs',import.meta.url));
test('Original cached reference and native bytes independently reproduce the entire Makoto receipt',{skip:!cached},async()=>{
  assert.deepEqual(await recoverMakotoStatus(),proof);
});
test('Reference verification rejects normalized line endings, altered definitions and altered native bytes',{skip:!cached},async()=>{
  for(const [file,edit]of[
    ['status-enums-dump.cs',b=>Buffer.from(b.toString().replaceAll('\r\n','\n'))],
    ['status-enums-dump.cs',b=>Buffer.from(b.toString().replace('HEAL_FREE = 7','HEAL_FREE = 8'))],
    ['char_4217_makoto.json',b=>Buffer.from(b.toString().replace('makoto_switchbegin','makoto_switchwrong'))],
  ])await assert.rejects(recoverMakotoStatus({read:async(path,...args)=>{const b=await readFile(path,...args);return String(path).endsWith(file)?edit(b):b;}}));
});
