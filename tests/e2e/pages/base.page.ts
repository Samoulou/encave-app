import { Page, Locator } from '@playwright/test';

const DEFAULT_E2E_LOCALE = 'en';

/**
 * Base Page Object class with common functionality
 * All page objects should extend this class
 */
export abstract class BasePage {
  readonly page: Page;
  readonly locale: string;

  constructor(
    page: Page,
    locale = process.env.E2E_LOCALE ?? DEFAULT_E2E_LOCALE
  ) {
    this.page = page;
    this.locale = locale;
  }

  localizedPath(path: string): string {
    if (/^https?:\/\//.test(path)) {
      return path;
    }

    if (/^\/(fr|de|en)(\/|$)/.test(path)) {
      return path;
    }

    return `/${this.locale}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * Navigate to a URL and wait for network to be idle
   */
  async goto(path: string, options?: { waitForSelector?: string }) {
    await this.page.goto(this.localizedPath(path));
    await this.page.waitForLoadState('networkidle');

    if (options?.waitForSelector) {
      await this.page.waitForSelector(options.waitForSelector);
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern: string | RegExp) {
    await this.page.waitForURL(urlPattern);
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Get URL search params
   */
  getUrlParams(): URLSearchParams {
    const url = new URL(this.page.url());
    return url.searchParams;
  }

  /**
   * Check if element is visible
   */
  async isVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(locator: Locator, timeout?: number) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(locator: Locator, timeout?: number) {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Get text content of an element, trimmed
   */
  async getText(locator: Locator): Promise<string> {
    const text = await locator.textContent();
    return text?.trim() ?? '';
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp) {
    return this.page.waitForResponse(urlPattern);
  }
}
