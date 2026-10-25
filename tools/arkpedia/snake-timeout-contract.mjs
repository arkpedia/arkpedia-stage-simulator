// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeCounterContract} from './snake-counter-contract.mjs';
import {verifiedNative} from './enemy-support.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeTimeoutContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({counter:'data/candidates/arkpedia-ch17-snake-counter-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',
  indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',events:'data/candidates/arkpedia-buff-event-alias-source.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const counter=await snakeCounterContract({read});
 if(!Buffer.from(JSON.stringify(counter,null,2)+'\n').equals(raw.counter))throw Error('Stale snake counter foundation');
 const indexRaw=await read(new URL('data/arkpedia-enemy-clock-source.json',root)),index=JSON.parse(indexRaw),mvp=JSON.parse(await read(new URL('data/arkpedia-mvp.json',root))),native=JSON.parse(raw.indexed);
 verifiedNative(native,index.prefabs,sha(indexRaw),mvp.behaviors.source);
 const events=JSON.parse(raw.events);if(events.events['0']?.name!=='ON_BUFF_START'||events.events['2']?.name!=='ON_BUFF_TRIGGER')throw Error('Uncorroborated timeout callback aliases');
 const parts=native.prefabs['dyn/battle/prefabs/enemies/'+counter.enemy+'.prefab'];
 const found=parts.flatMap(c=>JSON.parse(c.originalJson)._buffs??[]).filter(b=>b.buffKey==='enemy_musnake_time_out');
 if(found.length!==1)throw Error('Ambiguous snake timeout buff');
 const buff=found[0];
 if(buff.triggerCnt!==1||buff.triggerInterval!==-1||buff.firstTriggerInterval!==-1||buff.waitFirstTriggerInterval!==1
  ||buff.triggerLifeType!==1||buff.lifeTimeType!==1||buff.durationKey!=='duration'||buff.isSilenceable!==0||buff.isStunnable!==0||buff.isFreezable!==0||buff.isLevitatable!==0)
  throw Error('Unreviewed snake timeout clock');
 const bb=counter.record.bb,interval=bb['TimeOut.interval'],duration=bb['TimeOut.'+buff.durationKey],delta=bb['TimeOut.value'];
 if(!(Number.isFinite(interval)&&interval>0&&Number.isFinite(duration)&&duration>interval&&Number.isFinite(delta)&&delta<0))throw Error('Invalid canonical snake timeout values');
 const template=JSON.parse(JSON.parse(raw.graph).templates[buff.templateKey].originalJson),actions=event=>JSON.parse(template.eventToActions._items.find(e=>e.key===event).value.SerializedState);
 const start=actions(0),trigger=actions(2),countdown=start.find(n=>n.$type.endsWith('+SetEnemyBossCountDown')),kill=trigger.find(n=>n.$type.endsWith('+InstantKill')),lp=trigger.find(n=>n.$type.endsWith('+ModifyLifePoint'));
 const sequence=['FinishBuffsById','AlwaysNext','InstantKill','AlwaysNext','ShakeCamera','ModifyLifePoint','AlwaysNext','PlayAudio'].map(n=>'Torappu.Battle.Action.Nodes+'+n);
 if(JSON.stringify(trigger.map(n=>n.$type))!==JSON.stringify(sequence)||trigger[0]._buffKey!=='enemy_musnak_before_dead'
  ||start.length!==1||!countdown?._loadFromBlackboard||countdown._countDownKey!=='interval'||countdown._disableCountDown||!countdown._resetIfAlreadyActive
  ||!kill?._noReason||!kill._killSource||kill._markReachExit||kill._skipReborn||kill._noSource||kill._switchState
  ||lp?._sourceType!=='SOURCE'||lp._isSub||lp._blackboardKey!=='value'||lp._isReachExit)throw Error('Unreviewed snake timeout actions');
 return{schemaVersion:1,testOnly:true,scope:'Source-bound snake one-shot timeout, reasonless body retirement and ordinary-stage LP modification only. No HP-step, injury, attack, firewall, wave, stage or complete enemy-support approval.',
  sources,enemy:counter.enemy,record:counter.record,buff,start,trigger,defaults:{interval,duration,lifePointDelta:delta},
  limits:['World countdown and the -1 interval sentinel map to the canonical TimeOut interval; this is a local dispatch mapping, not compiled/frame parity.',
   'Native noReason InstantKill maps to a non-kill, non-leak removal followed by its AlwaysNext LP modification. Camera/audio are deferred visual work.',
   'The receiver must expose real finite ordinary-stage life points; a missing life ledger is rejected rather than initialized or replaced.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-timeout-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-timeout-contract.json',root),text=JSON.stringify(await snakeTimeoutContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake timeout contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified original snake timeout clock and LP action; complete enemy support remains held');
}
