-- AlterTable
ALTER TABLE "user_patients" ADD COLUMN     "assignedBy" TEXT,
ADD COLUMN     "encounterFhirId" TEXT,
ADD COLUMN     "includeNoteText" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceEncounterFhirId" TEXT,
ADD COLUMN     "sourcePatientFhirId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'waiting_room';
