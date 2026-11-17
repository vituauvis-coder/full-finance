import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

type Props = {
    title: string;
    load: () => Promise<React.ReactNode>;
};

export function DinheiroPage({ title, load }: Props) {
    const [body, setBody] = useState<React.ReactNode>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        load()
            .then((node) => {
                if (!cancelled) {
                    setBody(node);
                    setReady(true);
                }
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
            });
        return () => {
            cancelled = true;
        };
    }, [load]);

    return (
        <Card>
            <h2>{title}</h2>
            {error ? (
                <p role="alert" className="muted">
                    {error}
                </p>
            ) : (
                ready ? body : <ScreenLoader label={title} />
            )}
        </Card>
    );
}