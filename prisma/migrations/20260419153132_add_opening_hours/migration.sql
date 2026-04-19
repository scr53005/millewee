-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_lb" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_week" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "mon" TEXT,
    "tue" TEXT,
    "wed" TEXT,
    "thu" TEXT,
    "fri" TEXT,
    "sat" TEXT,
    "sun" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standard_week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_schedule" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "resolved" JSONB NOT NULL,
    "source_standard_ids" INTEGER[],
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "current_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standard_week_service_id_created_at_idx" ON "standard_week"("service_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "current_schedule_date_key" ON "current_schedule"("date");

-- CreateIndex
CREATE INDEX "current_schedule_date_idx" ON "current_schedule"("date");

-- AddForeignKey
ALTER TABLE "standard_week" ADD CONSTRAINT "standard_week_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
