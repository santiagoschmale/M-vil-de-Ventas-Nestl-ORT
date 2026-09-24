export const splitOrDefault = (str: FormDataEntryValue | null): string[] =>
  str?.toString().split(',') || [];

export const formGetOrEmpty = (str: FormDataEntryValue | null): string => str?.toString() || '';
