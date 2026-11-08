import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_PATTERN } from "./patterns.ts";
import { isHexColor, parseHexColorDraft, parseTemplate } from "./template.ts";
import type { ScheduleTemplate } from "./template.ts";

// Loads a hand-built v7 export from lib/fixtures as plain JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at arbitrary fields
function loadFixture(name: string): Record<string, any> {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

// Parses and fails the test if the template is rejected, so callers get a typed template.
function parseOk(value: unknown): ScheduleTemplate {
  const result = parseTemplate(value);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.template;
}

test("v7 with dots migrates to the default dots pattern", () => {
  const fixture = loadFixture("template-v7.json");
  const template = parseOk(fixture);
  assert.equal(template.version, 8);
  assert.deepEqual(template.appearance.pattern, DEFAULT_PATTERN);
  assert.ok(!("showDots" in template.appearance));
});

test("v7 without dots migrates to pattern none", () => {
  const template = parseOk(loadFixture("template-v7-nodots.json"));
  assert.deepEqual(template.appearance.pattern, { ...DEFAULT_PATTERN, type: "none" });
});

test("migration keeps every other field unchanged", () => {
  for (const name of ["template-v7.json", "template-v7-nodots.json"]) {
    const fixture = loadFixture(name);
    const template = parseOk(fixture);
    // version and appearance.pattern are the only fields allowed to differ; blank them out.
    const expected = { ...fixture, version: 0, appearance: {} };
    const actual = { ...template, version: 0, appearance: {} };
    assert.deepEqual(actual, expected, name);
    assert.deepEqual(template.appearance.theme, fixture.appearance.theme, name);
  }
});

test("a v8 template survives a JSON round trip unchanged", () => {
  const template = parseOk(loadFixture("template-v7.json"));
  assert.deepEqual(parseOk(JSON.parse(JSON.stringify(template))), template);
});

test("unknown versions are rejected with the supported-versions message", () => {
  for (const version of [6, 9, "8", undefined]) {
    const result = parseTemplate({ version });
    assert.equal(result.ok, false);
    assert.equal(
      !result.ok && result.error,
      "Unsupported template version. This editor supports versions 7 and 8.",
    );
  }
});

test("a v8 template with an unknown pattern type is rejected", () => {
  const template = parseOk(loadFixture("template-v7.json"));
  const bad = { ...template, appearance: { ...template.appearance, pattern: { ...DEFAULT_PATTERN, type: "retro" } } };
  assert.equal(parseTemplate(bad).ok, false);
});

test("a v8 template without a pattern is rejected", () => {
  const template = parseOk(loadFixture("template-v7.json"));
  const bad = { ...template, appearance: { theme: template.appearance.theme } };
  assert.equal(parseTemplate(bad).ok, false);
});

test("a v7 template with a non-boolean showDots is rejected", () => {
  const fixture = loadFixture("template-v7.json");
  fixture.appearance.showDots = "yes";
  assert.equal(parseTemplate(fixture).ok, false);
});

test("duplicate sticker ids are rejected", () => {
  const fixture = loadFixture("template-v7.json");
  fixture.stickers.push({ ...fixture.stickers[0] });
  const result = parseTemplate(fixture);
  assert.equal(result.ok, false);
  assert.equal(
    !result.ok && result.error,
    "The file is missing required information or contains invalid values.",
  );
});

test("null and arrays are rejected as invalid structure", () => {
  for (const value of [null, [], "text", 7]) {
    const result = parseTemplate(value);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error, "The template has an invalid structure.");
  }
});

test("isHexColor only accepts # plus six hex digits", () => {
  assert.equal(isHexColor("#0e7490"), true);
  assert.equal(isHexColor("#FFFFFF"), true);
  assert.equal(isHexColor("#0"), false);
  assert.equal(isHexColor("#fff"), false);
  assert.equal(isHexColor("0e7490"), false);
  assert.equal(isHexColor("#0e749g"), false);
  assert.equal(isHexColor(undefined), false);
});

test("parseHexColorDraft returns null for a half-typed colour", () => {
  assert.equal(parseHexColorDraft(""), null);
  assert.equal(parseHexColorDraft("#"), null);
  assert.equal(parseHexColorDraft("#0"), null);
  assert.equal(parseHexColorDraft("#12345"), null);
  assert.equal(parseHexColorDraft("#1234567"), null);
  assert.equal(parseHexColorDraft("#zzzzzz"), null);
});

test("parseHexColorDraft normalises a complete colour", () => {
  assert.equal(parseHexColorDraft("#0E7490"), "#0e7490");
  assert.equal(parseHexColorDraft("  #abcdef "), "#abcdef");
  // A missing "#" is added, so pasting "ff0000" works.
  assert.equal(parseHexColorDraft("ff0000"), "#ff0000");
});
