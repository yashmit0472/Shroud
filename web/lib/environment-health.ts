type Key = { environment_id: string; key: string; is_required: boolean };

export function environmentHealth(environmentIds: string[], secrets: Key[], requiredKeys: string[] = []) {
  const allKeys = new Set(secrets.map((secret) => secret.key));
  const required = new Set([...requiredKeys, ...secrets.filter((secret) => secret.is_required).map((secret) => secret.key)]);
  return environmentIds.map((id) => {
    const present = new Set(secrets.filter((secret) => secret.environment_id === id).map((secret) => secret.key));
    return {
      id,
      missingRequired: [...required].filter((key) => !present.has(key)).sort(),
      missingOptional: [...allKeys].filter((key) => !required.has(key) && !present.has(key)).sort(),
    };
  });
}
