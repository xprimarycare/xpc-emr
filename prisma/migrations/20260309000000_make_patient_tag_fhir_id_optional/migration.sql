-- AlterTable: make patientFhirId optional
ALTER TABLE "patient_tags" ALTER COLUMN "patientFhirId" DROP NOT NULL;

-- Data fix: convert empty strings to NULL
UPDATE "patient_tags" SET "patientFhirId" = NULL WHERE "patientFhirId" = '';
