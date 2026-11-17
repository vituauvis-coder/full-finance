# Perfil — React

Rota: **`/perfil`** · Página: `frentes/perfil/pages/ProfilePage.tsx`

## Camadas

| Pasta | Função |
|-------|--------|
| `api/profileApi.ts` | GET/PATCH `/api/profile`, saldo, senha, exclusão |
| `domain/` | Carga inicial, período, saldo do mês, `FileReader` + `@motor/conta` |
| `hooks/` | `useProfilePage` compõe data, foto, credenciais, prefs, exclusão |
| `lib/profileEvents.ts` | evento `profile-updated` (sidebar) |
| `types/profile.ts` | DTOs; moedas/labels reexportam motor |
| `components/` | UI por card |
| `styles/profile-modern.css` | Layout + tokens `--dash-*` |

Motor: `motor/conta/profile-rules.js` (validação foto/senha, moedas, saldo).

## Menu lateral

`SidebarProfile` é um `NavLink` para `/perfil` (`#user-info`). Estado ativo: `sidebar-user-on-profile`.

## API

Contrato igual ao legado (`legacy-web/js/features/profile/profile.js`). Foto em Base64 via PATCH; sons em `localStorage`; saldo `POST /api/profile/balance`; caixa via `financePreferences`; exclusão `DELETE /api/user`.