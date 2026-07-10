import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Experience Detail page
 * Route: /experiences/[slug]
 */
export class ExperienceDetailPage extends BasePage {
  // Hero section
  readonly heroImage: Locator;
  readonly title: Locator;
  readonly typeBadge: Locator;
  readonly heroPrice: Locator;

  // Main content
  readonly description: Locator;
  readonly duration: Locator;
  readonly capacity: Locator;
  readonly availabilityPreview: Locator;
  readonly gallery: Locator;

  // Location section
  readonly locationSection: Locator;
  readonly address: Locator;
  readonly mapLink: Locator;

  // Sidebar - Booking CTA
  readonly bookingCta: Locator;
  readonly price: Locator;
  readonly bookNowButton: Locator;
  readonly bookingWidget: Locator;
  readonly comingSoonBadge: Locator;

  // Sidebar - Winery info
  readonly wineryCard: Locator;
  readonly wineryName: Locator;
  readonly wineryLocation: Locator;
  readonly wineryLink: Locator;

  // Related experiences
  readonly relatedExperiences: Locator;
  readonly relatedCards: Locator;

  // Navigation
  readonly breadcrumb: Locator;

  // Error states
  readonly notFoundMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Hero
    this.heroImage = page.getByTestId('experience-hero-image');
    this.title = page.getByRole('heading', { level: 1 });
    this.typeBadge = page.getByTestId('experience-type-badge');
    this.heroPrice = page.getByTestId('hero-price');

    // Content
    this.description = page.getByTestId('experience-description');
    this.duration = page
      .locator('main')
      .getByTestId('experience-duration')
      .first();
    this.capacity = page.getByTestId('experience-capacity');
    this.availabilityPreview = page.getByTestId('availability-preview');
    this.gallery = page.getByTestId('experience-gallery');

    // Location
    this.locationSection = page.getByTestId('location-section');
    this.address = page.getByTestId('winery-address');
    this.mapLink = page.getByRole('link', { name: /map|directions/i });

    // Booking CTA
    this.bookingCta = page.getByTestId('booking-cta');
    this.bookingWidget = page.getByTestId('booking-widget');
    this.price = this.bookingWidget.getByTestId('experience-price');
    this.bookNowButton = page.getByTestId('continue-to-checkout');
    this.comingSoonBadge = page.getByText(/coming soon|soon|bient[oô]t/i);

    // Winery card
    this.wineryCard = page.getByTestId('winery-info-card');
    this.wineryName = page.getByTestId('winery-name');
    this.wineryLocation = page.getByTestId('winery-location');
    this.wineryLink = this.wineryCard.getByRole('link');

    // Related
    this.relatedExperiences = page.getByTestId('related-experiences');
    this.relatedCards = this.relatedExperiences.getByTestId('experience-card');

    // Nav
    this.breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });

    // Errors
    this.notFoundMessage = page.getByText(/not found|404/i);
  }

  /**
   * Navigate to an experience detail page by slug
   */
  async navigate(slug: string) {
    await this.goto(`/experiences/${slug}`, {
      waitForSelector:
        '[data-testid="experience-hero-image"], [data-testid="not-found"]',
    });
  }

  /**
   * Get the experience title
   */
  async getTitle(): Promise<string> {
    return this.getText(this.title);
  }

  /**
   * Get the experience type from the badge
   */
  async getType(): Promise<string> {
    return this.getText(this.typeBadge);
  }

  /**
   * Get the price text
   */
  async getPrice(): Promise<string> {
    return this.getText(this.price);
  }

  /**
   * Get the duration text
   */
  async getDuration(): Promise<string> {
    return this.getText(this.duration);
  }

  /**
   * Get the capacity text
   */
  async getCapacity(): Promise<string> {
    return this.getText(this.capacity);
  }

  /**
   * Get the description text
   */
  async getDescription(): Promise<string> {
    return this.getText(this.description);
  }

  /**
   * Check if the Book Now button is visible and enabled
   */
  async isBookingEnabled(): Promise<boolean> {
    if (!(await this.bookingWidget.isVisible())) return false;
    return !(await this.comingSoonBadge.isVisible());
  }

  /**
   * Check if Coming Soon badge is displayed
   */
  async hasComingSoonBadge(): Promise<boolean> {
    return this.comingSoonBadge.isVisible();
  }

  /**
   * Click the Book Now button to scroll to the booking widget
   */
  async clickBookNow() {
    await this.bookingWidget.scrollIntoViewIfNeeded();
    await this.bookingWidget.waitFor({ state: 'visible' });
  }

  /**
   * Get winery information
   */
  async getWineryInfo(): Promise<{ name: string; location: string }> {
    return {
      name: await this.getText(this.wineryName),
      location: await this.getText(this.wineryLocation),
    };
  }

  /**
   * Click to view winery detail page
   */
  async clickWineryLink() {
    await this.wineryLink.click();
    await this.page.waitForURL(/\/wineries\//);
  }

  /**
   * Get count of related experiences
   */
  async getRelatedExperiencesCount(): Promise<number> {
    return this.relatedCards.count();
  }

  /**
   * Click a related experience by index
   */
  async clickRelatedExperience(index: number) {
    await this.relatedCards.nth(index).click();
    await this.page.waitForURL(/\/experiences\/[^/]+$/);
  }

  /**
   * Check if availability preview is showing
   */
  async hasAvailabilityPreview(): Promise<boolean> {
    return this.availabilityPreview.isVisible();
  }

  /**
   * Get availability slots from preview
   */
  async getAvailabilitySlots(): Promise<string[]> {
    const slots = await this.availabilityPreview
      .locator('[data-testid="availability-slot"]')
      .all();
    return Promise.all(
      slots.map((slot) => slot.textContent().then((t) => t?.trim() ?? ''))
    );
  }

  /**
   * Check if page shows 404 / not found
   */
  async isNotFound(): Promise<boolean> {
    return this.notFoundMessage.isVisible();
  }

  /**
   * Get breadcrumb items
   */
  async getBreadcrumbs(): Promise<string[]> {
    const items = await this.breadcrumb.getByRole('listitem').all();
    return Promise.all(
      items.map((item) => item.textContent().then((t) => t?.trim() ?? ''))
    );
  }

  /**
   * Check if gallery has images
   */
  async hasGalleryImages(): Promise<boolean> {
    const images = await this.gallery.locator('img').count();
    return images > 0;
  }

  /**
   * Get the full experience details
   */
  async getExperienceDetails(): Promise<{
    title: string;
    type: string;
    description: string;
    price: string;
    duration: string;
    capacity: string;
    winery: { name: string; location: string };
  }> {
    return {
      title: await this.getTitle(),
      type: await this.getType(),
      description: await this.getDescription(),
      price: await this.getPrice(),
      duration: await this.getDuration(),
      capacity: await this.getCapacity(),
      winery: await this.getWineryInfo(),
    };
  }
}
