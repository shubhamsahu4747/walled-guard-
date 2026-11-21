import { pgTable, bigserial, timestamp, text, integer, boolean, index } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    site: text('site', { enum: ['chatgpt', 'perplexity'] }).notNull(),
    kind: text('kind', { enum: ['prompt', 'file'] }).notNull(),
    fileType: text('file_type', { enum: ['text', 'pdf', 'image'] }),
    fileName: text('file_name'),
    sizeBytes: integer('size_bytes'),
    detected: boolean('detected').notNull(),
    detectionSource: text('detection_source', {
      enum: ['plain-text', 'text-layer', 'ocr', 'fuzzy']
    }),
    decision: text('decision', {
      enum: ['clean', 'continued', 'cancelled', 'scan_failed']
    }).notNull(),
    scanMs: integer('scan_ms'),
    contentHash: text('content_hash').notNull(),
    snippet: text('snippet') // opt-in, <= 80 chars
  },
  (t) => [
    index('idx_events_ts').on(t.ts),
    index('idx_events_hash').on(t.contentHash),
    index('idx_events_site_kind').on(t.site, t.kind)
  ]
);

export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
