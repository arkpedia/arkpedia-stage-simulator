import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-guard-expansion-prefabs.json' with { type: 'json' };
import { GUARD_EXPANSION_OPERATORS } from '../shared/arkpedia/guard-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);
function advance(b, s) { for(let i=0;i<Math.ceil(s/b.dt);i++) b.step(); assert.deepEqual(b.errors,[]); }
function make(id, { skill=0, rank=10, elite=2, level=70, potential=1, enemies=0, companions=[] }={}) {
 const src=structuredClone(data), op=src.operators[id];
 src.stage.geometry.waves[0].spawns=enemies?[{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}]:[];
 Object.assign(src.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:100,def:0,magicResistance:0,moveSpeed:0});
 const build={...defaultBuild(op),elite,level,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(src,{operators:[build,...companions.map(x=>defaultBuild(src.operators[x]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);return {b,src,build};
}
function deploy(b,id,r=2,c=7) {const u=b.deployOperator(id,r,c,'RIGHT');u.atkCd=1000;return u;}
function pin(b) {b.step();for(const e of b.enemies) {b.addBuff(e,{key:'pin',persist:true,flags:{noMove:true,disarm:true}});e.x=8;e.y=2;}b.step();}
function activate(u) {u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}

test('every enabled guard kit has pinned character, skill and original selector evidence', () => {
  assert.equal(evidence.sourceVersion, '26-09-23-17-49-43_b9cc4a');
  assert.equal(evidence.tableCommit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(Object.keys(GUARD_EXPANSION_OPERATORS).length, 10);
  for (const [id, support] of Object.entries(GUARD_EXPANSION_OPERATORS)) {
    const bundle = evidence.sourceBundles.find(x => x.path === `charpack/${id}.ab`);
    assert.match(bundle.md5, /^[a-f0-9]{32}$/);
    assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
    assert.ok(bundle.size > 0);
    assert.ok(evidence.characters[id].length);
    for (const skillId of support.skillIds) {
      assert.ok(data.operators[id].skills.some(x => x.id === skillId));
      // Quartz S1 is the ordinary shared ATK Up template.
      if (skillId !== 'skcom_atk_up[2]')
        assert.ok(evidence.skills.some(x => x.object === skillId), skillId);
    }
    for (const object of evidence.characters[id]) {
      assert.equal(typeof object.pathId, 'string');
      for (const component of object.components)
        assert.equal(typeof component.pathId, 'string');
    }
  }
  const beehunter = evidence.characters.char_137_brownb.flatMap(x => x.components);
  const stack = beehunter.find(x => x.fields._stackBuff);
  assert.equal(stack.fields._stackBuff.maxStackCnt, 5);
  assert.equal(stack.fields._onlyApplyOnFirstSpell, 1);
  assert.match(evidence.interpretationEvidence.beehunterFirstStack, /inference/);
});

test('Beehunter passive dodge is physical-only at every rank and S2 scales base attack time, with expiry',()=>{
 for(let rank=1;rank<=10;rank++) {
  const {b,src}=make('char_137_brownb',{rank});const u=deploy(b,'char_137_brownb');
  near(u.s.dodgePhys,src.operators.char_137_brownb.skills[0].levels[rank-1].blackboard[0].value);near(u.s.dodgeArts,0);
  assert.equal(u.skill.ready,false);
  const x=make('char_137_brownb',{skill:1,rank}), v=deploy(x.b,'char_137_brownb'); const normal=v.s.interval;
  activate(v);near(v.s.interval,normal*(1+x.src.operators.char_137_brownb.skills[1].levels[rank-1].blackboard[0].value));
  advance(x.b,10.1);near(v.s.interval,normal);
 }
});
test('Beehunter single damage calculation is split into two events and consecutive ATK stacks cap/reset per target',()=>{
 const {b}=make('char_137_brownb',{skill:1,enemies:2});const u=deploy(b,'char_137_brownb');pin(b);
 const [a,z]=b.enemies;a.base.def=100;a.markDirty();let hits=0;b.on('damaged',c=>{if(c.source===u)hits++;});
 const hp=a.hp;b.forceAttack(u,[a]);near(hp-a.hp,u.base.atk*1.05-100);assert.equal(hits,2);
 for(let i=0;i<7;i++)b.forceAttack(u,[a]);near(u.s.atk,u.base.atk*1.25);
 b.forceAttack(u,[z]);near(u.s.atk,u.base.atk*1.05);
 const e0=make('char_137_brownb',{elite:0,level:45,rank:4,enemies:1});const v=deploy(e0.b,'char_137_brownb');pin(e0.b);
 e0.b.forceAttack(v,e0.b.enemies);near(v.s.atk,v.base.atk);
});
test('Jackie dodge grants a refreshing, non-stacking ASPD talent; S2 combines independent dodge and suppresses ordinary attacks',()=>{
 const {b}=make('char_347_jaksel',{skill:1,enemies:1});const u=deploy(b,'char_347_jaksel');pin(b);near(u.s.dodgePhys,.3);
 activate(u);near(u.s.dodgePhys,1-(1-.3)*(1-.7));near(u.s.bat,u.base.bat*.5);near(u.s.dodgeArts,0);
 b.addBuff(u,{key:'outside',mods:{batPct:.3}});near(u.s.bat,u.base.bat*1.3*.5);
 const rng=b.rng;b.rng=()=>0; b.rng.chance=rng.chance;
 const e=b.enemies[0], hp=e.hp;b.dealDamage(e,u,{amount:100,type:'phys'});
 near(u.s.aspd,u.base.aspd+12);near(hp-e.hp,u.s.atk*1.6);const after=e.hp;
 b.dealDamage(e,u,{amount:100,type:'phys'});near(e.hp,after);near(u.s.aspd,u.base.aspd+12);
 advance(b,u.s.interval+.05);b.dealDamage(e,u,{amount:100,type:'phys'});assert.ok(e.hp<after);
 u.atkCd=0;const attacks=u.stats.attacks;advance(b,.1);assert.equal(u.stats.attacks,attacks);
 advance(b,5.1);near(u.s.aspd,u.base.aspd);
 advance(b,18);near(u.s.dodgePhys,.3);near(u.s.bat,u.base.bat*1.3);
});
test('Jackie S1 keeps one physical hit and uses exact source scale across ranks',()=>{
 for(let rank=1;rank<=10;rank++) {const {b,src}=make('char_347_jaksel',{rank,enemies:1});const u=deploy(b,'char_347_jaksel');pin(b);activate(u);
 const e=b.enemies[0],hp=e.hp;b.forceAttack(u,[e]);near(hp-e.hp,u.s.atk*src.operators.char_347_jaksel.skills[0].levels[rank-1].blackboard[0].value);}
});
test('Arene prioritizes drone tags rather than all flyers, and applies its talent before DEF with inherited Lord reduction',()=>{
 const {b}=make('char_271_spikes',{enemies:3});const u=deploy(b,'char_271_spikes');pin(b);
 const [ground,fly,drone]=b.enemies;fly.motion='FLY';drone.tags.add('drone');drone.motion='FLY';drone.base.def=50;drone.markDirty();
 assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],drone);
 const hp=drone.hp;b.forceAttack(u,[drone]);near(drone.hp,hp);advance(b,.15);near(hp-drone.hp,u.s.atk*.8*1.4-50);
});
test('Arene S1 sets block zero and hits twice; S2 expands range, targets two, uses Arts with no ranged reduction or drone priority',()=>{
 for(let skill=0;skill<2;skill++) {const {b}=make('char_271_spikes',{skill,enemies:3});const u=deploy(b,'char_271_spikes');pin(b);activate(u);
  const p=effectiveProfile(u);assert.equal(p.maxTargets,skill?2:1);assert.equal(u.s.blockCnt,skill?2:0);
  const e=b.enemies[0],hp=e.hp;e.base.def=100;e.base.res=25;e.markDirty();b.forceAttack(u,[e]);advance(b,.15);
  near(hp-e.hp,skill?u.s.atk*1.6*.75:2*(u.s.atk*1.5*.8-100));
  advance(b,21);assert.equal(u.s.blockCnt,2);assert.equal(u.profile.priority,'drone');
 }
});
test('Arene S2 actually acquires targets beyond normal range and restores the source range on expiry',()=>{
 const {b}=make('char_271_spikes',{skill:1,enemies:1}),u=deploy(b,'char_271_spikes');pin(b);
 const normal=[...u.rangeKeys],e=b.enemies[0];activate(u);
 const added=u.rangeKeys.find(k=>!normal.includes(k));assert.notEqual(added,undefined);
 e.x=added%21;e.y=Math.floor(added/21);b._buildEnemyIndex();
 assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));const hp=e.hp;
 b.forceAttack(u,acquireTargets(b,u,effectiveProfile(u)));advance(b,1);assert.ok(e.hp<hp);
 advance(b,21);assert.deepEqual(u.rangeKeys,normal);assert.equal(acquireTargets(b,u,effectiveProfile(u)).includes(e),false);
});
test('Quartz current block cap, source passive stat increases and skill S1 remain exact',()=>{
 const {b}=make('char_4063_quartz',{enemies:3});const u=deploy(b,'char_4063_quartz');pin(b);
 near(u.s.atk,u.base.atk*1.08);near(u.s.maxHp,u.base.maxHp*1.08);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
 b.addBuff(u,{key:'block',mods:{blockCnt:1}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,3);
 activate(u);near(u.s.atk,u.base.atk*1.88);advance(b,26);near(u.s.atk,u.base.atk*1.08);
});
test('Quartz S2 increases incoming damage, scales each attack, rolls stun per target and restores on expiry',()=>{
 for(let rank=1;rank<=10;rank++) {const {b,src}=make('char_4063_quartz',{skill:1,rank,enemies:2});const u=deploy(b,'char_4063_quartz');pin(b);const e=b.enemies[0];
 const bb=Object.fromEntries(src.operators.char_4063_quartz.skills[1].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
 activate(u);near(u.s.aspd,u.base.aspd+bb.attack_speed);u.hp=u.s.maxHp;const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});near(hp-u.hp,125);
 const rng=b.rng.chance;b.rng.chance=()=>true;const ehp=e.hp;b.forceAttack(u,b.enemies);near(ehp-e.hp,u.s.atk*bb['attack@s2_atk_scale']);assert.equal(e.s.flags.stun,true);
 b.rng.chance=rng;advance(b,2.1);assert.equal(!!e.s.flags.stun,false);advance(b,20);near(u.s.dmgTakenMul,1);near(u.s.aspd,u.base.aspd);
 }
});

test('Conviction source talent changes DP/redeploy and self-stuns every deployment for exactly10seconds',()=>{
 for(const [elite,level,cost,time] of [[0,45,-2,-8],[1,60,-2,-8],[2,70,-4,-15]]) {
  const {b}=make('char_159_peacok',{elite,level,rank:4});const u=deploy(b,'char_159_peacok');
  assert.equal(u.s.flags.stun,true);assert.equal(u.s.blockCnt,1);assert.equal(u.base.respawnTime,70+time);
  assert.equal(u.base.cost,srcBaseCost(elite)+cost);advance(b,9.9);assert.equal(u.s.flags.stun,true);advance(b,.15);assert.equal(!!u.s.flags.stun,false);
 }
 function srcBaseCost(elite) {return data.operators.char_159_peacok.phases[elite].attributesKeyFrames[0].data.cost;}
});
test('Conviction S1 has3charges and one physical hit; its5% proc multiplies only the selected skill hit',()=>{
 for(const proc of [false,true]) {const {b}=make('char_159_peacok',{enemies:1});const u=deploy(b,'char_159_peacok');pin(b);advance(b,10);
 b.rng.chance=()=>proc;const e=b.enemies[0],hp=e.hp;activate(u);b.forceAttack(u,[e]);near(hp-e.hp,u.s.atk*2*(proc?4:1));
 assert.equal(u.skill.maxCharges,3);const hp2=e.hp;b.forceAttack(u,[e]);near(hp2-e.hp,u.s.atk);}
});
test('Conviction S2 success hits all nearby ground/air enemies and silences; failure only stuns nearby allies including itself',()=>{
 for(const success of [true,false]) {const {b}=make('char_159_peacok',{skill:1,enemies:3,companions:['char_208_melan']});const u=deploy(b,'char_159_peacok');const a=deploy(b,'char_208_melan',2,6);pin(b);advance(b,10);
 const [nearby,fly,far]=b.enemies;nearby.x=8;nearby.y=2;fly.x=7;fly.y=1;fly.motion='FLY';far.x=4;far.y=2;b.step();b.rng.chance=()=>success;
 const h=b.enemies.map(e=>e.hp);activate(u);
 if(success){near(h[0]-nearby.hp,u.s.atk*3.5);near(h[1]-fly.hp,u.s.atk*3.5);near(far.hp,h[2]);assert.equal(nearby.s.flags.silence,true);assert.equal(fly.s.flags.silence,true);assert.equal(!!a.s.flags.stun,false);}
 else{assert.equal(u.s.flags.stun,true);assert.equal(a.s.flags.stun,true);assert.deepEqual(b.enemies.map(e=>e.hp),h);advance(b,5.1);assert.equal(!!a.s.flags.stun,false);}
 }
});
test('Cutter normal attacks are two fullATKhits and her talent rolls separately per damage event',()=>{
 const {b}=make('char_301_cutter',{enemies:1});const u=deploy(b,'char_301_cutter');pin(b);u.skill.setSpTotal(0);b.rng.chance=()=>true;
 const e=b.enemies[0];e.base.def=100;e.markDirty();const hp=e.hp;b.forceAttack(u,[e]);near(hp-e.hp,2*(u.s.atk-100));near(u.skill.spTotal,3);
 const e0=make('char_301_cutter',{elite:0,level:45,rank:4,enemies:1});const v=deploy(e0.b,'char_301_cutter');pin(e0.b);v.skill.setSpTotal(0);e0.b.rng.chance=()=>true;e0.b.forceAttack(v,e0.b.enemies);near(v.skill.spTotal,1);
});
test('Cutter S1 launches4random knives in0.2ssteps with speed10 and no normal attack during the cast',()=>{
 const {b}=make('char_301_cutter',{enemies:1});const u=deploy(b,'char_301_cutter');pin(b);const e=b.enemies[0],hp=e.hp;let launches=0,hits=0;
 const add=b.addProjectile.bind(b);b.addProjectile=d=>{launches++;return add(d);};b.on('damaged',c=>{if(c.source===u)hits++;});b.rng.chance=()=>false;activate(u);
 assert.equal(launches,1);near(e.hp,hp);u.atkCd=0;advance(b,.15);assert.equal(launches,1);assert.equal(u.stats.attacks,0);assert.equal(hits,1);
 advance(b,.25);assert.equal(launches,3);u.atkCd=1000;advance(b,.4);assert.equal(launches,4);assert.equal(hits,4);near(hp-e.hp,u.s.atk*3.4*4);assert.equal(u.s.flags.noSp,undefined);
});
test('Cutter S2 caps targets by source rank and doubles ATK against flying rather than drone-tagged ground targets',()=>{
 for(const [rank,cap,scale]of[[1,5,3],[7,6,3.8],[10,6,4.5]]) {const {b}=make('char_301_cutter',{skill:1,rank,enemies:7});const u=deploy(b,'char_301_cutter');pin(b);const e=b.enemies;
 for(let i=0;i<7;i++){e[i].x=7;e[i].y=2;}e[0].motion='FLY';e[1].tags.add('drone');b.step();b.rng.chance=()=>true;const hp=e.map(t=>t.hp);activate(u);
 assert.equal(e.filter((t,i)=>t.hp<hp[i]).length,cap);near(hp[0]-e[0].hp,u.s.atk*scale*2);near(hp[1]-e[1].hp,u.s.atk*scale);near(u.skill.spTotal,0);
 }
});
test('Utage trait healing is30/50/70at promotions, rejects external heal and interpolates source tenacity threshold',()=>{
 for(const [elite,level,value,maximum,threshold]of[[0,45,30,50,.5],[1,60,50,75,.4],[2,70,70,100,.3]]){
 const {b}=make('char_337_utage',{elite,level,rank:4,enemies:1,companions:['char_120_hibisc']});const u=deploy(b,'char_337_utage'),medic=deploy(b,'char_120_hibisc',1,7);pin(b);
 u.hp=u.s.maxHp*(1+threshold)/2;advance(b,.3);near(u.s.aspd,u.base.aspd+maximum/2);const hp=u.hp;b.forceAttack(u,b.enemies);near(u.hp-hp,value);
 near(b.heal(medic,u,100),0);u.hp=u.s.maxHp*threshold;advance(b,.3);near(u.s.aspd,u.base.aspd+maximum);u.hp=u.s.maxHp;advance(b,.3);near(u.s.aspd,u.base.aspd);
 }
});
test('Utage S1 heals continuously while disarmed and block0, and restores DEF/block on expiry',()=>{
 const {b}=make('char_337_utage');const u=deploy(b,'char_337_utage');u.hp=1;activate(u);const hp=u.hp;near(u.s.def,u.base.def*3);assert.equal(u.s.blockCnt,0);assert.equal(u.s.flags.disarm,true);
 advance(b,1);near(u.hp-hp,u.s.maxHp*.1);advance(b,8);assert.equal(u.s.blockCnt,1);near(u.s.def,u.base.def);assert.equal(u.s.flags.disarm,undefined);
});
test('Utage S2 loses currentHPat deployment, gains finite ATK/Arts and normal trait heal, then reverts after source duration',()=>{
 for(const [rank,scale,duration]of[[1,.5,13],[7,.8,15],[10,1.1,16]]) {const {b}=make('char_337_utage',{skill:1,rank,enemies:1});const u=deploy(b,'char_337_utage');near(u.hp,u.s.maxHp*.5);near(u.s.atk,u.base.atk*(1+scale));assert.equal(u.profile.dmgType,'arts');pin(b);
 const e=b.enemies[0];e.base.def=100;e.base.res=25;e.markDirty();const hp=e.hp;b.forceAttack(u,[e]);near(hp-e.hp,u.s.atk*.75);
 advance(b,duration+.1);assert.equal(u.profile.dmgType,'phys');near(u.s.atk,u.base.atk);assert.equal(u.skill.ready,false);}
});
test('LuoXiaohei S1 toggles the cat form independently of SP recovery with melee ground cap, fouradjacent range, dodge and ASPD',()=>{
 const {b}=make('char_4067_lolxh',{enemies:3});const u=deploy(b,'char_4067_lolxh');pin(b);activate(u);assert.equal(u.profile.attack,'melee');assert.equal(u.profile.canHitFly,false);near(u.s.dodgePhys,.45);near(u.s.aspd,u.base.aspd+40);
 assert.equal(acquireTargets(b,u,u.profile).length,2);b.enemies[0].motion='FLY';assert.equal(acquireTargets(b,u,u.profile).includes(b.enemies[0]),false);
 advance(b,3.1);activate(u);assert.equal(u.profile.attack,'ranged');near(u.s.dodgePhys,0);near(u.s.aspd,u.base.aspd);assert.equal(u.profile.maxTargets,1);
});
test('LuoXiaohei leaves lethaltargets at1HP, disables combat/healing, releases block, refuses retarget and awards the eventual killer SP after retreat',()=>{
 const {b}=make('char_4067_lolxh',{enemies:1,companions:['char_208_melan']});const u=deploy(b,'char_4067_lolxh'),a=deploy(b,'char_208_melan',2,6);pin(b);const e=b.enemies[0];e.hp=10;e.blockedBy=u;u.blocking=[e];
 b.forceAttack(u,[e]);advance(b,.15);near(e.hp,1);assert.equal(e.alive,true);assert.equal(e.s.flags.disarm,true);assert.equal(e.blockedBy,null);assert.equal(acquireTargets(b,u,u.profile).length,0);near(b.heal(e,e,100,{regen:true}),0);
 b.retreatOperator('char_4067_lolxh');a.skill.setSpTotal(0);b.dealDamage(a,e,{amount:100,type:'phys'});assert.equal(e.alive,false);near(a.skill.spTotal,2);
});
test('LuoXiaohei criticallywounded target selfdies at10seconds with no SP credit',()=>{
 const {b}=make('char_4067_lolxh',{enemies:1});const u=deploy(b,'char_4067_lolxh');pin(b);const e=b.enemies[0];e.hp=10;b.forceAttack(u,[e]);advance(b,.15);advance(b,9.8);assert.equal(e.alive,true);advance(b,.3);assert.equal(e.alive,false);
});
test('Luo Xiaohei wounded enemies survive hidden tunnel time but die before reappearing, even after his retreat', () => {
  const { b } = make('char_4067_lolxh', { enemies: 1 });
  const u = deploy(b, 'char_4067_lolxh');
  pin(b);
  const e = b.enemies[0];
  e.hp = 10;
  b.forceAttack(u, [e]);
  advance(b, .15);
  assert.equal(e.hp, 1);
  b.retreatOperator('char_4067_lolxh');
  b.removeBuff(e, 'pin');
  e.route = {
    legs: [{ t: 'disappear' }, { t: 'wait', time: 12 }, { t: 'appear', r: 2, c: 5 },
      { t: 'wait', time: 100 }],
    legIdx: 0, pts: null, waitLeft: null,
  };
  b.step();
  assert.equal(e.hidden, true);
  advance(b, 10.5);
  assert.equal(e.alive, true);
  assert.equal(e.hidden, true);
  let revealed = false;
  const setHidden = b._setHidden.bind(b);
  b._setHidden = (target, hidden) => {
    if (target === e && !hidden) revealed = true;
    return setHidden(target, hidden);
  };
  advance(b, 2);
  assert.equal(e.alive, false);
  assert.equal(revealed, false);
  assert.equal(e.x, 5);
  assert.equal(e.y, 2);
});
test('LuoXiaohei S2 adds separate DEFpenetrating damage only if targetHPwas below50%at impact, while main hit has full rangedATK',()=>{
 for(const ratio of [.5,.499]) {const {b}=make('char_4067_lolxh',{skill:1,enemies:1});const u=deploy(b,'char_4067_lolxh');pin(b);const e=b.enemies[0];e.base.def=300;e.markDirty();e.hp=e.s.maxHp*ratio;activate(u);const hp=e.hp;
 b.forceAttack(u,[e]);advance(b,.15);near(hp-e.hp,u.s.atk-300+(ratio<.5?u.s.atk-100:0));assert.equal(effectiveProfile(u).maxTargets,2);}
});
test('Humus overheal becomes an accumulating capped barrier, rejects external healing, and S1 heals once rather than per enemy',()=>{
 const {b}=make('char_491_humus',{enemies:4,potential:5,companions:['char_120_hibisc']});const u=deploy(b,'char_491_humus'),medic=deploy(b,'char_120_hibisc',1,7);pin(b);assert.equal(u.profile.noHeal,true);
 activate(u);near(u.s.shield,80);b.forceAttack(u,b.enemies);near(u.s.shield,80+50*2);near(b.heal(medic,u,100),0);b.heal(u,u,100000,{self:true});near(u.s.shield,u.s.maxHp*1.04);
 const shield=u.s.shield;b.dealDamage(b.enemies[0],u,{amount:100,type:'true'});near(u.s.shield,shield-100);near(u.hp,u.s.maxHp);
});
test('Humus S2 uses highest qualifying vigor, exactstrict thresholds, increased heal cap/block and expirycleanup',()=>{
 const {b}=make('char_491_humus',{skill:1,enemies:4});const u=deploy(b,'char_491_humus');pin(b);activate(u);assert.equal(u.s.blockCnt,3);
 for(const [ratio,bonus]of[[.8001,.9],[.8,.45],[.5001,.45],[.5,0]]){u.hp=u.s.maxHp*ratio;advance(b,.05);near(u.s.atk,u.base.atk*(1+bonus));}
 u.hp=u.s.maxHp;b.forceAttack(u,b.enemies);near(u.s.shield,150);advance(b,26);assert.equal(u.s.blockCnt,2);near(u.s.atk,u.base.atk);assert.equal(u.findBuff('humus:vigor'),null);
});
test('Humus barrier caps follow promotion and potential, and only actual overheal enters the shield', () => {
  for (const [elite, potential, ratio] of [[0, 1, 0], [1, 1, .6], [1, 5, .64], [2, 1, 1], [2, 5, 1.04]]) {
    const { b } = make('char_491_humus', { elite, level: 1, rank: 1, potential });
    const u = deploy(b, 'char_491_humus');
    u.hp = u.s.maxHp - 70;
    b.heal(u, u, 100, { self: true });
    near(u.hp, u.s.maxHp);
    near(u.s.shield, ratio ? 30 : 0);
    b.heal(u, u, 100000, { self: true });
    near(u.s.shield, u.s.maxHp * ratio);
    b.retreatOperator('char_491_humus');
    assert.equal(u.alive, false);
  }
});
test('Windscoot inactive block0andATKramps eachsecond to200%, talent activates only at full charge and resets after skill',()=>{
 const {b}=make('char_445_wscoot',{enemies:1});const u=deploy(b,'char_445_wscoot');pin(b);assert.equal(u.s.blockCnt,0);u.atkCd=0;advance(b,39);assert.equal(u.stats.attacks,0);assert.ok(u.s.atk<u.base.atk*3);advance(b,1);near(u.s.atk,u.base.atk*3);
 activate(u);assert.equal(u.s.blockCnt,3);near(u.s.def,u.base.def*1.55);near(u.s.aspd,u.base.aspd+50);const e=b.enemies[0],hp=e.hp;u.atkCd=1000;b.forceAttack(u,[e]);near(hp-e.hp,u.s.atk*1.4);
 advance(b,15.1);assert.equal(u.s.blockCnt,0);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);
});
test('Windscoot S2 targets2groundunits withexpanded range and main+talent attacks bypass dodge while skill1 doesnot',()=>{
 for(let skill=0;skill<2;skill++){const {b}=make('char_445_wscoot',{skill,enemies:3});const u=deploy(b,'char_445_wscoot');pin(b);advance(b,40);activate(u);
 for(const e of b.enemies)b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});const hp=b.enemies.map(e=>e.hp);const p=effectiveProfile(u);const targets=acquireTargets(b,u,p);assert.equal(targets.length,skill?2:1);b.forceAttack(u,targets);
 for(let i=0;i<targets.length;i++)near(hp[i]-targets[i].hp,skill?u.s.atk*(2+.4):0);
 }
});
