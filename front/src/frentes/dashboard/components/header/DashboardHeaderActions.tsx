import { DashboardFilterRibbon } from '../DashboardFilterRibbon';

type Props = {
    hidden: boolean;
};

export function DashboardHeaderActions({ hidden }: Props) {
    if (hidden) return null;
    return <DashboardFilterRibbon placement="header" />;
}