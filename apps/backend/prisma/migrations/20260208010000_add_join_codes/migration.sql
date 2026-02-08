-- AlterEnum (MemberRole: add EDITOR, VIEWER)
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'EDITOR';
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- Change default role from MEMBER to EDITOR
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'EDITOR'::"MemberRole";

-- AddColumn: Add editor_join_code to workspaces (nullable first for existing data)
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "editor_join_code" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "viewer_join_code" TEXT;

-- GenerateJoinCodes: Generate unique codes for existing workspaces
UPDATE "workspaces" SET "editor_join_code" = CONCAT('E', UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 7)));
UPDATE "workspaces" SET "viewer_join_code" = CONCAT('V', UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 7)));

-- MakeNotNull: Make join codes required
ALTER TABLE "workspaces" ALTER COLUMN "editor_join_code" SET NOT NULL;
ALTER TABLE "workspaces" ALTER COLUMN "viewer_join_code" SET NOT NULL;

-- CreateUniqueIndex: Create unique indexes for join codes
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_editor_join_code_key" ON "workspaces"("editor_join_code");
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_viewer_join_code_key" ON "workspaces"("viewer_join_code");

-- CreateTable: Create user_settings table
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

-- CreateUniqueIndex: Create unique index for user_id in user_settings
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey: Add foreign key from user_settings to users
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Create workspace_invite_links table
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

-- CreateUniqueIndex: Create unique index for token in workspace_invite_links
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invite_links_token_key" ON "workspace_invite_links"("token");

-- AddForeignKey: Add foreign key from workspace_invite_links to workspaces
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Add foreign key from workspace_invite_links to users
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
