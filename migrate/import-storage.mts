/**
 * Upload exported storage files to the TARGET Supabase project.
 * Creates buckets if missing, with the same public/private setting.
 *
 * Run with:
 *   TARGET_URL=https://pwjybjpsvojmrdbdmssq.supabase.co \
 *   TARGET_SERVICE_KEY=<service role key> \
 *   bun run import-storage.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const sb = createClient(process.env.TARGET_URL!, process.env.TARGET_SERVICE_KEY!);
const root = "./storage-export";

const buckets: Record<string, { public: boolean }> = {
  "task-attachments": { public: false },
  "kyc-documents": { public: false },
  "cv-uploads": { public: false },
  "payment-assets": { public: false },
  "payment-qr": { public: true },
};

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

for (const [name, cfg] of Object.entries(buckets)) {
  await sb.storage.createBucket(name, { public: cfg.public }).catch(() => {});
  const dir = join(root, name);
  try { statSync(dir); } catch { continue; }
  for (const file of walk(dir)) {
    const path = relative(dir, file).replace(/\\/g, "/");
    const buf = readFileSync(file);
    const { error } = await sb.storage.from(name).upload(path, buf, { upsert: true });
    if (error) console.error("✗", name, path, error.message);
    else console.log("✓", name, path);
  }
}
