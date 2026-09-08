export function hasSensitiveIdentifierField(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return Object.keys(payload).some((key) => {
    const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
    return normalizedKey.startsWith('tin')
      || normalizedKey.startsWith('ssn')
      || normalizedKey.includes('socialsecurity')
      || normalizedKey.includes('taxpayeridentification')
      || normalizedKey.includes('employeridentification');
  });
}