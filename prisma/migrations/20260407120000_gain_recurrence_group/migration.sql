-- Recorrência mensal (série no mesmo ano): agrupa ganhos gerados juntos
ALTER TABLE [Gain] ADD [recurrenceGroupId] NVARCHAR(36) NULL;

CREATE NONCLUSTERED INDEX [Gain_userId_recurrenceGroupId_idx]
ON [Gain] ([userId], [recurrenceGroupId]);
