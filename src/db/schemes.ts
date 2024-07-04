import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const linkedinMediaTable = sqliteTable('media_linkedin', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    date: text('created_at')
        .default(sql`(CURRENT_TIMESTAMP)`)
        .notNull(),
    tokenAccess: text('tokenAccess'),
    tokenExpiration: integer('tokenExpiration'),
    profile_id: text('profile_id'),
    profile_username: text('profile_username'),
    profile_picture: text('profile_picture'),
    profile_followers: text('profile_followers'),  // Assuming JSON stored as text
    posts: text('posts')  // Assuming JSON stored as text
});

// Infer types for row insertions and queries
export type InsertLinkedinMedia = typeof linkedinMediaTable.$inferInsert;
export type SelectLinkedinMedia = typeof linkedinMediaTable.$inferSelect;

export const twitterMediaTable = sqliteTable('media_twitter', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    date: text('created_at')
        .default(sql`(CURRENT_TIMESTAMP)`)
        .notNull(),
    tokenAccess: text('tokenAccess'),
    tokenRefresh: text('tokenRefresh'),
    tokenExpiration: integer('tokenExpiration'),
    profile_id: text('profile_id'),
    profile_username: text('profile_username'),
    profile_url: text('profile_url'),
    profile_picture: text('profile_picture'),
    profile_followers: text('profile_followers'),  // Assuming JSON stored as text
    posts: text('posts')  // Assuming JSON stored as text
});

export type InsertTwitterMedia = typeof twitterMediaTable.$inferInsert;
export type SelectTwitterMedia = typeof twitterMediaTable.$inferSelect;

export const youtubeMediaTable = sqliteTable('media_youtube', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    date: text('created_at')
        .default(sql`(CURRENT_TIMESTAMP)`)
        .notNull(),
    tokenAccess: text('tokenAccess'),
    tokenRefresh: text('tokenRefresh'),
    tokenExpiration: integer('tokenExpiration'),
    profile_id: text('profile_id'),
    profile_username: text('profile_username'),
    profile_url: text('profile_url'),
    profile_picture: text('profile_picture'),
    profile_followers: text('profile_followers'),  // Assuming JSON stored as text
    posts: text('posts')  // Assuming JSON stored as text
});

export type InsertYoutubeMedia = typeof youtubeMediaTable.$inferInsert;
export type SelectYoutubeMedia = typeof youtubeMediaTable.$inferSelect;

export const pendingLinkedinTable = sqliteTable('pending_linkedin', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    postingDate: integer('postingDate').notNull(),
    contentType: text('contentType'),
    content: text('content')  // Assuming JSON stored as text, adjust if different
});

export type InsertPendingLinkedin = typeof pendingLinkedinTable.$inferInsert;
export type SelectPendingLinkedin = typeof pendingLinkedinTable.$inferSelect;

export const pendingTweetsTable = sqliteTable('pending_tweets', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    postingDate: integer('postingDate').notNull(),
    content: text('content')  // Assuming JSON stored as text, adjust if different
});

export type InsertPendingTweets = typeof pendingTweetsTable.$inferInsert;
export type SelectPendingTweets = typeof pendingTweetsTable.$inferSelect;

export const pendingYoutubeTable = sqliteTable('pending_youtube', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    postingDate: integer('postingDate').notNull(),
    content: text('content')  // Assuming JSON stored as text, adjust if different
});

export type InsertPendingYoutube = typeof pendingYoutubeTable.$inferInsert;
export type SelectPendingYoutube = typeof pendingYoutubeTable.$inferSelect;

export const usersTable = sqliteTable('users', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    date: integer('date').notNull()
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export const eventTable = sqliteTable('event', {
    id: text('id').primaryKey(),
    clerkId: text('clerkId').notNull(),
    socialMedia: text('socialMedia'),
    content: text('content'),
    pendingId: text('pendingId'),
    date: integer('date').notNull(),
    posted: integer('posted').notNull()  // Boolean stored as integer
});

export type InsertEvent = typeof eventTable.$inferInsert;
export type SelectEvent = typeof eventTable.$inferSelect;