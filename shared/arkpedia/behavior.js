// SPDX-License-Identifier: GPL-3.0-or-later
// Small, explicit interpreter for reviewed Global buff actions. This does not
// infer mechanics from skill text or enable operators from template names.
const PREFIX = 'Torappu.Battle.Action.Nodes+';
const EVENTS = new Set(['ON_BUFF_START']);
const own = (obj, key) => Object.hasOwn(obj, key);
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw Error(`Unsupported behaviour ${label}`);
}
function fields(value, expected, label) {
  object(value, label);
  if (Object.keys(value).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, wanted]) => !own(value, key) || value[key] !== wanted))
    throw Error(`Unsupported behaviour ${label} fields`);
}
function number(bb, key) {
  if (!own(bb, key) || typeof bb[key] !== 'number' || !Number.isFinite(bb[key]))
    throw Error(`Missing or invalid behaviour blackboard: ${key}`);
  return bb[key];
}
export function actionName(node) {
  const type = node?.$type;
  return typeof type === 'string' && type.startsWith(PREFIX)
    ? type.slice(PREFIX.length).replace(/, Assembly-CSharp$/, '') : String(type ?? 'missing-type');
}

/** Compile the whole template before any event can execute. Unknown fields,
 * events and nodes fail closed, including later nodes in a supported event. */
export function compileBuffTemplate(template) {
  object(template, 'template');
  object(template.eventToActions, 'events');
  if (typeof template.templateKey !== 'string' || !template.templateKey ||
      template.effectKey !== '' || template.onEventPriority !== 'DEFAULT' ||
      Object.keys(template).sort().join(',') !== 'effectKey,eventToActions,onEventPriority,templateKey')
    throw Error('Unsupported behaviour template metadata');
  const events = new Map();
  for (const [event, nodes] of Object.entries(template.eventToActions)) {
    if (!EVENTS.has(event) || !Array.isArray(nodes)) throw Error(`Unsupported behaviour event: ${event}`);
    events.set(event, nodes.map(node => {
      const type = actionName(node);
      const canonical = `${PREFIX}${type}, Assembly-CSharp`;
      if (type === 'ModifyCost') {
        fields(node, { $type: canonical, _sourceType: 'SOURCE', _forceToDisplayNumber: false,
          _forceToDisplayNegativeNumber: false, _blackboardKey: 'cost' }, type);
        return { key: 'cost', kind: 'dp' };
      }
      if (type === 'HealViaMaxHpRatio') {
        fields(node, { $type: canonical, _healTarget: 'BUFF_OWNER', _getMaxHpFromTarget: false,
          _ignoreHealFree: false, _skipModifierEvent: false }, type);
        return { key: 'heal_scale', kind: 'self-heal' };
      }
      throw Error(`Unsupported behaviour action: ${type}`);
    }));
  }
  const requiredBlackboard = [...new Set([...events.values()].flat().map(n => n.key))];
  const validateBlackboard = bb => {
    object(bb, 'blackboard');
    for (const key of requiredBlackboard) {
      const value = number(bb, key);
      if (key === 'heal_scale' && value < 0) throw Error('Invalid behaviour heal_scale');
    }
  };
  return Object.freeze({
    key: template.templateKey, requiredBlackboard: Object.freeze(requiredBlackboard), validateBlackboard,
    run(event, { battle, unit, source = unit, blackboard }) {
      if (!EVENTS.has(event)) throw Error(`Unsupported behaviour event: ${event}`);
      const nodes = events.get(event) ?? [];
      validateBlackboard(blackboard);
      // This first slice only handles a skill buff owned and sourced by the
      // casting operator. Cross-unit source/owner semantics are not supported.
      if (!unit?.alive || source !== unit || unit.ownerId == null || !battle?.getPlayer(unit.ownerId))
        throw Error('Unsupported behaviour owner/source');
      // Resolve every operand before mutating combat: a malformed later action
      // must not leave a partial DP grant or heal behind.
      const plan = nodes.map(node => {
        const value = number(blackboard, node.key);
        const amount = node.kind === 'self-heal' ? unit.s.maxHp * value : value;
        if (!Number.isFinite(amount)) throw Error('Invalid behaviour amount');
        return { kind: node.kind, amount };
      });
      for (const { kind, amount } of plan) {
        if (kind === 'dp') battle.addDp(unit.ownerId, amount);
        else battle.heal(unit, unit, amount, { self: true });
      }
    },
  });
}
