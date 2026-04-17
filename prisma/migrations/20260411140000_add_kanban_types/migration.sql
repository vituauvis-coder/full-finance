-- Adicionar campos para diferenciar Bug e Melhoria no Kanban

-- Adicionar coluna type
ALTER TABLE [KanbanCard] ADD [type] NVARCHAR(20) NOT NULL DEFAULT 'melhoria';

-- Adicionar campos específicos para BUG
ALTER TABLE [KanbanCard] ADD [screen] NVARCHAR(200) NULL;
ALTER TABLE [KanbanCard] ADD [steps] NVARCHAR(Max) NULL;
ALTER TABLE [KanbanCard] ADD [expected] NVARCHAR(Max) NULL;
ALTER TABLE [KanbanCard] ADD [actual] NVARCHAR(Max) NULL;

-- Adicionar campo específico para MELHORIA
ALTER TABLE [KanbanCard] ADD [benefit] NVARCHAR(Max) NULL;

-- Criar índice para type
CREATE INDEX [KanbanCard_type_idx] ON [KanbanCard]([type]);
