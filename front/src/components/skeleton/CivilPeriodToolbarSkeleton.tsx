import {
    civilPeriodTimelineToolbarClasses,
    type CivilPeriodToolbarAccent
} from '../../lib/civilPeriodToolbar';
import { CivilPeriodTimelineSkeleton } from './CivilPeriodTimelineSkeleton';

type Props = {
    accent: CivilPeriodToolbarAccent;
    inMovementsToolbar?: boolean;
};

/** Paridade de DOM com `CivilPeriodToolbar`. */
export function CivilPeriodToolbarSkeleton({ accent, inMovementsToolbar = false }: Props) {
    return (
        <CivilPeriodTimelineSkeleton
            accentClass={civilPeriodTimelineToolbarClasses(accent)}
            inToolbar={inMovementsToolbar}
        />
    );
}