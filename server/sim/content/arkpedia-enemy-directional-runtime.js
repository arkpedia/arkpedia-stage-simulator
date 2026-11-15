// SPDX-License-Identifier: GPL-3.0-or-later
import { crowdDirectionalGuard as guard } from './arkpedia-enemy-directional.js';
import { burdenbeastSupplier } from './arkpedia-enemy-burdenbeast.js';
export const crowdDirectionalGuard=p=>p.supplier?burdenbeastSupplier(p):guard(p);
