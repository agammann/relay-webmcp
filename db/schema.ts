import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull(),
    data: text('data').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_workspaces_updated_at').on(table.updatedAt)],
);
