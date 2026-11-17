EXEC sp_executesql N'ALTER TABLE [dbo].[Expense] ADD [createdAt] DATETIME2 NULL';

EXEC sp_executesql N'UPDATE [dbo].[Expense] SET [createdAt] = [date]';

EXEC sp_executesql N'ALTER TABLE [dbo].[Expense] ALTER COLUMN [createdAt] DATETIME2 NOT NULL';
