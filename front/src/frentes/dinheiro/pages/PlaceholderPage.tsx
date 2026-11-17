import { Card } from '../../../components/ui/Card';

export function PlaceholderPage({ title }: { title: string }) {
    return (
        <Card>
            <h2>{title}</h2>
            <p className="muted">Em migração para React — use o app legado para dados reais.</p>
        </Card>
    );
}