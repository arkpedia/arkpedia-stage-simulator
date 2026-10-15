// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4208_wintim.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const WINTIM_ID = 'char_4208_wintim';
export const WINTIM_SKILLS = Object.freeze(['skchr_wintim_1', 'skchr_wintim_2']);
export const selectedWintimBuild = build => selectedCNSourceBuild(e, WINTIM_ID, build);
const parts = ['characters', 'skills', 'projectiles'].flatMap(group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components)));
export const wintimComponent = id => parts.find(p => p.pathId === id)?.data;
