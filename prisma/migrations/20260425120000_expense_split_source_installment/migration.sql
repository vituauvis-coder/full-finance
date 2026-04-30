-- Parcelas de origem persistidas no pedido (Postgres, app local / Railway)
ALTER TABLE expense_split_requests
ADD COLUMN IF NOT EXISTS source_installment_count INTEGER NULL;

COMMENT ON COLUMN expense_split_requests.source_installment_count IS
'N de parcelas da saída original no momento do pedido; usado ao criar a saída do destinatário quando expenses.installment_count estiver ausente.';
