/**
 * Resolves a service URL dynamically. If the configured URL points to localhost
 * but the user is accessing the application from a different domain or IP address (e.g. EC2),
 * it dynamically updates the host to point to the actual browser domain/IP.
 */
export function resolveServiceUrl(envUrl: string, defaultFallback: string): string {
  const url = envUrl || defaultFallback;
  if (typeof window !== 'undefined' && url.includes('localhost') && window.location.hostname !== 'localhost') {
    return url.replace('localhost', window.location.hostname);
  }
  return url;
}
