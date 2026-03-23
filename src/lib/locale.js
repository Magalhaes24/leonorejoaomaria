export const pickLocale = (field, lang) => {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.pt || field.en || "";
};
