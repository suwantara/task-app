-- AlterEnum (MemberRole: add EDITOR, VIEWER)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EDITOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'MemberRole')) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'EDITOR';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VIEWER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'MemberRole')) THEN
        ALTER TYPE "MemberRole" ADD VALUE 'VIEWER';
    END IF;
END $$;

-- Change default role from MEMBER to EDITOR (only if column exists with MEMBER default)
DO $$ BEGIN
    ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'EDITOR'::"MemberRole";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- AddColumn: Add editor_join_code to workspaces (nullable first for existing data)
DO $$ BEGIN
    ALTER TABLE "workspaces" ADD COLUMN "editor_join_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "workspaces" ADD COLUMN "viewer_join_code" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- GenerateJoinCodes: Generate unique codes for existing workspaces that don't have them
UPDATE "workspaces" SET "editor_join_code" = CONCAT('E', UPPER(SUBSTRING(md5(random()::text || id) FROM 1 FOR 7))) WHERE "editor_join_code" IS NULL;
UPDATE "workspaces" SET "viewer_join_code" = CONCAT('V', UPPER(SUBSTRING(md5(random()::text || id) FROM 1 FOR 7))) WHERE "viewer_join_code" IS NULL;

-- MakeNotNull: Make join codes required (only if they have values)
DO $$ BEGIN
    ALTER TABLE "workspaces" ALTER COLUMN "editor_join_code" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "workspaces" ALTER COLUMN "viewer_join_code" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- CreateUniqueIndex: Create unique indexes for join codes
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_editor_join_code_key" ON "workspaces"("editor_join_code");
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_viewer_join_code_key" ON "workspaces"("viewer_join_code");

-- ==== user_settings table (skip if exists) ====
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "realtime_notifications" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey only if not exists
DO $$ BEGIN
    ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==== workspace_invite_links table (skip if exists) ====
CREATE TABLE IF NOT EXISTS "workspace_invite_links" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'EDITOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_invite_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invite_links_token_key" ON "workspace_invite_links"("token");

-- AddForeignKey only if not exists
DO $$ BEGIN
    ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
