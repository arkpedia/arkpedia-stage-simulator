// SPDX-License-Identifier: GPL-3.0-or-later
import {REGULAR_OPERATORS} from './operator-support-index.js';
import {assertSupportedOperator} from './operator-support-contract.js';
export {REGULAR_OPERATORS};
export function assertRegularOperator(op) {
  return assertSupportedOperator(op, REGULAR_OPERATORS[op?.id]);
}
