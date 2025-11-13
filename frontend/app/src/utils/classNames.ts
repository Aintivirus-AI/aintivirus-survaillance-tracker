export type ClassValue = string | false | null | undefined;

export const classNames = (...values: ClassValue[]) =>
  values.filter(Boolean).join(' ');


