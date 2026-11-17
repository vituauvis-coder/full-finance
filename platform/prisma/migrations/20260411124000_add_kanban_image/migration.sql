-- Adicionar coluna image para armazenar imagem em Base64 nos cards do kanban
ALTER TABLE [KanbanCard] ADD [image] NVARCHAR(Max) NULL;
