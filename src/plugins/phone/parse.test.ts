import * as assert from "node:assert";
import { test } from "node:test";
import { parseTelephonyDebugDateTime } from "./parse";

test("#parseTelephonyDebugDateTime", () => {
  const actual = parseTelephonyDebugDateTime("March 4, 2023 at 12:03 AM");
  assert.ok(actual);
  assert.equal(actual.getUTCMonth(), 2);
  assert.equal(actual.getUTCDate(), 4);
  assert.equal(actual.getUTCFullYear(), 2023);
});
