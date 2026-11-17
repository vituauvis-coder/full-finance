import { isAcceptedSettledSplitRequest } from '@motor/dinheiro/split-net.js';
import type { SplitBundle } from '../../../lib/types/finance';

export function acceptedOutgoingSplits(bundle: SplitBundle | undefined): unknown[] {
    return (bundle?.outgoing ?? []).filter((s) => isAcceptedSettledSplitRequest(s));
}