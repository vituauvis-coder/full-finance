BEGIN TRY
BEGIN TRAN;

-- Gain: extorno ligado à compra original
EXEC sp_executesql N'ALTER TABLE [dbo].[Gain] ADD [relatedExpenseId] NVARCHAR(1000) NULL';
EXEC sp_executesql N'CREATE NONCLUSTERED INDEX [Gain_relatedExpenseId_idx] ON [dbo].[Gain]([relatedExpenseId])';

-- Expense: saída do destinatário ligada ao pedido de rateio
EXEC sp_executesql N'ALTER TABLE [dbo].[Expense] ADD [splitRequestId] NVARCHAR(1000) NULL';
/* UNIQUE filtrado: várias linhas com NULL são permitidas (SQL Server trata NULL como duplicata em índice UNIQUE sem filtro). */
EXEC sp_executesql N'CREATE UNIQUE NONCLUSTERED INDEX [Expense_splitRequestId_key] ON [dbo].[Expense]([splitRequestId]) WHERE [splitRequestId] IS NOT NULL';

-- Solicitações de rateio
CREATE TABLE [dbo].[ExpenseSplitRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [sourceExpenseId] NVARCHAR(1000) NOT NULL,
    [requesterUserId] NVARCHAR(1000) NOT NULL,
    [recipientUserId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [requesterCreditAccountId] NVARCHAR(1000) NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ExpenseSplitRequest_status_df] DEFAULT 'PENDING',
    [senderProofUrl] NVARCHAR(MAX) NULL,
    [createdGainId] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseSplitRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseSplitRequest_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ExpenseSplitRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [ExpenseSplitRequest_recipientUserId_status_idx] ON [dbo].[ExpenseSplitRequest]([recipientUserId], [status]);
CREATE NONCLUSTERED INDEX [ExpenseSplitRequest_requesterUserId_status_idx] ON [dbo].[ExpenseSplitRequest]([requesterUserId], [status]);
CREATE NONCLUSTERED INDEX [ExpenseSplitRequest_sourceExpenseId_idx] ON [dbo].[ExpenseSplitRequest]([sourceExpenseId]);

ALTER TABLE [dbo].[ExpenseSplitRequest] ADD CONSTRAINT [ExpenseSplitRequest_sourceExpenseId_fkey] FOREIGN KEY ([sourceExpenseId]) REFERENCES [dbo].[Expense]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ExpenseSplitRequest] ADD CONSTRAINT [ExpenseSplitRequest_requesterUserId_fkey] FOREIGN KEY ([requesterUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ExpenseSplitRequest] ADD CONSTRAINT [ExpenseSplitRequest_recipientUserId_fkey] FOREIGN KEY ([recipientUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Expense] ADD CONSTRAINT [Expense_splitRequestId_fkey] FOREIGN KEY ([splitRequestId]) REFERENCES [dbo].[ExpenseSplitRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
