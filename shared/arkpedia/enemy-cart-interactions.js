// SPDX-License-Identifier: GPL-3.0-or-later
// The cart's native collision action owns this relation. Instructors do not
// gain an invented attack or aura merely because a cart can collide with them.
export const CART_STOPPER_PREFABS=Object.freeze(['enemy_1262_durplc','enemy_1262_durplc_2']);
export function isCartStoppingEnemy(target){
  const prefab=typeof target==='string'?target:target?.def?.raw?.prefabKey??target?.prefabKey??target?.defId;
  return CART_STOPPER_PREFABS.includes(prefab);
}
