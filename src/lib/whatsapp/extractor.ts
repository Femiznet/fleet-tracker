// ===== EDIT ONLY THIS PART =====
export const SECRET = "GASTECH1234";
export const MIN_FIELDS = 3; // how many fields must match
export const MIN_LENGTH = 80; // minimum message length

export const NUM = "num"; // word then number:  pressure: 195
export const STR = "str"; // word then text:    standby skid: Nil
export const NUM_BEFORE = "numBefore"; // number then word:  130bar

type FieldType = typeof NUM | typeof STR | typeof NUM_BEFORE;

interface Field {
  name: string;
  type: FieldType;
  words: string[];
  exclude?: string[];
}

export const FIELDS: Field[] = [
  { name: "pressure", type: NUM, words: ["pressure"] },
  { name: "flow", type: NUM, words: ["flow rate", "flowrate", "flow"], exclude: ["total flow", "totalflow"] },
  { name: "total", type: NUM, words: ["total flow", "totalflow"] },
  { name: "skidUse", type: NUM, words: ["skid in use", "in use skid", "online skid"] },
  { name: "skidOther", type: STR, words: ["standby skid", "empty skid"] },
  { name: "bar", type: NUM_BEFORE, words: ["bar"] },
];
// ===== END OF EDIT PART =====

export const toPattern = (words: string[]): string =>
  words.map((w) => w.replace(/\s+/g, "\\s*")).join("|");

export const buildRegex = (field: Field): RegExp => {
  const alt = toPattern(field.words);
  const gap = "\\s*[:\\-]?\\s*\\(?";
  if (field.type === NUM) return new RegExp(`(${alt})${gap}\\d`, "i");
  if (field.type === STR) return new RegExp(`(${alt})${gap}[a-z]`, "i");
  return new RegExp(`\\d\\s*(${alt})`, "i");
};
