import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, "..");
const distRoot = path.join(mobileRoot, "dist");
const targetRoot = path.join(
  mobileRoot,
  "maui",
  "CortexTerminal.MobileShell",
  "Resources",
  "Raw",
  "wwwroot",
);

async function ensureSourceExists() {
  const entries = await readdir(distRoot);
  if (entries.length === 0) {
    throw new Error("mobile/dist is empty. Run npm run build first.");
  }
}

async function syncAssets() {
  const entries = await readdir(distRoot);
  if (entries.length === 0) {
    throw new Error("mobile/dist is empty. Run npm run build first.");
  }

  await mkdir(targetRoot, { recursive: true });
  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });

  for (const entry of entries) {
    await cp(path.join(distRoot, entry), path.join(targetRoot, entry), {
      recursive: true,
    });
  }

  console.log(`Synced Vite dist -> ${targetRoot}`);
}

await syncAssets();
