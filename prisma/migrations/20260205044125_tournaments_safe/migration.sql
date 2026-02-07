-- Safe tournaments migration: avoids failing if enums/table already exist

DO $$
BEGIN
  CREATE TYPE "TournamentType" AS ENUM ('DAILY_SPRINT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TournamentStatus" AS ENUM ('ACTIVE','COMPLETED','UPCOMING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Main tournament table (matches existing production shape)
CREATE TABLE IF NOT EXISTS "Tournament" (
  "id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "type" "TournamentType" NOT NULL,
  "status" "TournamentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" timestamp(3) without time zone NOT NULL,
  "endsAt" timestamp(3) without time zone NOT NULL,
  "kFactor" integer NOT NULL DEFAULT 10,
  "prizePoolCents" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_slug_key" ON "Tournament"("slug");
CREATE INDEX IF NOT EXISTS "Tournament_status_endsAt_idx" ON "Tournament"("status","endsAt");

-- Entry table
CREATE TABLE IF NOT EXISTS "TournamentEntry" (
  "id" text NOT NULL,
  "tournamentId" text NOT NULL,
  "userId" text NOT NULL,
  "points" double precision NOT NULL DEFAULT 0,
  "bestMultiplier" double precision NOT NULL DEFAULT 1,
  "roundsCount" integer NOT NULL DEFAULT 0,
  "lastRoundAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "TournamentEntry"
    ADD CONSTRAINT "TournamentEntry_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TournamentEntry"
    ADD CONSTRAINT "TournamentEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentEntry_tournamentId_userId_key" ON "TournamentEntry"("tournamentId","userId");
CREATE INDEX IF NOT EXISTS "TournamentEntry_tournamentId_points_idx" ON "TournamentEntry"("tournamentId","points");
CREATE INDEX IF NOT EXISTS "TournamentEntry_userId_updatedAt_idx" ON "TournamentEntry"("userId","updatedAt");

-- Round table
CREATE TABLE IF NOT EXISTS "TournamentRound" (
  "id" text NOT NULL,
  "tournamentId" text NOT NULL,
  "userId" text NOT NULL,
  "roundId" text NOT NULL,
  "stakeCents" integer NOT NULL,
  "multiplier" double precision NOT NULL,
  "points" double precision NOT NULL,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "TournamentRound"
    ADD CONSTRAINT "TournamentRound_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TournamentRound"
    ADD CONSTRAINT "TournamentRound_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentRound_tournamentId_userId_roundId_key" ON "TournamentRound"("tournamentId","userId","roundId");
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentRound_tournamentId_roundId_key" ON "TournamentRound"("tournamentId","roundId");
CREATE INDEX IF NOT EXISTS "TournamentRound_tournamentId_createdAt_idx" ON "TournamentRound"("tournamentId","createdAt");
CREATE INDEX IF NOT EXISTS "TournamentRound_userId_createdAt_idx" ON "TournamentRound"("userId","createdAt");
