import { PhenoMLClient } from "phenoml";

if (!process.env.PHENOML_USERNAME) {
  throw new Error("Missing PHENOML_USERNAME environment variable");
}
if (!process.env.PHENOML_PASSWORD) {
  throw new Error("Missing PHENOML_PASSWORD environment variable");
}
if (!process.env.PHENOML_BASE_URL) {
  throw new Error("Missing PHENOML_BASE_URL environment variable");
}

export const phenomlClient = new PhenoMLClient({
  username: process.env.PHENOML_USERNAME,
  password: process.env.PHENOML_PASSWORD,
  baseUrl: process.env.PHENOML_BASE_URL,
});
