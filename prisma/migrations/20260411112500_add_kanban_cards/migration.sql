-- Criar tabela KanbanCard para o kanban de sugestões
CREATE TABLE [KanbanCard] (
    [id] NVARCHAR(36) NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [column] NVARCHAR(20) NOT NULL CONSTRAINT [DF_KanbanCard_column] DEFAULT 'backlog',
    [createdBy] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_KanbanCard_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [PK_KanbanCard] PRIMARY KEY ([id]),
    CONSTRAINT [FK_KanbanCard_User_createdBy] FOREIGN KEY ([createdBy]) REFERENCES [User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Criar índices
CREATE INDEX [IX_KanbanCard_column] ON [KanbanCard]([column]);
CREATE INDEX [IX_KanbanCard_createdAt] ON [KanbanCard]([createdAt]);
