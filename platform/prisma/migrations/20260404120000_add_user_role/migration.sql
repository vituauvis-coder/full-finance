BEGIN TRY

BEGIN TRAN;

-- Papel do usuário: USER (padrão) ou ADMIN (painel /api/admin).
ALTER TABLE [dbo].[User] ADD [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'USER';

-- Promove contas que eram admins pela lista antiga (env / hardcoded).
UPDATE [dbo].[User] SET [role] = 'ADMIN' WHERE LOWER([email]) IN (N'joaopedro.torres@ymail.com', N'vitu@gmail.com');

COMMIT TRAN;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
