const uuidRegex = /^[\da-fA-F]{8}-[\da-fA-F]{4}-4[\da-fA-F]{3}-[89abAB][\da-fA-F]{3}-[\da-fA-F]{12}$/;

/**
 * Check if passed string is valid UUID v4.
 */
export function isValidUuidString(uuid: string): boolean {
  return uuidRegex.test(uuid);
}
