-- CreateEnum
CREATE TYPE "LoyaltyRewardMode" AS ENUM ('CUMULATIVE', 'INDEPENDENT');

-- AlterTable: add rewardMode to loyalty_programs
ALTER TABLE "loyalty_programs" ADD COLUMN "rewardMode" "LoyaltyRewardMode" NOT NULL DEFAULT 'CUMULATIVE';

-- AlterTable: add availableRewardIds to loyalty_cards
ALTER TABLE "loyalty_cards" ADD COLUMN "availableRewardIds" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: loyalty_rewards (milestones del programa, max 4)
CREATE TABLE "loyalty_rewards" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "stampsRequired" INTEGER NOT NULL,
    "rewardType" "LoyaltyRewardType" NOT NULL,
    "rewardValue" DECIMAL(10,2),
    "rewardLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rewards_programId_position_key" ON "loyalty_rewards"("programId", "position");

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_programId_fkey" FOREIGN KEY ("programId") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: migrar reward existente de cada programa a loyalty_rewards position=1
INSERT INTO "loyalty_rewards" ("id", "programId", "position", "stampsRequired", "rewardType", "rewardValue", "rewardLabel")
SELECT
    gen_random_uuid()::text,
    "id",
    1,
    "stampsRequired",
    "rewardType",
    "rewardValue",
    "rewardLabel"
FROM "loyalty_programs";

-- DataMigration: poblar availableRewardIds en cards que tienen rewards pendientes
-- Para cada card con rewardsAvailable > 0, repetimos el rewardId N veces
UPDATE "loyalty_cards" c
SET "availableRewardIds" = (
    SELECT jsonb_agg(r."id")
    FROM generate_series(1, c."rewardsAvailable") AS s
    CROSS JOIN "loyalty_rewards" r
    WHERE r."programId" = c."programId" AND r."position" = 1
)
WHERE c."rewardsAvailable" > 0;
