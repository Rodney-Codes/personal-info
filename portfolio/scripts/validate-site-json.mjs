/**
 * Validates portfolio/public/site.json shape after sync (CI / local smoke check).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_JSON = path.join(__dirname, "..", "public", "site.json");

function fail(msg) {
  console.error("validate-site-json:", msg);
  process.exit(1);
}

if (!fs.existsSync(SITE_JSON)) {
  fail(`missing ${SITE_JSON} — run: npm run sync`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(SITE_JSON, "utf8"));
} catch (e) {
  fail(`invalid JSON: ${e.message}`);
}

if (typeof data.name !== "string" || !data.name.trim()) {
  fail('expected non-empty string "name"');
}
if (!data.ui || typeof data.ui !== "object") {
  fail('expected object "ui"');
}
if (
  typeof data.ui.heroTagline !== "string" ||
  !data.ui.heroTagline.trim()
) {
  fail('expected non-empty string "ui.heroTagline"');
}
if (!Array.isArray(data.experience)) {
  fail('expected array "experience"');
}
if (!data.contact || typeof data.contact !== "object") {
  fail('expected object "contact"');
}
if (!data.meta || typeof data.meta.title !== "string") {
  fail('expected object "meta" with string title');
}

console.log("validate-site-json: OK", SITE_JSON);
