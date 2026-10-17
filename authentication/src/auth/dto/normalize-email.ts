/** `class-transformer` step for email fields: surrounding spaces and capitals never make a different account. */
export function normalizeEmailInput({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
