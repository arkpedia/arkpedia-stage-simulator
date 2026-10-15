// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4237_jcinta.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const JCINTA_ID = 'char_4237_jcinta';
export const JCINTA_SKILLS = Object.freeze(['skcom_assist_cost[3]', 'skchr_jcinta_2']);
export const selectedJcintaBuild = build => selectedCNSourceBuild(e, JCINTA_ID, build);
const parts = ['characters', 'skills'].flatMap(group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components)));
export const jcintaComponent = id => parts.find(p => p.pathId === id)?.data;
