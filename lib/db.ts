import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Simple local SQLite storage for demo/dev.
// For production you can swap this with Postgres/Supabase, keeping the same API.

/**
 * PATH RULES (важно для Render):
 * 1) Если задан DB_PATH — используем его (полный путь к .db файлу).
 * 2) Иначе выбираем DATA_DIR:
 *    - RENDER_DISK_PATH (если вдруг используешь)
 *    - BEAVBET_DATA_DIR
 *    - на Render по умолчанию /var/data (persistent disk mount)
 *    - локально ./data
 * 3) DB_PATH = DATA_DIR/beavbet.db
 */
const DATA_DIR =
  process.env.DB_PATH
    ? path.dirname(process.env.DB_PATH)
    : (process.env.RENDER_DISK_PATH ||
        process.env.BEAVBET_DATA_DIR ||
        (process.env.RENDER ? "/var/data" : path.join(process.cwd(), "data")));

const DB_PATH =
  process.env.DB_PATH || path.join(DATA_DIR, "beavbet.db");

function hasColumn(db: any, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function ensureColumn(db: any, table: string, column: string, ddl: string) {
  if (hasColumn(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
}

function ensureSchema(db: any) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT,
      currency TEXT DEFAULT 'EUR',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      locked_balance REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, currency)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- deposit | withdraw | bonus | bet | win
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'done', -- pending | done | failed
      created_at INTEGER NOT NULL,
      meta TEXT
    );

    -- Affiliate
    CREATE TABLE IF NOT EXISTS affiliate_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' -- active | disabled
    );

    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ip_hash TEXT,
      ua_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      affiliate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(referred_user_id)
    );

    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id TEXT PRIMARY KEY,
      affiliate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      basis_type TEXT NOT NULL, -- deposit | manual
      basis_amount REAL NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | paid
      created_at INTEGER NOT NULL,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      method TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | paid | rejected
      admin_note TEXT,
      txid TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      meta TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      sport_key TEXT NOT NULL,
      league_title TEXT,
      event_id TEXT,
      commence_time TEXT,
      home_team TEXT,
      away_team TEXT,
      market_key TEXT NOT NULL,
      outcome_name TEXT NOT NULL,
      odds REAL NOT NULL,
      stake REAL NOT NULL,
      potential_payout REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', -- open | settled | void
      created_at INTEGER NOT NULL,
      meta TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_aff_click_code_created ON affiliate_clicks(code, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ref_affiliate_created ON referrals(affiliate_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comm_affiliate_created ON affiliate_commissions(affiliate_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_withdraw_user_created ON withdrawal_requests(user_id, created_at DESC);
  `);

  // Lightweight migrations for older DBs
  ensureColumn(db, "users", "role", "role TEXT NOT NULL DEFAULT 'user'");

  // Wallets: older code paths expect updated_at; keep it optional for backwards compatibility
  ensureColumn(db, "wallets", "updated_at", "updated_at INTEGER");
  // Arena needs lockable funds (available balance stays in wallets.balance)
  ensureColumn(db, "wallets", "locked_balance", "locked_balance REAL NOT NULL DEFAULT 0");

  // Unified wallet ledger (Arena uses it heavily; other products can adopt later)
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- deposit | withdraw | bet | win | lock | unlock | prize | fee
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      product TEXT NOT NULL, -- casino | sportsbook | arena
      ref_id TEXT,
      meta TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
  `);

  // BeavBet Arena (competition / tournament module)
  db.exec(`
    CREATE TABLE IF NOT EXISTS arena_tournaments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      game TEXT NOT NULL,
      team_size INTEGER NOT NULL DEFAULT 1,
      entry_fee REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      max_players INTEGER NOT NULL,
      rake REAL NOT NULL DEFAULT 0.10, -- 10%
      status TEXT NOT NULL DEFAULT 'open', -- open | live | finished
      starts_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arena_participants (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES arena_tournaments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'joined', -- joined | eliminated | winner
      created_at INTEGER NOT NULL,
      UNIQUE(tournament_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_participants_tournament ON arena_participants(tournament_id);

    CREATE TABLE IF NOT EXISTS arena_matches (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES arena_tournaments(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      game TEXT,
      map TEXT,
      server TEXT,
      server_password TEXT,
      join_link TEXT,
      p1_ready INTEGER NOT NULL DEFAULT 0,
      p2_ready INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER,
      p1_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p2_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      winner_team INTEGER,
      status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | reported | pending_review | done
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_matches_tournament_round ON arena_matches(tournament_id, round);

    CREATE TABLE IF NOT EXISTS arena_match_reports (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      result TEXT NOT NULL, -- win | lose
      created_at INTEGER NOT NULL,
      UNIQUE(match_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_reports_match ON arena_match_reports(match_id);

    -- Quick Duels (1v1) for Arena
    CREATE TABLE IF NOT EXISTS arena_duels (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,          -- cs2 | wot (later)
      mode TEXT NOT NULL,          -- 1v1
            team_size INTEGER NOT NULL DEFAULT 1,
stake REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      rake REAL NOT NULL DEFAULT 0.15, -- 15% fee (kept in air)
      status TEXT NOT NULL DEFAULT 'open', -- open | active | reported | pending_review | done | cancelled
      map TEXT,
      server TEXT,
      server_password TEXT,
      join_link TEXT,
      started_at INTEGER,
      ended_at INTEGER,
      p1_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p2_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      winner_team INTEGER,
      p1_ready INTEGER NOT NULL DEFAULT 0,
      p2_ready INTEGER NOT NULL DEFAULT 0,
      ready_deadline INTEGER,
      live_state TEXT,
      match_token TEXT,
      result_source TEXT,
      cancel_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_duels_status ON arena_duels(status);
    CREATE INDEX IF NOT EXISTS idx_arena_duels_game ON arena_duels(game);

    

CREATE TABLE IF NOT EXISTS arena_duel_players (
  duel_id TEXT NOT NULL REFERENCES arena_duels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team INTEGER NOT NULL DEFAULT 1, -- 1 or 2
  is_captain INTEGER NOT NULL DEFAULT 0,
  ready INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (duel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_arena_duel_players_duel ON arena_duel_players(duel_id);

CREATE TABLE IF NOT EXISTS arena_ratings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dam_rank INTEGER NOT NULL DEFAULT 1000,
  matches INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_arena_ratings_rank ON arena_ratings(dam_rank);
CREATE TABLE IF NOT EXISTS arena_duel_reports (
      id TEXT PRIMARY KEY,
      duel_id TEXT NOT NULL REFERENCES arena_duels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      result TEXT NOT NULL, -- win | lose
      created_at INTEGER NOT NULL,
      UNIQUE(duel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_duel_reports_duel ON arena_duel_reports(duel_id);

    -- Arena global chat (MVP)
    CREATE TABLE IF NOT EXISTS arena_chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_chat_created ON arena_chat_messages(created_at);

    -- Arena social: friends + direct messages (MVP)
    CREATE TABLE IF NOT EXISTS arena_friends (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- pending | accepted
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_friends_user ON arena_friends(user_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS arena_dm_threads (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user1_id, user2_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_dm_threads_u1 ON arena_dm_threads(user1_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_arena_dm_threads_u2 ON arena_dm_threads(user2_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS arena_dm_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES arena_dm_threads(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_dm_msg_thread_created ON arena_dm_messages(thread_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS arena_dm_reads (
      thread_id TEXT NOT NULL REFERENCES arena_dm_threads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (thread_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_dm_reads_user ON arena_dm_reads(user_id, last_read_at DESC);

    CREATE TABLE IF NOT EXISTS arena_gifts (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_gifts_to ON arena_gifts(to_user_id, created_at DESC);

    -- Arena Clans (MVP)
    CREATE TABLE IF NOT EXISTS arena_clans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      avatar_url TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_arena_clans_name ON arena_clans(name);

    CREATE TABLE IF NOT EXISTS arena_clan_members (
      clan_id TEXT NOT NULL REFERENCES arena_clans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (clan_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_clan_members_user ON arena_clan_members(user_id, joined_at DESC);

    CREATE TABLE IF NOT EXISTS arena_clan_invites (
      id TEXT PRIMARY KEY,
      clan_id TEXT NOT NULL REFERENCES arena_clans(id) ON DELETE CASCADE,
      invited_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | revoked
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(clan_id, invited_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_arena_clan_invites_user ON arena_clan_invites(invited_user_id, status, updated_at DESC);

  `);

  
  // Profiles: extend with avatar (URL) for Arena/website
  ensureColumn(db, "profiles", "avatar_url", "avatar_url TEXT");

// Arena matches: add newer columns for CS2 (and other games) matchmaking/launch info.
  ensureColumn(db, "arena_matches", "game", "game TEXT");
  ensureColumn(db, "arena_matches", "map", "map TEXT");
  ensureColumn(db, "arena_matches", "server", "server TEXT");
  ensureColumn(db, "arena_matches", "server_password", "server_password TEXT");
  ensureColumn(db, "arena_matches", "join_link", "join_link TEXT");
  ensureColumn(db, "arena_matches", "p1_ready", "p1_ready INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "arena_matches", "p2_ready", "p2_ready INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "arena_matches", "started_at", "started_at INTEGER");

  // Arena duels: add columns for ready-check, live state, server-verified results.
  ensureColumn(db, "arena_duels", "p1_ready", "p1_ready INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "arena_duels", "p2_ready", "p2_ready INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "arena_duels", "ready_deadline", "ready_deadline INTEGER");
  ensureColumn(db, "arena_duels", "live_state", "live_state TEXT");
  ensureColumn(db, "arena_duels", "match_token", "match_token TEXT");
  ensureColumn(db, "arena_duels", "result_source", "result_source TEXT");
  ensureColumn(db, "arena_duels", "cancel_reason", "cancel_reason TEXT");
  ensureColumn(db, "arena_duels", "team_size", "team_size INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "arena_duels", "winner_team", "winner_team INTEGER");


  // Transactions: Passimpay / providers support
  ensureColumn(db, "transactions", "provider", "provider TEXT");
  ensureColumn(db, "transactions", "provider_ref", "provider_ref TEXT");
  ensureColumn(db, "transactions", "order_id", "order_id TEXT");
  ensureColumn(db, "transactions", "updated_at", "updated_at INTEGER");
}

declare global {
  // eslint-disable-next-line no-var
  var __beavbet_db__: any | undefined;
}

export function getDb() {
  if (global.__beavbet_db__) return global.__beavbet_db__;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Очень полезно для проверки: в логах Render увидишь куда реально пишет база
  console.log("[DB] Using", DB_PATH);

  const db = new Database(DB_PATH);
  ensureSchema(db);

  // Game aggregator sessions (session_id -> user_id mapping for callbacks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ga_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  global.__beavbet_db__ = db;
  return db;
}

// Backwards-compatible exports used by some routes
export const initDb = getDb;

export function uuid() {
  return randomUUID();
}
