BEGIN TRY
BEGIN TRAN;
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE SCHEMA_NAME(t.schema_id) = 'dbo' AND t.name = 'Goal' AND c.name = 'goalType')
    ALTER TABLE [dbo].[Goal] ADD [goalType] NVARCHAR(1000) NOT NULL CONSTRAINT [Goal_goalType_df] DEFAULT 'outro';
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE SCHEMA_NAME(t.schema_id) = 'dbo' AND t.name = 'Goal' AND c.name = 'linkedAccountIds')
    ALTER TABLE [dbo].[Goal] ADD [linkedAccountIds] NVARCHAR(MAX) NULL;
COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
