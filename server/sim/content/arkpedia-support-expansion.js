// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-support-expansion-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, sortEnemyTargets } from '../targeting.js';

const models = (id) => evidence.operators[id].models.Front;
const retainedDollBuff = (buff, unit) => buff.persist ||
  (unit.skill.id === 'skchr_vrdant_1' && buff.key === unit.skill._buffKey);

export function customizeSupportExpansionKit({ id, def, unit, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_272_strong') {
    kit.trait = { ...kit.trait, merchantInterval: def.traitBb.interval,
      merchantCost: -def.traitBb.cost };
    kit.skill = { id: skill.id, name: skill.name, kind: 'toggle',
      trigger: { rule: 'SP_FULL' }, mods: { atkPct: bb.atk },
      attack: { dmgType: 'phys', windup: models(id).hits[skill.id === 'skchr_strong_2' ? 'Skill' : 'Attack'][0] },
    };
    if (skill.id === 'skchr_strong_1') {
      kit.skill.attack.onEachHit = ({ battle, unit, target }) => {
        if (target.alive) battle.applyStatus(target, 'silence', {
          duration: bb['attack@silence'], source: unit,
        });
      };
    } else {
      // x-4 is the independent Heal selector, never Jaye's attack range.
      if (!skill.rangeGrid?.length) throw Error('Missing source Jaye heal range');
      kit.skill.onHit = ({ battle, unit, dealt }) => {
        if (!(dealt > 0)) return;
        const keys = absoluteRangeKeys(skill.rangeGrid, unit.tileR, unit.tileC, unit.dir);
        const target = battle.injuredAlliesInKeys(keys, unit)[0];
        if (!target) return;
        const amount = dealt * bb.scale;
        battle.addProjectile({ from: unit, target, speed: 5, source: unit, visual: 'heal',
          onHit: ({ target: ally }) => { if (ally?.alive) battle.heal(unit, ally, amount); } });
      };
    }
  } else if (id === 'char_4107_vrdant') {
    // The original has two-stage transitions and an explicit retained-buff list.
    // Suppress the inherited assumed one-second Dollkeeper installation.
    kit.trait = { ...kit.trait, install: null };
    kit.skill = skill.id === 'skchr_vrdant_1'
      ? { id: skill.id, name: skill.name, kind: 'passive',
        mods: { hpPct: bb.max_hp, resFlat: bb.magic_resistance } }
      : { id: skill.id, name: skill.name, kind: 'duration',
        canActivate: () => !unit.trait.doll && !unit.trait.dollSwitching,
        mods: { aspd: bb.attack_speed }, attack: { dmgType: 'arts',
          windup: models(id).hits.Skill_2_Loop[0],
          onEachHit: ({ battle, unit }) => battle.loseHp(unit, unit.s.maxHp * bb.hp_ratio, {
            source: unit, noSp: true,
          }),
        },
        onStart: ({ unit }) => { unit.atkCd = 0; },
        onEnd: ({ unit }) => { unit.atkCd = 0; },
      };
  } else if (id === 'char_4165_ctrail') {
    const first = skill.id === 'skchr_ctrail_1';
    kit.trait = { ...kit.trait, install: null, attack: 'ranged', projectile: 'arrow',
      canHitFly: false, blockFly: false };
    kit.skill = { id: skill.id, name: skill.name, kind: 'duration',
      ...(first ? { activateOnDeploy: true, duration: bb.duration, trigger: { rule: 'NEVER' } } : {}),
      mods: { atkPct: bb.atk, ...(first ? { dodgePhys: bb.prob } : {}) },
      attack: { dmgType: 'phys', windup: models(id).hits.Attack[0],
        projectileSpeed: 10, canHitFly: true,
        ...(!first ? { onEachHit: ({ battle, unit, target }) => {
          if (target.isFlying) battle.applyStatus(target, 'sluggish', {
            duration: bb['attack@sluggish'], source: unit,
          });
        } } : {}),
      },
      targeting: { rangeGrid: skill.rangeGrid, maxTargets: first ? 1 : bb['attack@max_target'] },
      onStart: ({ battle, unit }) => beginContrailFlight(battle, unit, def),
      onEnd: ({ battle, unit, reason }) => { if (reason !== 'death') endContrailFlight(battle, unit, def); },
    };
  }
}

function contrailGround(battle, unit, def) {
  battle.removeBuff(unit, 'contrail:flight'); unit.profile.canHitFly = false;
  const talent = def.talents[0]?.bb;
  if (talent) battle.addBuff(unit, { key: 'contrail:ground-defense', mods: { defPct: talent.def } });
}

function beginContrailFlight(battle, unit, def) {
  const first = def.skill.id === 'skchr_ctrail_1', prefix = first ? 'Skill' : 'Skill_2';
  const clips = models(unit.defId), start = battle.time;
  // S1 writes the source range into default mode 7 too: its expanded normal
  // range remains after landing. S2 restores the original range when it ends.
  if (first) unit.rangeGrid = def.skill.rangeGrid;
  unit.mem.regularFormVisual = { clip: `${prefix}_Begin`, loop: false,
    height: { start: start + .167, from: 0, to: def.skill.bb['attack@height_offset'], duration: .8333 } };
  battle.addBuff(unit, { key: 'contrail:transition', flags: { disarm: true } });
  unit.atkCd = 0;
  battle.after(clips.hits[`${prefix}_Begin`][0], () => {
    if (!unit.alive || !unit.deployed) return;
    battle.removeBuff(unit, 'contrail:ground-defense');
    battle.addBuff(unit, { key: 'contrail:flight', flags: { liftoff: true, blockFly: true } });
    battle.releaseBlocked(unit); unit.profile.canHitFly = true;
  }, { owner: unit });
  battle.after(clips.durations[`${prefix}_Begin`], () => {
    if (!unit.alive || !unit.deployed) return;
    battle.removeBuff(unit, 'contrail:transition');
    unit.mem.regularFormVisual = { clip: `${prefix}_Idle`, loop: true,
      attack: `${prefix}_Loop`, heightOffset: def.skill.bb['attack@height_offset'] };
    unit.atkCd = 0;
  }, { owner: unit });
}

function endContrailFlight(battle, unit, def) {
  const first = def.skill.id === 'skchr_ctrail_1', prefix = first ? 'Skill' : 'Skill_2';
  const clips = models(unit.defId), start = battle.time, height = def.skill.bb['attack@height_offset'];
  unit.mem.regularFormVisual = { clip: `${prefix}_End`, loop: false,
    height: { start, from: height, to: 0, duration: .8333 } };
  battle.addBuff(unit, { key: 'contrail:transition', flags: { disarm: true } });
  battle.after(clips.hits[`${prefix}_End`][0], () => {
    if (unit.alive && unit.deployed) contrailGround(battle, unit, def);
  }, { owner: unit });
  battle.after(clips.durations[`${prefix}_End`], () => {
    if (!unit.alive || !unit.deployed) return;
    battle.removeBuff(unit, 'contrail:transition'); unit.mem.regularFormVisual = null;
    unit.atkCd = 0;
  }, { owner: unit });
}

function installVerdant(battle, unit, def) {
  const source = models(def.id), dollRange = def.raw.trait?.rangeGrid;
  if (!dollRange?.length) throw Error('Missing source Verdant substitute range');
  const originalRange = unit.rangeGrid, talent = def.talents[0]?.bb;
  const setVisual = (clip, loop) => { unit.mem.regularFormVisual = { clip, loop,
    ...(loop ? { attack: 'Doll_Attack', die: 'Doll_Die' } : {}) }; };
  const clear = () => {
    if (unit.skill.active && unit.skill.kind !== 'passive') unit.skill.end('substitute');
    for (const buff of unit.buffs.slice())
      if (!retainedDollBuff(buff, unit)) battle.removeBuff(unit, buff);
    unit.skill.sp = 0; unit.skill.charges = 0;
  };
  const phase = (clip, duration, done) => {
    setVisual(clip, false);
    battle.after(duration, () => { if (unit.alive && unit.deployed) done(); }, { owner: unit });
  };
  const switching = () => battle.addBuff(unit, { key: 'verdant:switching',
    flags: { invulnerable: true, noSp: true, noHeal: true, healFree: true,
      isolated: true, disarm: true }, persist: false });
  const normal = () => {
    if (!unit.alive || !unit.deployed) return;
    unit.trait.doll = false; unit.form = null;
    unit.rangeGrid = originalRange; unit.profile.canHitFly = false;
    unit.profile.attackVisual = null;
    clear(); switching();
    // The source heals on the outgoing Doll_SwitchOut, before Born.
    unit.hp = unit.s.maxHp;
    phase('Doll_SwitchOut', source.durations.Doll_SwitchOut, () => {
      phase('Start', source.durations.Start, () => {
        unit.mem.regularFormVisual = null; unit.trait.dollSwitching = false;
        battle.removeBuff(unit, 'verdant:switching'); battle.refreshRange(unit);
        unit.atkCd = 0;
      });
    });
    battle.refreshRange(unit);
  };
  const enter = () => {
    unit.trait.dollSwitching = true; clear(); switching();
    // Ground blocking becomes zero as soon as the switch begins.
    battle.addBuff(unit, { key: 'verdant:zero-block', mods: { blockCntMul: 0 } });
    battle.releaseBlocked(unit); unit.hp = unit.s.maxHp;
    phase('SwitchOut', source.durations.SwitchOut, () => {
      unit.trait.doll = true; unit.form = 'doll';
      unit.rangeGrid = dollRange; unit.profile.canHitFly = false;
      if (talent) battle.addBuff(unit, { key: 'verdant:regeneration',
        mods: { hpRegenRatio: talent.hp_recovery_per_sec_by_max_hp_ratio } });
      battle.refreshRange(unit);
      // Source substitute timer starts when its mode is entered, before its
      // entrance clip finishes. Neither transition allows attacks or SP.
      battle.after(def.traitBb.duration, () => {
        unit.trait.dollSwitching = true; normal();
      }, { owner: unit });
      phase('Doll_SwitchIn', source.durations.Doll_SwitchIn, () => {
        unit.trait.dollSwitching = false;
        battle.removeBuff(unit, 'verdant:switching');
        setVisual('Doll_Idle', true); unit.atkCd = 0;
        battle.addBuff(unit, { key: 'verdant:doll-sp', flags: { noSp: true } });
      });
    });
  };
  battle.on('fatal', (ctx) => {
    if (ctx.unit !== unit || ctx.prevented) return;
    if (unit.trait.dollSwitching) { ctx.prevented = true; return; }
    if (unit.trait.doll) return;
    enter(); ctx.prevented = true;
  }, { owner: unit, priority: -100 });
  battle.on('beforeStatus', (ctx) => {
    if (ctx.target === unit && unit.trait.dollSwitching && ['stun', 'freeze', 'sleep'].includes(ctx.status))
      ctx.cancel = true;
  }, { owner: unit });
  battle.on('death', ({ unit: dead }) => {
    if (dead === unit) { unit.trait.doll = false; unit.trait.dollSwitching = false; unit.form = null; }
  }, { owner: unit });
  battle.on('beforeAttack', (ctx) => {
    if (ctx.attacker === unit && unit.trait.doll) {
      ctx.profile.dmgType = 'phys'; ctx.profile.attackVisual = 'Doll_Attack';
      ctx.profile.windup = source.hits.Doll_Attack[0];
    }
  }, { owner: unit });
}

export function installSupportExpansion({ battle, unit, def }) {
  const talent = def.talents[0]?.bb;
  if (unit.defId === 'char_272_strong') {
    unit.profile.windup = models(unit.defId).hits.Attack[0];
    if (talent) unit.profile.dmgMul = (_b, _u, target) =>
      target.def.tags?.includes('infection') ? talent.atk_scale : 1;
  } else if (unit.defId === 'char_4107_vrdant') {
    unit.profile.windup = models(unit.defId).hits.Attack[0];
    installVerdant(battle, unit, def);
  } else if (unit.defId === 'char_4165_ctrail') {
    unit.profile.windup = models(unit.defId).hits.Attack[0];
    unit.profile.projectileSpeed = 10;
    contrailGround(battle, unit, def);
    unit.profile.dmgMul = (_battle, unit) => unit.s.flags.liftoff && talent ? talent.atk_scale : 1;
    battle.on('beforeAttack', (ctx) => {
      if (ctx.attacker !== unit || !unit.s.flags.liftoff) return;
      const first = def.skill.id === 'skchr_ctrail_1';
      if (!first && ctx.isSkill) {
        const all = battle.enemiesInKeys(unit.rangeKeys, unit, ctx.profile);
        for (const blocked of battle.blockedTargets(unit, ctx.profile))
          if (!all.includes(blocked)) all.push(blocked);
        sortEnemyTargets(battle, unit, all, ctx.profile.priority);
        const ground = all.filter(target => !target.isFlying).slice(0, def.skill.bb['attack@max_walk_target']);
        const eligible = all.filter(target => target.isFlying || ground.includes(target));
        ctx.targets = eligible.slice(0, def.skill.bb['attack@max_target']);
      }
      ctx.profile.attackVisual = ctx.targets[0]?.isFlying
        ? first ? 'Skill_Loop' : 'Skill_2_Loop'
        : first ? 'Skill_Down_Loop' : 'Skill_Down_2_Loop';
    }, { owner: unit });
  }
}
