import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Experience type enum matching the application
 */
export type ExperienceType =
  | 'TASTING'
  | 'CELLAR_VISIT'
  | 'WORKSHOP'
  | 'VINEYARD_TOUR'
  | 'FOOD_PAIRING';

/**
 * Sort options for search results
 */
export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

/**
 * Page Object for the Experience Search page
 * Route: /experiences
 */
export class SearchPage extends BasePage {
  // Search input
  readonly searchInput: Locator;

  // Filter controls
  readonly typeFilters: Record<ExperienceType, Locator>;
  readonly communeSelect: Locator;
  readonly minPriceInput: Locator;
  readonly maxPriceInput: Locator;
  readonly clearFiltersButton: Locator;

  // Results
  readonly sortSelect: Locator;
  readonly resultsGrid: Locator;
  readonly experienceCards: Locator;
  readonly resultsCount: Locator;
  readonly emptyState: Locator;

  // Pagination
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;

  // Loading states
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    // Search
    this.searchInput = page.getByPlaceholder(/search experiences/i);

    // Type filters - checkboxes for each experience type
    this.typeFilters = {
      TASTING: page.getByLabel(/tasting/i),
      CELLAR_VISIT: page.getByLabel(/cellar visit/i),
      WORKSHOP: page.getByLabel(/workshop/i),
      VINEYARD_TOUR: page.getByLabel(/vineyard tour/i),
      FOOD_PAIRING: page.getByLabel(/food pairing/i),
    };

    // Other filters
    this.communeSelect = page.getByLabel(/location|commune/i);
    this.minPriceInput = page.getByLabel(/min.*price/i);
    this.maxPriceInput = page.getByLabel(/max.*price/i);
    this.clearFiltersButton = page.getByRole('button', { name: /clear/i });

    // Results display
    this.sortSelect = page.getByLabel(/sort/i);
    this.resultsGrid = page.getByTestId('search-results-grid');
    this.experienceCards = page.getByTestId('experience-card');
    this.resultsCount = page.getByTestId('results-count');
    this.emptyState = page.getByTestId('empty-state');

    // Pagination
    this.pagination = page.getByRole('navigation', { name: /pagination/i });
    this.prevPageButton = page.getByRole('button', { name: /previous/i });
    this.nextPageButton = page.getByRole('button', { name: /next/i });

    // Loading
    this.loadingSpinner = page.getByTestId('loading-spinner');
  }

  /**
   * Navigate to the search page
   */
  async navigate() {
    await this.goto('/experiences');
  }

  /**
   * Navigate with pre-set filters via URL
   */
  async navigateWithFilters(params: {
    q?: string;
    type?: ExperienceType | ExperienceType[];
    commune?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: SortOption;
    page?: number;
  }) {
    const searchParams = new URLSearchParams();

    if (params.q) searchParams.set('q', params.q);
    if (params.type) {
      const types = Array.isArray(params.type) ? params.type : [params.type];
      types.forEach((t) => searchParams.append('type', t));
    }
    if (params.commune) searchParams.set('commune', params.commune);
    if (params.minPrice) searchParams.set('minPrice', String(params.minPrice));
    if (params.maxPrice) searchParams.set('maxPrice', String(params.maxPrice));
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.page) searchParams.set('page', String(params.page));

    const url = `/experiences?${searchParams.toString()}`;
    await this.goto(url);
  }

  /**
   * Type in the search box (includes debounce wait)
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce (300ms) + network
    await this.page.waitForTimeout(350);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clear the search input
   */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(350);
  }

  /**
   * Filter by experience type
   */
  async filterByType(type: ExperienceType) {
    await this.typeFilters[type].check();
    await this.waitForResultsUpdate();
  }

  /**
   * Remove type filter
   */
  async removeTypeFilter(type: ExperienceType) {
    await this.typeFilters[type].uncheck();
    await this.waitForResultsUpdate();
  }

  /**
   * Filter by multiple types
   */
  async filterByTypes(types: ExperienceType[]) {
    for (const type of types) {
      await this.typeFilters[type].check();
    }
    await this.waitForResultsUpdate();
  }

  /**
   * Select a commune from the dropdown
   */
  async filterByCommune(commune: string) {
    await this.communeSelect.selectOption({ label: commune });
    await this.waitForResultsUpdate();
  }

  /**
   * Set price range filter
   */
  async filterByPriceRange(min: number, max: number) {
    await this.minPriceInput.fill(String(min));
    await this.maxPriceInput.fill(String(max));
    // Trigger blur to apply filter
    await this.maxPriceInput.blur();
    await this.waitForResultsUpdate();
  }

  /**
   * Clear all active filters
   */
  async clearAllFilters() {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
      await this.waitForResultsUpdate();
    }
  }

  /**
   * Change sort order
   */
  async sortBy(option: SortOption) {
    const labels: Record<SortOption, RegExp> = {
      relevance: /relevance/i,
      price_asc: /price.*low|low.*high/i,
      price_desc: /price.*high|high.*low/i,
      newest: /newest/i,
    };
    await this.sortSelect.selectOption({ label: labels[option] });
    await this.waitForResultsUpdate();
  }

  /**
   * Get the count of displayed experience cards
   */
  async getResultCount(): Promise<number> {
    return this.experienceCards.count();
  }

  /**
   * Get the total results count from the UI
   */
  async getTotalResultsText(): Promise<string> {
    return this.getText(this.resultsCount);
  }

  /**
   * Check if empty state is shown
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Click on an experience card by index
   */
  async clickExperience(index: number) {
    await this.experienceCards.nth(index).click();
    await this.page.waitForURL(/\/experiences\/[^/]+$/);
  }

  /**
   * Click on an experience card by title
   */
  async clickExperienceByTitle(title: string) {
    await this.experienceCards.filter({ hasText: title }).first().click();
    await this.page.waitForURL(/\/experiences\/[^/]+$/);
  }

  /**
   * Get experience card details by index
   */
  async getExperienceCardDetails(index: number): Promise<{
    title: string;
    winery: string;
    price: string;
    duration: string;
  }> {
    const card = this.experienceCards.nth(index);
    return {
      title: await this.getText(card.getByTestId('experience-title')),
      winery: await this.getText(card.getByTestId('winery-name')),
      price: await this.getText(card.getByTestId('experience-price')),
      duration: await this.getText(card.getByTestId('experience-duration')),
    };
  }

  /**
   * Navigate to a specific page
   */
  async goToPage(pageNumber: number) {
    await this.pagination.getByRole('button', { name: String(pageNumber) }).click();
    await this.waitForResultsUpdate();
  }

  /**
   * Go to next page
   */
  async goToNextPage() {
    await this.nextPageButton.click();
    await this.waitForResultsUpdate();
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage() {
    await this.prevPageButton.click();
    await this.waitForResultsUpdate();
  }

  /**
   * Get current page number from URL
   */
  getCurrentPage(): number {
    const params = this.getUrlParams();
    return parseInt(params.get('page') ?? '1', 10);
  }

  /**
   * Check if a type filter is active
   */
  async isTypeFilterActive(type: ExperienceType): Promise<boolean> {
    return this.typeFilters[type].isChecked();
  }

  /**
   * Wait for results to update after filter change
   */
  private async waitForResultsUpdate() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify URL contains expected filter params
   */
  async expectUrlContains(params: Record<string, string>) {
    const urlParams = this.getUrlParams();
    for (const [key, value] of Object.entries(params)) {
      expect(urlParams.get(key)).toBe(value);
    }
  }
}
