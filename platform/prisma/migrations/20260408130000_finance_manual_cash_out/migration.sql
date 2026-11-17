BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[User] ADD [financePreferences] NVARCHAR(MAX) NULL;

ALTER TABLE [dbo].[Expense] ADD [cashOutConfirmedPeriods] NVARCHAR(MAX) NULL;

ALTER TABLE [dbo].[Expense] ADD [recurringMonthly] BIT NOT NULL CONSTRAINT [Expense_recurringMonthly_df] DEFAULT 0;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
