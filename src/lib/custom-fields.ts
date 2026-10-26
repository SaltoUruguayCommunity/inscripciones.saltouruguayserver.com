export function fieldKey(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function uniqueFieldKey(label: string, used: string[]): string {
  const base = fieldKey(label);
  if (!base) return "";
  let name = base;
  for (let suffix = 2; used.includes(name); suffix++) name = base + "_" + suffix;
  return name;
}

export function validateCustomFields(fields: unknown): string | null {
  if (fields == null) return null;
  if (!Array.isArray(fields)) return "Los campos personalizados deben ser una lista";
  const names = new Set<string>();
  for (const field of fields) {
    if (!field || typeof field.name !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(field.name)) {
      return "Cada campo debe tener una key válida";
    }
    if (names.has(field.name)) return "Key duplicada: " + field.name;
    names.add(field.name);
  }
  return null;
}
