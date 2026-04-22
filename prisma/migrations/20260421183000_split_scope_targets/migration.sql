BEGIN TRY
BEGIN TRAN;

-- Novos campos para split líquido global (inteiro ou por parcela)
EXEC sp_executesql N'ALTER TABLE [dbo].[ExpenseSplitRequest] ADD [splitScope] NVARCHAR(30) NOT NULL CONSTRAINT [ExpenseSplitRequest_splitScope_df] DEFAULT ''FULL_EXPENSE''';
EXEC sp_executesql N'ALTER TABLE [dbo].[ExpenseSplitRequest] ADD [targetInstallmentIndex] INT NULL';
EXEC sp_executesql N'ALTER TABLE [dbo].[ExpenseSplitRequest] ADD [targetPeriodKey] NVARCHAR(20) NULL';
EXEC sp_executesql N'ALTER TABLE [dbo].[ExpenseSplitRequest] ADD [isSettled] BIT NOT NULL CONSTRAINT [ExpenseSplitRequest_isSettled_df] DEFAULT 0';

-- Índice para lookup de alocação por alvo
EXEC sp_executesql N'CREATE NONCLUSTERED INDEX [ExpenseSplitRequest_source_scope_target_idx] ON [dbo].[ExpenseSplitRequest]([sourceExpenseId], [splitScope], [targetInstallmentIndex])';

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
