// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { bodyInRadius } from '../body.js';
import { canTargetEnemy } from '../targeting.js';
import { makeDamageInfo } from '../damage.js';

export const EXUSIAI_COVENANT_COORDINATES_CONTRACT = Object.freeze({
  scope: 'Selected-source S3 Delivery Coordinates deck, independent cannon and ground-operator redeployment; public enablement remains held',
  mapping: 'One zero-cost, zero-slot marker in host range with selected facing; source seventy-second marker cooldown starts on removal. S3 prioritizes the marker, uses the original cannon event, speed ten and radius 1.8, withdraws only that original marker, chooses the available ground card with longest remaining cooldown (stable squad order on ties), deploys it for no DP with the marker facing and grants six non-forced SP. Keep ordinary tile/unit-limit checks and deployment hooks.',
  limits: 'Compiled card policy/recharge, custom card-effect plugin, marker immunity aliases, actionEvent1 arrival ordering, cooldown comparator/ties, deployment/refund/count policy, native token artwork/particles/audio and Unity frame parity remain unverified. These are bounded local execution rules; no public roster or browser enablement is implied.',
  frameParity: false,
});
const ID = 'char_1041_angel2', TOKEN = 'token_10056_angel2_target', RADIUS = 1.7999999523162842;
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const due = (b, time) => b.time + 1e-9 >= time;

export class ExusiaiCovenantCoordinates {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.token = null; this.stock = 0; this.readyAt = Infinity; this.deliveries = 0; this.handles = [];
    const c = evidence.tables.token, p = c.phases[this.record.build.elite], frames = p.attributesKeyFrames;
    const t = (this.record.build.level - frames[0].level) / (frames.at(-1).level - frames[0].level);
    const stats = Object.fromEntries(Object.entries(frames[0].data).filter(([,v]) => typeof v === 'number')
      .map(([k,v]) => [k, v + (frames.at(-1).data[k] - v) * t]));
    stats.maxHp = Math.round(stats.maxHp);
    const skillId = 'sktok_angel2_target_3', s = evidence.tables.tokenSkills[skillId].levels[this.record.build.skillRank - 1];
    this.def = { id: TOKEN, name: c.name, profession: c.profession, subProfessionId: c.subProfessionId,
      position: c.position, stats, rangeGrid: [[0,0]],
      skill: { ...s, ...s.spData, skillId, trigger: { rule: 'NEVER' } } };
  }
  install() {
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move && this.core.valid()) { this.stock = 1; this.readyAt = b.time; this.deliveries = 0; }
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === this.token) { this.token = null; this.stock = this.core.valid() ? 1 : 0;
        this.readyAt = b.time + this.def.stats.respawnTime; }
    }, { owner: u })];
  }
  placementError(row, col) {
    const { core, b, u } = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (!core.valid()) return 'Deploy Exusiai first.';
    if (!this.stock || live(this.token)) return 'Coordinates are already deployed.';
    if (!due(b, this.readyAt)) return 'Coordinates are still redeploying.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    if (!u.rangeKeySet.has(row * 21 + col)) return "Choose a tile inside Exusiai's attack range.";
    if (!['MELEE', 'ALL'].includes(b.grid.tile(row,col).build)) return 'Choose a melee tile.';
    if (b.allyUnits.some(a => a.alive && a.deployed && a.tileR === row && a.tileC === col)) return 'Tile is occupied.';
    if (b.tileReservation(row,col)) return 'Tile is reserved for an operator return.';
    return null;
  }
  place(row, col, dir) {
    const error = this.placementError(row,col); if (error) throw Error(error);
    if (!['UP','DOWN','LEFT','RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
    const token = this.b.spawnToken(this.u, TOKEN, row, col, { dir, def: this.def,
      kit: { skill: { kind: 'passive' }, trait: { noAttack: true }, talents: [], install: (b,t) => {
        t.deploymentSlotCost = 0;
        t.mem.exusiaiCovenantCoordinates = this;
        b.addBuff(t, { key: 'angel2:coordinate', source: this.u, persist: true, allowDead: true,
          flags: { invulnerable: true, untargetable: true } });
      } } });
    if (!token) throw Error('Coordinates placement failed.');
    this.token = token; this.stock = 0; return token;
  }
  cards() {
    const { b } = this;
    return Object.entries(b.bench).filter(([id,entry]) => !entry.unit?.alive
      && ['MELEE','ALL'].includes(b.data.getChess(id).position))
      .map(([id,entry],index) => ({ id, entry, index, remaining: Math.max(0,entry.readyAt-b.time) }))
      .sort((a,z) => z.remaining-a.remaining || a.index-z.index);
  }
  arrive(p) {
    const { core, b, u, record } = this;
    if (!core.valid()) return;
    for (const t of b.enemies) if (live(t) && canTargetEnemy(u,t,{canHitFly:true}) && bodyInRadius(t,p.point.x,p.point.y,RADIUS))
      b.dealDamage(u,t,makeDamageInfo({ amount: u.s.atk*u.s.atkScaleMul*record.bb['attack@cannon_atk_scale'],
        type: 'phys', isAttack: true, isSkill: true, isSplash: true, applyWay: 'ranged', tags: ['angel2:delivery'] }));
    // Arrival hooks may retire the owner. Do not deliver from a detached life.
    if (!core.valid()) return;
    if (p.token.alive && p.token.deploySeq === p.tokenSeq) b.retreat(p.token,{permanent:true,reason:'angel2-delivery'});
    if (!core.valid() || this.deliveries >= record.bb.max_deploy_character) return;
    const selected = this.cards()[0]; if (!selected) return;
    const error = b._placementError(selected.id,p.point.y,p.point.x,{fromSkill:true});
    if (error) { b.emit('exusiaiCovenantDeliveryBlocked',{owner:u,id:selected.id,error}); return; }
    const delivered = b.redeployOperatorFromSkill(selected.id,p.point.y,p.point.x,p.dir);
    this.deliveries++;
    if (live(delivered)) delivered.skill.gainSp(record.bb['attack@sp'],'angel2:delivery');
    b.emit('exusiaiCovenantDelivery',{owner:u,unit:delivered,remaining:selected.remaining});
  }
  tick() {
    const { core,b,u } = this; let p = core.phase;
    if (p?.kind === 's3-delivery') {
      if (!p.released && due(b,p.releaseAt)) {
        p.released = true;
        const projectile = b.addProjectile({ from: u, to: p.point, source:u, speed:10, maxAge:5, visual:'bolt',
          data: { arkpediaTrackedVisual:true,exusiaiCovenantOwner:core,exusiaiCovenantKind:'delivery' },
          onMove: ({projectile}) => { if (!core.valid()) projectile.removed=true; }, onHit: () => this.arrive(p) });
        b.emit('exusiaiCovenantDeliveryProjectileBirth',{owner:u,projectile,token:p.token});
      }
      if (!core.valid() || core.phase !== p) return true;
      if (!due(b,p.readyAt)) return true;
      core.phase = null; return true;
    }
    if (p || !live(this.token) || !u.skill.active || u.skill.ammoLeft<=0 || u.atkCd>1e-9) return false;
    const clip='Skill_3_Skill', m=model(u), speed=u.base.bat/u.s.interval;
    p = {kind:'s3-delivery',token:this.token,tokenSeq:this.token.deploySeq,dir:this.token.dir,
      point:{x:this.token.x,y:this.token.y},epoch:u.attackControlEpoch,
      releaseAt:b.time+m.eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+Math.max(u.s.interval,m.durations[clip]/speed),released:false};
    core.phase=p;core.visual(clip,speed);u.atkCd=u.s.interval;return true;
  }
  stop() {
    this.stock=0;this.readyAt=Infinity;
    if (this.token?.alive) this.b.retreat(this.token,{permanent:true,reason:'angel2-owner-removed'});
    this.token=null;this.readyAt=Infinity;for(const h of this.handles)this.b.off(h);this.handles=[];
    this.b.projectiles.remove(p=>p.data?.exusiaiCovenantOwner===this.core&&p.data?.exusiaiCovenantKind==='delivery');
  }
}
