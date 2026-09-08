import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "salon-payroll-tests-"));
const outputFile = path.join(tempDir, "payroll-tax.test.mjs");

try {
  await build({
    entryPoints: [path.join(artifactDir, "src/lib/payroll-tax.test.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outputFile,
    logLevel: "silent",
  });
  const result = spawnSync(process.execPath, ["--test", outputFile], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(tempDir, { recursive: true, force: true });
}