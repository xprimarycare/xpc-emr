-- CreateTable
CREATE TABLE "patient_tags" (
    "id" TEXT NOT NULL,
    "patientFhirId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_tags_patientFhirId_idx" ON "patient_tags"("patientFhirId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_tags_patientFhirId_category_value_key" ON "patient_tags"("patientFhirId", "category", "value");
