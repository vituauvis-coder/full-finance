import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';
import { AppBrandKey } from '../legacy-web/js/core/app-brand.js';

const PgSession = connectPgSimple(session);

/**
 * Sessão persistida no Postgres (obrigatório com mais de uma réplica no Railway).
 */
export function createSessionMiddleware({ secret, crossSiteSession }) {
    const behindProxy = process.env.TRUST_PROXY !== 'false';
    const isProd = process.env.NODE_ENV === 'production';
    const store = new PgSession({
        pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    });

    return session({
        name: AppBrandKey.sessionCookie,
        secret,
        store,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        proxy: behindProxy,
        cookie: {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: crossSiteSession ? 'none' : 'lax',
            secure: crossSiteSession || isProd
        }
    });
}