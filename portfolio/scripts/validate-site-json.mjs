/**
 * Validates workflow-selected site JSON shape after sync.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const RUNTIME_JSON = path.join(PUBLIC_DIR, "workflow.runtime.json");

function fail(msg) {
  console.error("validate-site-json:", msg);
  process.exit(1);
}

if (!fs.existsSync(RUNTIME_JSON)) {
  fail(`missing ${RUNTIME_JSON} — run: npm run sync`);
}

let runtime;
try {
  runtime = JSON.parse(fs.readFileSync(RUNTIME_JSON, "utf8"));
} catch (e) {
  fail(`invalid runtime JSON: ${e.message}`);
}
const siteFile =
  runtime && typeof runtime.site_json_file === "string" && runtime.site_json_file.trim()
    ? runtime.site_json_file.trim()
    : "";
if (!siteFile) {
  fail('expected non-empty string "site_json_file" in workflow.runtime.json');
}
const chatbotFile =
  runtime && typeof runtime.chatbot_index_file === "string" && runtime.chatbot_index_file.trim()
    ? runtime.chatbot_index_file.trim()
    : "";
if (!chatbotFile) {
  fail('expected non-empty string "chatbot_index_file" in workflow.runtime.json');
}
const SITE_JSON = path.join(PUBLIC_DIR, siteFile);
if (!fs.existsSync(SITE_JSON)) {
  fail(`missing ${SITE_JSON} — run: npm run sync`);
}
const CHATBOT_JSON = path.join(PUBLIC_DIR, chatbotFile);
if (!fs.existsSync(CHATBOT_JSON)) {
  fail(`missing ${CHATBOT_JSON} — run: npm run sync`);
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
