import { apiFetch } from '../../../lib/http';

export type AgentTokenMeta = {
    id: string;
    name: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt?: string | null;
};

export type CreateAgentTokenResponse = {
    token: string;
    tokenMeta: AgentTokenMeta;
    warning: string;
};

export async function listAgentTokens(): Promise<AgentTokenMeta[]> {
    return apiFetch('/api/agent-tokens');
}

export async function createAgentToken(name: string, scopes: string[] = ['finance:read', 'finance:write']) {
    return apiFetch<CreateAgentTokenResponse>('/api/agent-tokens', {
        method: 'POST',
        body: JSON.stringify({ name, scopes })
    });
}

export async function revokeAgentToken(id: string) {
    return apiFetch(`/api/agent-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}