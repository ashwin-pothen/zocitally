const DOI_PREFIXES = [
  /^doi\s*:\s*/iu,
  /^https?:\/\/(?:dx\.)?doi\.org\//iu,
];

const TRAILING_PUNCTUATION = /[\s.,;:]+$/u;
const DOI_PATTERN = /^10\.\d{4,9}\/[\p{L}\p{N}._;()/:+-]+$/iu;

export function normalizeDOI(value: string | null | undefined): string | null {
  if (!value) return null;
  let doi = value.trim();
  for (const prefix of DOI_PREFIXES) {
    doi = doi.replace(prefix, "");
  }

  doi = doi.trim();
  if ((doi.startsWith("<") && doi.endsWith(">")) ||
      (doi.startsWith("[") && doi.endsWith("]")) ||
      (doi.startsWith("{") && doi.endsWith("}"))) {
    doi = doi.slice(1, -1).trim();
  }
  doi = doi.replace(TRAILING_PUNCTUATION, "").trim();

  // Remove only unmatched closing punctuation; balanced parentheses are valid DOI characters.
  while (doi.endsWith(")") && count(doi, "(") < count(doi, ")")) doi = doi.slice(0, -1);
  while (doi.endsWith("]") || doi.endsWith("}")) doi = doi.slice(0, -1).trimEnd();

  const normalized = doi.toLowerCase();
  return isValidDOI(normalized) ? normalized : null;
}

export function isValidDOI(value: string): boolean {
  if (value.length < 7 || value.length > 255 || /\s/u.test(value)) return false;
  return DOI_PATTERN.test(value);
}

function count(value: string, character: string): number {
  return [...value].filter((current) => current === character).length;
}
