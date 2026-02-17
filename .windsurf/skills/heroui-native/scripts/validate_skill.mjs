#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as runListComponents } from "./list_components.mjs";
import { run as runGetComponentDocs } from "./get_component_docs.mjs";
import { run as runGetDocs } from "./get_docs.mjs";
import { run as runGetTheme } from "./get_theme.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");

function createCaptureRuntime() {
  const stdout = [];
  const stderr = [];
  return {
    runtime: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout,
    stderr,
  };
}

async function mustExist(relPath) {
  const filePath = path.join(SKILL_ROOT, relPath);
  await access(filePath, constants.F_OK);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error("SKILL.md frontmatter not found");
  }
  const lines = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const map = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    map.set(key, value);
  }
  return map;
}

async function validateSkillFrontmatter() {
  const skillPath = path.join(SKILL_ROOT, "SKILL.md");
  const content = await readFile(skillPath, "utf8");
  const frontmatter = parseFrontmatter(content);
  const keys = [...frontmatter.keys()].sort();
  const allowed = ["description", "name"];
  if (JSON.stringify(keys) !== JSON.stringify(allowed)) {
    throw new Error(`SKILL.md frontmatter keys must be exactly: ${allowed.join(", ")}`);
  }
  if (!frontmatter.get("name")?.includes("heroui-native")) {
    throw new Error("SKILL.md `name` must be `heroui-native`");
  }
  if (!frontmatter.get("description")) {
    throw new Error("SKILL.md `description` is required");
  }
}

async function validateOpenAiYaml() {
  const yamlPath = path.join(SKILL_ROOT, "agents", "openai.yaml");
  const content = await readFile(yamlPath, "utf8");
  const requiredKeys = [
    "interface:",
    "display_name:",
    "short_description:",
    "default_prompt:",
    "policy:",
    "allow_implicit_invocation:",
  ];
  for (const key of requiredKeys) {
    if (!content.includes(key)) {
      throw new Error(`agents/openai.yaml missing key: ${key}`);
    }
  }
  if (!content.includes("$heroui-native")) {
    throw new Error("agents/openai.yaml default_prompt must mention $heroui-native");
  }
}

async function validateHelpCommands() {
  const checks = [
    { name: "list_components", fn: runListComponents },
    { name: "get_component_docs", fn: runGetComponentDocs },
    { name: "get_docs", fn: runGetDocs },
    { name: "get_theme", fn: runGetTheme },
  ];
  for (const check of checks) {
    const capture = createCaptureRuntime();
    const code = await check.fn(["--help"], capture.runtime);
    if (code !== 0) {
      throw new Error(`${check.name} --help returned ${code}`);
    }
    const stderrText = capture.stderr.join("");
    if (!stderrText.includes("Usage:")) {
      throw new Error(`${check.name} --help did not print usage`);
    }
  }
}

async function main() {
  try {
    await mustExist("SKILL.md");
    await mustExist("agents/openai.yaml");
    await mustExist("scripts/list_components.mjs");
    await mustExist("scripts/get_component_docs.mjs");
    await mustExist("scripts/get_docs.mjs");
    await mustExist("scripts/get_theme.mjs");
    await validateSkillFrontmatter();
    await validateOpenAiYaml();
    await validateHelpCommands();
    process.stdout.write("Skill validation passed.\n");
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Skill validation failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();
