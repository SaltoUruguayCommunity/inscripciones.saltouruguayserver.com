import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const UsersTable = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  susId: integer('sus_id').unique().notNull(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  username: text('username').notNull(),
  avatar: text('avatar'),
  discordId: text('discord_id'),
  discordUsername: text('discord_username'),
  admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

export const EventsTable = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  eventDate: text('event_date'),
  eventLocation: text('event_location'),
  status: text('status').notNull().default('upcoming'),
  maxParticipants: integer('max_participants'),
  customFields: text('custom_fields', { mode: 'json' }),
  createdBy: integer('created_by').notNull().references(() => UsersTable.id),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

export const InscriptionsTable = sqliteTable('inscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => EventsTable.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => UsersTable.id, { onDelete: 'cascade' }),
  customData: text('custom_data', { mode: 'json' }),
  notes: text('notes'),
  status: text('status').notNull().default('confirmed'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  userEventUniq: uniqueIndex('user_event_uniq').on(t.userId, t.eventId),
}));

export const UsersRelations = relations(UsersTable, ({ many }) => ({
  inscriptions: many(InscriptionsTable),
  createdEvents: many(EventsTable),
}));

export const EventsRelations = relations(EventsTable, ({ one, many }) => ({
  creator: one(UsersTable, { fields: [EventsTable.createdBy], references: [UsersTable.id] }),
  inscriptions: many(InscriptionsTable),
}));

export const InscriptionsRelations = relations(InscriptionsTable, ({ one }) => ({
  event: one(EventsTable, { fields: [InscriptionsTable.eventId], references: [EventsTable.id] }),
  user: one(UsersTable, { fields: [InscriptionsTable.userId], references: [UsersTable.id] }),
}));

export interface CustomField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'url' | 'email';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}
