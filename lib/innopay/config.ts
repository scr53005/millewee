/**
 * Environment configuration based on window.location
 * PROD: https://millewee.innopay.lu
 * DEV: any other location (localhost, private IPs, Vercel previews, etc.)
 *
 * Adapted from croque-bedaine/src/lib/environment.ts for Next.js
 */

export type Environment = 'PROD' | 'DEV';

export interface EnvironmentConfig {
  environment: Environment;
  /** Hive account to receive payments */
  to_account: string;
  /** Innopay wallet URL */
  innopayUrl: string;
}

const PROD_HOST = 'millewee.innopay.lu';

/**
 * Helper to detect if hostname is a private/local IP
 * Exported for use in other modules that need network detection
 */
export function isPrivateNetwork(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }
  // Private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
    return true;
  }
  return false;
}

export function getEnvironment(): Environment {
  if (typeof window === 'undefined') return 'DEV';

  // Check for explicit override first
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'PROD') return 'PROD';
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'DEV') return 'DEV';

  return window.location.host === PROD_HOST ? 'PROD' : 'DEV';
}

export function getEnvironmentConfig(): EnvironmentConfig {
  if (typeof window === 'undefined') {
    return {
      environment: 'DEV',
      to_account: 'innodemo',
      innopayUrl: 'http://localhost:3000',
    };
  }

  // Check for explicit overrides
  const explicitInnopayUrl = process.env.NEXT_PUBLIC_INNOPAY_URL;
  const explicitHiveAccount = process.env.NEXT_PUBLIC_HIVE_ACCOUNT;

  const environment = getEnvironment();
  const hostname = window.location.hostname;

  if (environment === 'PROD') {
    return {
      environment: 'PROD',
      to_account: explicitHiveAccount || 'millewee',
      innopayUrl: explicitInnopayUrl || 'https://wallet.innopay.lu',
    };
  }

  // DEV environment - determine innopayUrl based on network
  let innopayUrl = 'https://wallet.innopay.lu'; // fallback

  if (isPrivateNetwork(hostname)) {
    // Use the same host — hub runs on port 3000 on the same machine as the spoke.
    // Override with NEXT_PUBLIC_INNOPAY_URL in .env.local for cross-machine setups
    innopayUrl = `http://${hostname}:3000`;
  } else if (hostname.includes('vercel.app') && !hostname.includes('millewee')) {
    innopayUrl = 'https://wallet.innopay.lu';
  }

  return {
    environment: 'DEV',
    to_account: explicitHiveAccount || 'innodemo',
    innopayUrl: explicitInnopayUrl || innopayUrl,
  };
}

// Convenience exports
export function getInnopayUrl(): string {
  return getEnvironmentConfig().innopayUrl;
}

export function getHiveAccount(): string {
  return getEnvironmentConfig().to_account;
}

/**
 * Check if running in dev environment (for bypassing kitchen hours, etc.)
 */
export function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  return isPrivateNetwork(window.location.hostname) || window.location.hostname.includes('vercel.app');
}
