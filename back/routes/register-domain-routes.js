import { registerExpenseSplitRoutes } from '../expense-splits.js';
import { registerZeroBudgetRoutes } from '../zero-budget.js';
import { registerCofrinhoRoutes } from '../cofrinho-allocation.js';
import { registerHouseholdRoutes } from '../household.js';
import { registerTripsRoutes } from './trips.routes.js';

/** Módulos de rota já extraídos; o restante permanece em index até migração por domínio. */
export function registerDomainRoutes(app, { requireAuth }) {
    registerExpenseSplitRoutes(app, { requireAuth });
    registerZeroBudgetRoutes(app, requireAuth);
    registerCofrinhoRoutes(app, requireAuth);
    registerHouseholdRoutes(app, { requireAuth });
    registerTripsRoutes(app, { requireAuth });
}