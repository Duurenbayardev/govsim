/** Монгол кирилл үсгийн цагаан толгой (их үсэг) — эхний үсэг сонгох */
export const MONGOLIAN_CYRILLIC_UPPER_LETTERS = [
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ё",
  "Ж",
  "З",
  "И",
  "Й",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "Ө",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ү",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Щ",
  "Ъ",
  "Ы",
  "Ь",
  "Э",
  "Ю",
  "Я",
] as const;

const LETTER_SET = new Set<string>(MONGOLIAN_CYRILLIC_UPPER_LETTERS);

/** Зөвшөөрөгдөх нэр — монгол кирилл, зай, зураас */
const NAME_PART_CHARS = /[а-яөүёА-ЯӨҮЁ\s-]/u;

/** Оруулсан текстээс зөвхөн зөвшөөрөгдөх тэмдэгт үлдээх */
export function filterMongolianNameInput(raw: string): string {
  return [...raw].filter((ch) => NAME_PART_CHARS.test(ch)).join("");
}

/**
 * Эхний үсгийг их, үлдсэнийг бага — зайг нэг болгож trim.
 */
export function capitalizeFirstLetterOnly(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  const first = collapsed[0].toLocaleUpperCase("mn-MN");
  const rest = collapsed.slice(1).toLocaleLowerCase("mn-MN");
  return first + rest;
}

/** capitalizeFirstLetterOnly-ийн дараах хэлбэр: эхний их, дараа нь бага + зай/зураас */
const NAME_PART_VALID =
  /^[А-ЯӨҮЁ](?:[а-яөүё]+(?:[-\s][а-яөүё]+)*)?$/u;

export function isValidNamePart(normalized: string): boolean {
  if (normalized.length < 1 || normalized.length > 80) return false;
  return NAME_PART_VALID.test(normalized);
}

export function isValidInitialLetter(ch: string): boolean {
  return ch.length === 1 && LETTER_SET.has(ch);
}

/** Нэр + эхний үсэг → Бүртгэлийн бүтэн нэр (жишээ нь Батмөнх.А) */
export function composeMemberFullName(namePart: string, letter: string): string {
  return `${namePart}.${letter}`;
}

function normalizeSessionCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

export function parseJoinPayload(body: {
  code?: unknown;
  fullName?: unknown;
  name?: unknown;
  letter?: unknown;
}): { code: string; fullName: string } | { error: string } {
  const code = normalizeSessionCode(String(body.code ?? ""));
  const legacy = String(body.fullName ?? "").trim();
  const nameRaw = String(body.name ?? "").trim();
  const letterRaw = String(body.letter ?? "").trim();

  if (nameRaw && letterRaw) {
    const namePart = capitalizeFirstLetterOnly(filterMongolianNameInput(nameRaw));
    const letter = letterRaw.toLocaleUpperCase("mn-MN");
    if (!isValidNamePart(namePart)) {
      return { error: "Нэрийг зөвхөн монгол кириллээр оруулна уу." };
    }
    if (!isValidInitialLetter(letter)) {
      return { error: "Эхний үсгээ цагаан толгооноос сонгоно уу." };
    }
    return { code, fullName: composeMemberFullName(namePart, letter) };
  }

  if (legacy) {
    const m = legacy.match(/^(.+)\.([А-ЯӨҮЁ])$/u);
    if (m) {
      const namePart = capitalizeFirstLetterOnly(filterMongolianNameInput(m[1]));
      const letter = m[2];
      if (isValidNamePart(namePart) && isValidInitialLetter(letter)) {
        return { code, fullName: composeMemberFullName(namePart, letter) };
      }
    }
    return { error: "Нэр болон эхний үсгээ оруулна уу." };
  }

  return { error: "Нэр болон эхний үсгээ оруулна уу." };
}
