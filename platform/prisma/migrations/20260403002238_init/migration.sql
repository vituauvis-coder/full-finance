BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [User_currency_df] DEFAULT 'BRL',
    [hasCompletedTour] BIT NOT NULL CONSTRAINT [User_hasCompletedTour_df] DEFAULT 0,
    [profilePhotoURL] NVARCHAR(1000),
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Account] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [initialBalance] FLOAT(53) CONSTRAINT [Account_initialBalance_df] DEFAULT 0,
    [holderName] NVARCHAR(1000),
    [plasticTone] NVARCHAR(1000),
    [plasticColor] NVARCHAR(1000),
    [limit] FLOAT(53),
    [closeDay] INT,
    [dueDay] INT,
    CONSTRAINT [Account_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Expense] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [accountId] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [isPaid] BIT NOT NULL CONSTRAINT [Expense_isPaid_df] DEFAULT 1,
    [isInvestment] BIT NOT NULL CONSTRAINT [Expense_isInvestment_df] DEFAULT 0,
    CONSTRAINT [Expense_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Gain] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [accountId] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [isPaid] BIT NOT NULL CONSTRAINT [Gain_isPaid_df] DEFAULT 1,
    CONSTRAINT [Gain_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Budget] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [month] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Budget_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Goal] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [targetAmount] FLOAT(53) NOT NULL,
    [currentAmount] FLOAT(53) NOT NULL CONSTRAINT [Goal_currentAmount_df] DEFAULT 0,
    [linkedAccountId] NVARCHAR(1000),
    CONSTRAINT [Goal_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Investment] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [institution] NVARCHAR(1000),
    [currentValue] FLOAT(53) NOT NULL CONSTRAINT [Investment_currentValue_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [linkedAccountId] NVARCHAR(1000),
    CONSTRAINT [Investment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AdminLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [details] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AdminLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AdminLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Feedback] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Feedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Feedback_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Account] ADD CONSTRAINT [Account_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Expense] ADD CONSTRAINT [Expense_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Expense] ADD CONSTRAINT [Expense_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Gain] ADD CONSTRAINT [Gain_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Gain] ADD CONSTRAINT [Gain_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Budget] ADD CONSTRAINT [Budget_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Goal] ADD CONSTRAINT [Goal_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Goal] ADD CONSTRAINT [Goal_linkedAccountId_fkey] FOREIGN KEY ([linkedAccountId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Investment] ADD CONSTRAINT [Investment_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Investment] ADD CONSTRAINT [Investment_linkedAccountId_fkey] FOREIGN KEY ([linkedAccountId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AdminLog] ADD CONSTRAINT [AdminLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Feedback] ADD CONSTRAINT [Feedback_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
