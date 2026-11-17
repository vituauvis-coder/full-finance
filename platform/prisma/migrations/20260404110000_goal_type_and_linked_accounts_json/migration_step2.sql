UPDATE [dbo].[Goal]
SET [linkedAccountIds] = CONCAT(N'["', CAST([linkedAccountId] AS NVARCHAR(36)), N'"]')
WHERE [linkedAccountId] IS NOT NULL AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Goal') AND name = N'linkedAccountId');
