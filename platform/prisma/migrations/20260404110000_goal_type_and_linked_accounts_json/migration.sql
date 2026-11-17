-- Goal: tipo + várias contas (JSON); remove FK única linkedAccountId

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[Goal] ADD [goalType] NVARCHAR(1000) NOT NULL CONSTRAINT [Goal_goalType_df] DEFAULT 'outro';
ALTER TABLE [dbo].[Goal] ADD [linkedAccountIds] NVARCHAR(MAX) NULL;

UPDATE [dbo].[Goal]
SET [linkedAccountIds] = CONCAT(N'["', CAST([linkedAccountId] AS NVARCHAR(36)), N'"]')
WHERE [linkedAccountId] IS NOT NULL;

ALTER TABLE [dbo].[Goal] DROP CONSTRAINT [Goal_linkedAccountId_fkey];
ALTER TABLE [dbo].[Goal] DROP COLUMN [linkedAccountId];

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;
END CATCH
