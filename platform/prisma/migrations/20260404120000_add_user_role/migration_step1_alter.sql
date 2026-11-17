BEGIN TRY
BEGIN TRAN;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = N'User' AND c.name = N'role' AND SCHEMA_NAME(t.schema_id) = N'dbo'
)
BEGIN
    ALTER TABLE [dbo].[User] ADD [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'USER';
END
COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
