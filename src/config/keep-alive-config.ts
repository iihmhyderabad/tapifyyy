export type KeepAliveConfig = typeof keepAliveConfig;

/**
 * Supabase Pause Prevention Configuration
 * Based on https://github.com/travisvn/supabase-pause-prevention
 *
 * Keeps free-tier Supabase projects active by performing periodic
 * read/write operations so that Supabase does not pause the project
 * after 7 days of inactivity.
 */
export const keepAliveConfig = {
  // Target table in your Supabase database
  table: "keep_alive",

  // Column that is queried and populated with random entries
  column: "name",

  // Enables automatic insertion and deletion of keep-alive entries
  allowInsertionAndDeletion: true,

  // Disables querying with random non-existent string if insertion/deletion is enabled
  disableRandomStringQuery: false,

  // Maximum number of entries kept in the keep_alive table before pruning older entries
  sizeBeforeDeletions: 10,

  // Log details to console on errors
  consoleLogOnError: true,

  // Optional list of other project keep-alive endpoints to daisy-chain ping
  // (useful if you have other Vercel / Supabase projects on free tier)
  otherEndpoints: [] as string[],
};

