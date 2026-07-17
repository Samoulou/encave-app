/**
 * Guard against pointing destructive test tooling at a remote database.
 *
 * The previous check was a blocklist (`!url.includes('test') &&
 * !url.includes('localhost')`) — a cloud URL whose database name merely
 * contains "test" sailed through, and the local .env.test really did point
 * at Neon for a while. This is the strict inverse: an ALLOWLIST of hosts
 * that can only ever be a developer machine or a CI service container.
 *
 * Dependency-free on purpose: imported from Playwright global-setup (tsx),
 * seed scripts, and Vitest tests/db suites alike.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Throws unless `url` targets a local host. Never bypassed by CI: CI jobs
 * only ever use `localhost` service containers (see .github/workflows).
 */
export function assertLocalDbUrl(url: string, label = 'DATABASE_URL'): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(
      `${label} is not a parseable connection URL — refusing to run test tooling against it.`
    );
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      [
        `${label} points at "${host}", which is not a local database host.`,
        `Test setup wipes and reseeds the target database — running it against`,
        `a remote host (Neon, staging, prod) would destroy shared data.`,
        `Allowed hosts: ${[...LOCAL_HOSTS].join(', ')}.`,
        `Expected something like: postgresql://postgres:postgres@localhost:5433/encave_test`,
      ].join('\n')
    );
  }
}
