import { PhenoMLClient } from "phenoml";

let _client: PhenoMLClient | null = null;

/**
 * Lazily initializes and returns the PhenoML client.
 * Only throws when actually called — not at module load time.
 */
export function getPhenomlClient(): PhenoMLClient {
  if (!_client) {
    const username = process.env.PHENOML_USERNAME;
    const password = process.env.PHENOML_PASSWORD;
    const baseUrl = process.env.PHENOML_BASE_URL;

    if (!username || !password || !baseUrl) {
      throw new Error(
        "PhenoML environment variables (PHENOML_USERNAME, PHENOML_PASSWORD, PHENOML_BASE_URL) are required when EMR_BACKEND=medplum"
      );
    }

    _client = new PhenoMLClient({ username, password, baseUrl });
  }
  return _client;
}

/**
 * Backward-compatible proxy — existing code that imports `phenomlClient`
 * continues to work without changes. The actual client is only created
 * when a property is first accessed (i.e., at request time, not module load).
 */
export const phenomlClient = new Proxy({} as PhenoMLClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPhenomlClient(), prop, receiver);
  },
});
