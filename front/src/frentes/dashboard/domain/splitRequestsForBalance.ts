import { isAcceptedSettledSplitRequest } from '@motor/dinheiro/split-net.js';
import type { ExpenseSplitRequest, SplitBundle } from '../../../lib/types/finance';

export function acceptedOutgoingSplits(bundle: SplitBundle | undefined): ExpenseSplitRequest[] {
    return (bundle?.outgoing ?? []).filter((s) => isAcceptedSettledSplitRequest(s));
}