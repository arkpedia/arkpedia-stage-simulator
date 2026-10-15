// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near} from './helpers/thumpy-resource-fixture.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {registerBerryProtection} from '../server/sim/content/arkpedia-five-star-medic-second.js';
const damage=(f,t,amount=1,type='phys',extra={})=>f.b.dealDamage(f.u,t,{amount,type,canDodge:false,...extra});
function ally(f,{kind='op'}={}){
 const d=normalizeChess({chessId:'qa:other',stats:{maxHp:9999,atk:100,def:0,blockCnt:0},rangeGrid:[]});
 const a=f.b._makeAlly(f.u.player,d,kind,2,2,{dir:'RIGHT'});f.b._setupUnit(a,{trait:{noAttack:true},talents:[]});a.player.dp=99;assert.ok(f.b._deploy(a,{initial:false}));return a;
}
const injectBurst=(f,t,element='erosion')=>f.b.emit('elementBurst',{target:t,source:null,element});
for(const elite of[0,1,2])for(const potential of[1,3,5,6])test(`Thumpy E${elite}/P${potential} keeps selected elemental intake and physical rider operands`,()=>{
 const f=make({elite,potential}),{b,u,resources:r}=f,t=enemy(f),first=r.first;
 b.dealDamage(null,u,{amount:100,type:'element',element:'burn',canDodge:false});near(u.elem.burn,100*(first?.ep_damage_scale??1));
 damage(f,t,1);near(t.elem.erosion,first?u.s.atk*first['ep_damage_ratio[trigger]']:0);
 assert.equal(r.marks.size,elite===2?1:0);assert.deepEqual(b.errors,[]);
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`Thumpy S${skill}/rank ${rank} selects its independent mode buffs and field interval`,()=>{
 const f=make({skill,rank}),{u,resources:r}=f,atk=u.s.atk,def=u.s.def,block=u.s.blockCnt;
 assert.equal(r.beginMode(),true);near(u.s.atk,atk*(1+r.record.bb.atk));near(u.s.def,def*(1+r.record.bb.def));near(u.s.blockCnt,block+(skill===3?2:0));
 if(skill>1){const t=enemy(f);assert.equal(r.releaseField([[5,5]]),true);assert.equal(r.pulses,1);near(t.elem.erosion,u.s.atk*r.first['ep_damage_ratio[trigger]']);
  advance(f.b,r.record.bb.interval-.05);assert.equal(r.pulses,1);advance(f.b,.1);assert.equal(r.pulses,2);}
 r.endMode();near(u.s.atk,atk);near(u.s.def,def);near(u.s.blockCnt,block);assert.equal(r.children.size,0);
});
test('Thumpy physical rider uses live ATK and does not scale with HP damage or overkill',()=>{
 const f=make(),a=enemy(f),z=enemy(f,{x:7}),ratio=f.resources.first['ep_damage_ratio[trigger]'];damage(f,a,1);near(a.elem.erosion,f.u.s.atk*ratio);
 f.b.addBuff(f.u,{key:'qa:atk',mods:{atkPct:1}});damage(f,z,200);near(z.elem.erosion,f.u.s.atk*ratio);
});
test('Thumpy physical talent shortens erosion recovery instead of accumulating more gauge',()=>{
 const f=make({potential:6}),t=enemy(f);f.b.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'erosion'});
 const lock=t.findBuff('erosionBurst'),left=lock.timeLeft;damage(f,t);near(lock.timeLeft,left-f.resources.first.duration_dec);near(t.elem.erosion,t.gaugeMax);
 lock.timeLeft=.5;damage(f,t);assert.equal(t.findBuff('erosionBurst'),null);near(t.elem.erosion,0);
});
test('Thumpy marks all accepted HP-damage kinds, but only physical output adds injury',()=>{
 for(const type of['phys','arts','true','elemental']){const f=make(),t=enemy(f);damage(f,t,1,type);assert.equal(f.resources.marks.has(t),true);near(t.elem.erosion,type==='phys'?f.u.s.atk*.1:0);}
});
test('Thumpy accepted shielded/floored physical hits retain marks and the talent rider',()=>{
 for(const mode of['shield','floor']){const f=make(),t=enemy(f);if(mode==='shield')f.b.addBuff(t,{key:'qa:shield',shield:1000});
  else{f.b.addBuff(t,{key:'qa:floor',mods:{damageHpFloorRatio:1}});t.hp=t.s.maxHp;}
  const hp=t.hp;damage(f,t,10);near(t.hp,hp);near(t.elem.erosion,f.u.s.atk*.1);assert.equal(f.resources.marks.has(t),true);}
});
test('Thumpy dodged/cancelled output, HP loss, gauge receipts and sourceless credit create no talent marks',()=>{
 for(const mode of['dodge','cancel','hpLoss','gauge','sourceless']){const f=make(),t=enemy(f);
  if(mode==='dodge'){f.b.addBuff(t,{key:'qa:dodge',mods:{dodgePhys:1}});damage(f,t,10,'phys',{canDodge:true});}
  if(mode==='cancel'){f.b.on('hit',c=>{c.cancel=true;});damage(f,t,10);}
  if(mode==='hpLoss')f.b.loseHp(t,10,f.u);
  if(mode==='gauge')damage(f,t,10,'element',{element:'neural'});
  if(mode==='sourceless')damage(f,t,10,'phys',{sourceless:true});
  assert.equal(f.resources.marks.size,0);near(t.elem.erosion,0);}
});
test('Thumpy first physical hit can mark before its injury causes an erosion burst',()=>{
 const f=make(),t=enemy(f);t.elem.erosion=t.gaugeMax-1;damage(f,t);assert.equal(f.resources.bursts,1);near(f.u.findBuff(f.resources.shieldKey).shield,250);
 assert.equal(f.u.findBuff(f.resources.defKey).stacks,1);
});
for(const potential of[1,6])test(`Thumpy P${potential} marked erosion bursts grant selected capped DEF and one barrier increment each`,()=>{
 const f=make({potential}),{u,resources:r}=f,t=enemy(f),def=u.s.def;damage(f,t,1,'arts');
 for(let n=0;n<40;n++)injectBurst(f,t);assert.equal(u.findBuff(r.defKey).stacks,30);near(u.s.def,def+30*r.second.def);
 near(u.findBuff(r.shieldKey).shield,Math.min(40*r.second.shield_value,u.s.maxHp*3));assert.equal(r.bursts,40);
});
test('Thumpy barrier caps against current max HP and consumes HP damage independently of permanent DEF',()=>{
 const f=make(),{b,u,resources:r}=f,t=enemy(f);damage(f,t,1,'arts');injectBurst(f,t);near(u.findBuff(r.shieldKey).shield,250);
 b.dealDamage(null,u,{amount:50,type:'true',canDodge:false});near(u.findBuff(r.shieldKey).shield,200);assert.equal(u.findBuff(r.defKey).stacks,1);
 b.addBuff(u,{key:'qa:hp',mods:{hpPct:1}});for(let n=0;n<100;n++)injectBurst(f,t);near(u.findBuff(r.shieldKey).shield,u.s.maxHp*3);
 b.removeBuff(u,'qa:hp');injectBurst(f,t);near(u.findBuff(r.shieldKey).shield,u.s.maxHp*3);
});
test('Thumpy marks are source-specific, ignore unrelated bursts and follow the accepted talent parent',()=>{
 const f=make(),t=enemy(f),other=enemy(f,{x:8}),r=f.resources;damage(f,t,1,'arts');injectBurst(f,other);injectBurst(f,t,'burn');assert.equal(r.bursts,0);
 f.b.removeBuff(f.u,r.parentKeys[1]);assert.equal(r.marks.size,0);injectBurst(f,t);assert.equal(r.bursts,0);damage(f,t,1,'arts');assert.equal(r.marks.size,0);
});
test('Thumpy rejected marks and parent attachments cannot grant resources',()=>{
 for(const key of['parent','mark']){const f=make({defer:true}),r=f.resources;f.b.on('beforeBuff',c=>{if(c.buff.key===(key==='parent'?r.parentKeys[1]:r.markKey))c.cancel=true;});f.deploy();const t=enemy(f);damage(f,t);injectBurst(f,t);assert.equal(r.bursts,0);assert.equal(f.u.findBuff(r.shieldKey),null);}
});
test('Thumpy rejected defense or barrier applications remain independent and cannot bypass acceptance',()=>{
 for(const reject of['defKey','shieldKey']){const f=make(),r=f.resources,t=enemy(f);damage(f,t,1,'arts');f.b.on('beforeBuff',c=>{if(c.buff.key===r[reject])c.cancel=true;});injectBurst(f,t);
  assert.equal(f.u.findBuff(r[reject]),null);assert.ok(f.u.findBuff(r[reject==='defKey'?'shieldKey':'defKey']));}
});
test('Thumpy reentrant parent/source removal during a DEF grant prevents a later barrier',()=>{
 for(const how of['parent','retreat']){const f=make(),r=f.resources,t=enemy(f);damage(f,t,1,'arts');f.b.on('beforeBuff',c=>{if(c.buff.key===r.defKey){if(how==='parent')f.b.removeBuff(f.u,r.parentKeys[1]);else f.b.retreat(f.u,{permanent:true});}});injectBurst(f,t);assert.equal(f.u.findBuff(r.shieldKey),null);}
});
test('Thumpy nonstackable elemental protection chooses the strongest admitted producer and restores fallback',()=>{
 const f=make(),other=ally(f),sync=registerBerryProtection(f.b,other,.4,()=>true,()=>true);sync();
 f.b.dealDamage(null,f.u,{amount:100,type:'element',element:'burn'});near(f.u.elem.burn,60);sync.remove();
 f.b.dealDamage(null,f.u,{amount:100,type:'element',element:'burn'});near(f.u.elem.burn,145);
});
test('Thumpy S2 glue uses other operator physical receipts before dodge, with live source ATK',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f),a=ally(f);r.beginMode();r.releaseField([[5,5]]);t.elem.erosion=0;
 f.b.addBuff(t,{key:'qa:dodge',mods:{dodgePhys:1}});f.b.dealDamage(a,t,{amount:1,type:'phys',canDodge:true});near(t.elem.erosion,f.u.s.atk*.15);
 const oldAtk=f.u.s.atk;f.b.addBuff(f.u,{key:'qa:atk',mods:{atkFlat:100}});f.b.dealDamage(a,t,{amount:1,type:'phys',canDodge:true});near(t.elem.erosion,oldAtk*.15+f.u.s.atk*.15);
});
test('Thumpy S2 own output, devices, nonphysical damage and sourceless damage do not count as another operator hit',()=>{
 for(const kind of['own','device','arts','true','sourceless']){const f=make({skill:2}),r=f.resources,t=enemy(f),a=ally(f,{kind:kind==='device'?'device':'op'});r.beginMode();r.releaseField([[5,5]]);t.elem.erosion=0;
  f.b.dealDamage(kind==='own'?f.u:a,t,{amount:1,type:kind==='arts'?'arts':kind==='true'?'true':'phys',canDodge:false,sourceless:kind==='sourceless'});
  near(t.elem.erosion,kind==='own'?f.u.s.atk*.1:0);}
});
test('Thumpy glue recipient hook intentionally does not filter later cancellation, while source output talent does',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f),a=ally(f);r.beginMode();r.releaseField([[5,5]]);t.elem.erosion=0;
 f.b.on('hit',c=>{if(c.source===a)c.cancel=true;},{priority:-100});const hp=t.hp;f.b.dealDamage(a,t,{amount:50,type:'phys'});near(t.hp,hp);near(t.elem.erosion,f.u.s.atk*.15);
});
test('Thumpy field entrance/leave/reentry own independent clocks and remove derived recipients immediately on mode end',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6});r.beginMode();r.releaseField([[5,6]]);assert.equal(r.pulses,1);advance(f.b,.3);t.x=8;advance(f.b,.1);assert.equal(r.children.size,0);
 t.x=6;advance(f.b,.1);assert.equal(r.pulses,2);r.endMode();assert.equal(t.findBuff(r.fieldKey),null);advance(f.b,2);assert.equal(r.pulses,2);
});
test('Thumpy field covers own blockees even outside captured tiles and only ground bodies',()=>{
 const f=make({skill:2}),r=f.resources,a=enemy(f,{x:8}),air=enemy(f,{x:6,fly:true});a.blockedBy=f.u;r.beginMode();r.releaseField([[5,6]]);assert.ok(r.child(a));assert.equal(r.child(air),null);
 a.blockedBy=null;advance(f.b,.1);assert.equal(r.child(a),null);
});
test('Thumpy periodic fields honor current hidden, invulnerable and invisible flags without a delayed damage catch-up',()=>{
 for(const flag of['hidden','invulnerable','stealth']){const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6});f.b.addBuff(t,{key:'qa:flag',flags:{[flag]:true}});r.beginMode();r.releaseField([[5,6]]);advance(f.b,2);assert.equal(f.hits.length,0);
  f.b.removeBuff(t,'qa:flag');advance(f.b,.8);assert.ok(f.hits.length>0);assert.ok(r.pulses<5);}
});
test('Thumpy S3 conveyor moves light unblocked bodies by the selected speed without giving control to heavy/flying/blocked bodies',()=>{
 for(const kind of['light','heavy','blocked','air','static']){const f=make({skill:3}),r=f.resources,t=enemy(f,{x:kind==='blocked'?5:7,fly:kind==='air'});if(kind!=='blocked')f.b.addBuff(t,{key:'qa:unblockable',flags:{unblockable:true}});
  if(kind==='heavy')t.base.massLevel=5;if(kind==='static')t.def={...t.def,staticBody:true};t.markDirty();if(kind==='blocked'){t.blockedBy=f.u;f.u.blocking=[t];}
  r.beginMode();r.releaseField(kind==='blocked'?[[5,5]]:[[5,7],[5,6]]);const before=t.x;advance(f.b,.5);near(before-t.x,kind==='light'?.4:0);}
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Thumpy S3 ${dir} moves along the captured belt facing`,()=>{
 const f=make({skill:3,dir}),r=f.resources,[dr,dc]={UP:[1,0],DOWN:[-1,0],LEFT:[0,-1],RIGHT:[0,1]}[dir],t=enemy(f,{x:5+2*dc,y:5+2*dr});f.b.addBuff(t,{key:'qa:unblockable',flags:{unblockable:true}});
 r.beginMode();r.releaseField([[5+2*dr,5+2*dc],[5+dr,5+dc]]);const x=t.x,y=t.y;advance(f.b,.5);near(t.x,x-dc*.4);near(t.y,y-dr*.4);
});
test('Thumpy S3 erosion bursts apply an additional permanent DEF cut before shared burst damage',()=>{
 const f=make({skill:3}),r=f.resources,t=enemy(f,{x:6});t.base.def=300;t.markDirty();r.beginMode();r.releaseField([[5,6]]);t.elem.erosion=0;const def=t.s.def;
 f.b.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'erosion'});near(t.s.def,Math.max(0,def-120-30));assert.ok(t.findBuff('thumpy[ep_break_water]'));
 r.endMode();assert.ok(t.findBuff('thumpy[ep_break_water]'));assert.equal(t.findBuff(r.fieldKey),null);
});
test('Thumpy field rejects malformed, duplicate, excessive, high or nonpassable tile inputs',()=>{
 const f=make({skill:3}),r=f.resources;r.beginMode();for(const tiles of[[[5,5],[5,5]],[[5.1,5]],[[99,99]],Array.from({length:6},(_,i)=>[5,i]),'wrong'])assert.throws(()=>r.releaseField(tiles));
 f.b.grid.tiles[5*f.b.grid.cols+6]={...f.b.grid.tile(5,6),height:'HIGH'};assert.throws(()=>r.releaseField([[5,6]]));assert.equal(r.fieldReleased,false);
});
test('Thumpy external mode-buff removal, source retirement and battle end remove owned work without deleting permanent recipient cuts',()=>{
 for(const how of['mode','retreat','battleEnd']){const f=make({skill:3}),r=f.resources,t=enemy(f,{x:6});r.beginMode();r.releaseField([[5,6]]);injectBurst(f,t);
  if(how==='mode')f.b.removeBuff(f.u,r.modeKey);if(how==='retreat')f.b.retreat(f.u,{permanent:true});if(how==='battleEnd')f.b.emit('battleEnd',{});
  assert.equal(r.mode,0);assert.equal(r.children.size,0);assert.ok(t.findBuff('thumpy[ep_break_water]'));
  if(how!=='mode'){assert.equal(r.stopped,true);assert.equal(r.handles.length,0);assert.equal(r.marks.size,0);assert.equal(f.u.findBuff(r.shieldKey),null);}
 }
});
test('Thumpy resource preparation rejects unrelated or altered builds and duplicate installation',()=>{
 for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.atk++,d=>d.talents[0].bb.ep_damage_scale=.3,d=>d.rangeGrid.push([1,0])])assert.throws(()=>make({mutate}));
 assert.throws(()=>make({contract:{}}));const f=make();assert.throws(()=>f.resources.install());
});
test('Thumpy losing the elemental-protection parent immediately removes intake scaling before another tick',()=>{
 const f=make(),r=f.resources;f.b.removeBuff(f.u,r.parentKeys[0]);f.b.dealDamage(null,f.u,{amount:100,type:'element',element:'burn'});near(f.u.elem.burn,100);
});
test('Thumpy rejected elemental-protection parent never contributes a hidden multiplier',()=>{
 const f=make({defer:true}),r=f.resources;f.b.on('beforeBuff',c=>{if(c.buff.key===r.parentKeys[0])c.cancel=true;});f.deploy();
 f.b.dealDamage(null,f.u,{amount:100,type:'element',element:'burn'});near(f.u.elem.burn,100);const t=enemy(f);damage(f,t);near(t.elem.erosion,0);
});
test('Thumpy stun/silence and native slow-down do not suspend already released world-time field children',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6});r.beginMode();r.releaseField([[5,6]]);const first=r.pulses;
 f.b.applyStatus(f.u,'stun',{duration:2});f.b.applyStatus(f.u,'silence',{duration:2});f.b.addBuff(f.u,{key:'qa:slow',data:{nativeSlowDown:{increment:.5,maxStrength:.5}}});advance(f.b,1.5);
 assert.equal(r.pulses-first,2);assert.ok(t.elem.erosion>0);assert.equal(r.mode,2);
});
test('Thumpy an actual fatal physical output leaves no recipient mark or posthumous injury',()=>{
 const f=make(),t=enemy(f,{hp:10});damage(f,t,100);assert.equal(t.alive,false);assert.equal(f.resources.marks.size,0);near(t.elem.erosion,0);assert.deepEqual(f.b.errors,[]);
});
test('Thumpy airborne enemies may carry the damage-derived talent mark without becoming field recipients',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6,fly:true});r.beginMode();r.releaseField([[5,6]]);assert.equal(r.child(t),null);
 damage(f,t,1,'arts');assert.ok(r.marks.has(t));injectBurst(f,t);assert.equal(r.bursts,1);
});
test('Thumpy external deletion/replacement of a recipient child cannot retain an old pulse callback',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6});r.beginMode();r.releaseField([[5,6]]);const old=r.child(t);f.b.removeBuff(t,old.buff);advance(f.b,.1);
 assert.notEqual(r.child(t),old);assert.equal(r.pulses,2);advance(f.b,.6);assert.equal(r.pulses,2);advance(f.b,.2);assert.equal(r.pulses,3);
});
test('Thumpy retreat during recipient attachment prevents an immediate field pulse',()=>{
 const f=make({skill:2}),r=f.resources,t=enemy(f,{x:6});r.beginMode();f.b.on('beforeBuff',c=>{if(c.buff.key===r.fieldKey)f.b.retreat(f.u,{permanent:true});});r.releaseField([[5,6]]);
 assert.equal(r.stopped,true);assert.equal(r.children.size,0);assert.equal(r.pulses,0);assert.equal(t.findBuff(r.fieldKey),null);assert.deepEqual(f.b.errors,[]);
});
test('Thumpy all four field facings retain the selected skills without mutating the stage terrain',()=>{
 for(const dir of['UP','DOWN','LEFT','RIGHT']){const f=make({skill:3,dir}),tiles=structuredClone(f.b.grid.tiles),r=f.resources;r.beginMode();r.releaseField([[5,5]]);advance(f.b,1);r.endMode();assert.deepEqual(f.b.grid.tiles,tiles);}
});
for(const key of['immune_shu_blink','immune_yu_blink'])test(`Thumpy conveyor respects ${key} without suppressing its independent field damage`,()=>{
 const f=make({skill:3}),r=f.resources,t=enemy(f,{x:7});f.b.addBuff(t,{key});f.b.addBuff(t,{key:'qa:unblockable',flags:{unblockable:true}});
 r.beginMode();r.releaseField([[5,7],[5,6]]);const before=t.x;advance(f.b,1.1);near(t.x,before);assert.ok(r.pulses>=2);
});
