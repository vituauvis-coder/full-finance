BEGIN TRY
BEGIN TRAN;
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'Goal_linkedAccountId_fkey')
    ALTER TABLE [dbo].[Goal] DROP CONSTRAINT [Goal_linkedAccountId_fkey];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Goal') AND name = N'linkedAccountId')
    ALTER TABLE [dbo].[Goal] DROP COLUMN [linkedAccountId];
COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
