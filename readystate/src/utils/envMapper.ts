/**
 * Utility to normalize environment names.
 * This resolves issues where abbreviations like 'prod' are used instead of 'production'.
 */

export function normalizeEnvironment(env: string): string {
  if (!env) return env;

  const envString = env.trim().toLowerCase();

  // Default aliases
  const aliases: Record<string, string> = {
    prod: 'production',
    prd: 'production',
    stg: 'staging',
    dev: 'development'
  };

  // Override with environment variable if present
  // Expected format: ENV_ALIASES="prod=production,stg=staging,pre=preprod"
  if (process.env.ENV_ALIASES) {
    const customAliases = process.env.ENV_ALIASES.split(',');
    for (const mapping of customAliases) {
      const parts = mapping.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts[1].trim().toLowerCase();
        if (key && value) {
          aliases[key] = value;
        }
      }
    }
  }

  return aliases[envString] || envString;
}
