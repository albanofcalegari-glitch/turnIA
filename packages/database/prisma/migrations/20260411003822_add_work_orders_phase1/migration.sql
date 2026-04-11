-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('MINUTES', 'HOURS', 'WORKDAYS');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkSlotStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "allowsMultiDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "durationUnit" "DurationUnit" NOT NULL DEFAULT 'MINUTES',
ADD COLUMN     "durationValue" DECIMAL(6,1) NOT NULL DEFAULT 0,
ADD COLUMN     "maxProfessionals" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "minProfessionals" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workdayHours" DECIMAL(4,1);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "defaultWorkdayHours" DECIMAL(4,1) NOT NULL DEFAULT 8.0;

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_slots" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkSlotStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "workSlotId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_orders_tenantId_status_idx" ON "work_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_scheduledStartAt_idx" ON "work_orders"("tenantId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "work_orders_tenantId_branchId_scheduledStartAt_idx" ON "work_orders"("tenantId", "branchId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "work_slots_workOrderId_idx" ON "work_slots"("workOrderId");

-- CreateIndex
CREATE INDEX "work_slots_startAt_endAt_idx" ON "work_slots"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "staff_assignments_professionalId_idx" ON "staff_assignments"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignments_workSlotId_professionalId_key" ON "staff_assignments"("workSlotId", "professionalId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_slots" ADD CONSTRAINT "work_slots_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_workSlotId_fkey" FOREIGN KEY ("workSlotId") REFERENCES "work_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
