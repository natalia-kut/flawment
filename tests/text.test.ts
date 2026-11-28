import test from "node:test";
import assert from "node:assert/strict";
import { cleanLine, hasLetterOrDigit, isSingleEmoji } from "../lib/text";

const at = (code: number) => String.fromCodePoint(code);

test("cleanLine drops invisible characters and composes accents one way", () => {
  assert.equal(cleanLine("team-" + at(0x200b) + "Alfa"), "team-Alfa");
  assert.equal(cleanLine(at(0x200b)), "");
  assert.equal(cleanLine("  a \t b\r\nc  "), "a b c");
  assert.equal(cleanLine("she" + at(0x202e) + "/her"), "she/her");
  assert.equal(cleanLine("x" + at(0) + "y"), "xy");
  // "B" + "e" + combining acute (NFD) is the same name as precomposed "B" + e-acute.
  assert.equal(cleanLine("team-Be" + at(0x301) + "ta"), cleanLine("team-B" + at(0xe9) + "ta"));
  // A joiner inside an emoji sequence is part of it; elsewhere it goes.
  const technologist = at(0x1f469) + at(0x200d) + at(0x1f4bb);
  assert.equal(cleanLine(technologist), technologist);
  assert.equal(cleanLine("a" + at(0x200d) + "b"), "ab");
});

test("names need a letter or digit; an emoji must be one emoji", () => {
  assert.equal(hasLetterOrDigit(at(0x141) + at(0xf3) + "d" + at(0x17a)), true);
  assert.equal(hasLetterOrDigit("--"), false);
  for (const emoji of [at(0x1f3af), at(0x2708) + at(0xfe0f), "1" + at(0xfe0f) + at(0x20e3), at(0x1f1f5) + at(0x1f1f1), at(0x1f469) + at(0x200d) + at(0x1f4bb)]) {
    assert.equal(isSingleEmoji(emoji), true, emoji);
  }
  for (const value of ["A", "<", at(0x1f3af) + at(0x1f3af)]) assert.equal(isSingleEmoji(value), false, value);
});
