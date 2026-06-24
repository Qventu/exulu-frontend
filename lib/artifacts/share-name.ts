export const slugifyShareName = (input: string): string => {
  const base = input.split("/").pop() ?? input;
  const human = base.split("_EXULU_").pop() ?? base;
  return human
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
