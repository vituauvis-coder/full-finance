# Milhas household — plano de implementação

> Spec: `platform/docs/superpowers/specs/2026-11-19-milhas-household-design.md`

**Status:** v1 implementado (compartilhar + visibilidade + titular). Fusão de Esferas duplicadas: pendente.

**Passos manuais (Victor / Millena):**

1. Garantir os dois no mesmo `/api/household` (convite por e-mail em Perfil/Casa, se ainda não estiver).
2. **Millena** (e-mail da Esfera): editar Esfera → marcar **Compartilhada com a casa** → titular **Millena** → salvar.
3. **Victor**: no login dele, a Esfera da casa aparece no rail; a Esfera pessoal duplicada pode ficar com saldo 0 ou ser desativada depois da fusão (v1.5).
4. Lançamentos de qualquer login entram no mesmo extrato.