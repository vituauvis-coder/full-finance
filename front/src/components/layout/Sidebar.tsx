import { NavLink } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../ui/Button';

const dinheiro = [
    ['dashboard', 'Dashboard'],
    ['entradas', 'Entradas'],
    ['saidas', 'Saídas'],
    ['planejamento', 'Planejamento'],
    ['carteira', 'Carteira'],
    ['cofrinhos', 'Cofrinhos'],
    ['dividas', 'Dívidas']
] as const;

export function Sidebar() {
    const { logout } = useAuth();
    return (
        <aside className="sidebar">
            <h1 className="sidebar__brand">Meu Mundo</h1>
            <details className="sidebar__group" open>
                <summary>Dinheiro</summary>
                <nav>
                    {dinheiro.map(([slug, label]) => (
                        <NavLink key={slug} to={`/dinheiro/${slug}`}>
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </details>
            <details className="sidebar__group">
                <summary>Viagens</summary>
                <nav>
                    <NavLink to="/viagens">Atlas</NavLink>
                </nav>
            </details>
            <NavLink to="/ferramentas">Ferramentas</NavLink>
            <Button onClick={() => void logout()}>Sair</Button>
        </aside>
    );
}