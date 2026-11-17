/* Category criada fora do init antigo ou sem a coluna type — alinha com schema Prisma */
BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[Category]', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Category', 'type') IS NULL
BEGIN
    ALTER TABLE [dbo].[Category]
    ADD [type] NVARCHAR(20) NOT NULL
        CONSTRAINT [DF_Category_type] DEFAULT (N'EXPENSE');
END

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
