// Control characters (NUL, tabs, line breaks) and invisible format characters: zero-width
// spaces, joiners, bidi overrides that reverse the text after them, soft hyphens, BOM.
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;
// A zero-width joiner stays only inside an emoji sequence (a woman technologist, a family), where it is part of the picture.
const EMOJI_JOINER = /(?<=\p{Extended_Pictographic}\uFE0F?)\u200D(?=\p{Extended_Pictographic})/gu;
const KEEP = "\uE000";

/**
 * One line of text as a person means it: composed the same way however it was typed
 * (NFC, so "é" typed two ways is one name), with nothing invisible in it, and spaces
 * collapsed. "" when nothing visible is left, so a required field can refuse it.
 */
export function cleanLine(raw: string) {
  return raw.normalize("NFC").replaceAll(KEEP, "")
    .replace(EMOJI_JOINER, KEEP)
    .replace(INVISIBLE, (char) => /\s/.test(char) ? " " : "")
    .replaceAll(KEEP, "\u200D")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether a name has something to read: at least one letter or digit in any script. */
export function hasLetterOrDigit(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

/** A single emoji, flags, keycaps, skin tones and joined sequences included; not a letter or a symbol like "<". */
export function isSingleEmoji(value: string) {
  return [...new Intl.Segmenter().segment(value)].length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value);
}
