import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * User roles in the application
 */
export type UserRole = 'CLIENT' | 'WINEMAKER' | 'ADMIN';

/**
 * Login form data
 */
export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Register form data
 */
export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  isWinemaker?: boolean;
}

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly showPasswordButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[autocomplete="email"]');
    this.passwordInput = page.locator('input[autocomplete="current-password"]');
    this.submitButton = page.getByRole('button', {
      name: /log in|sign in|se connecter/i,
    });
    this.errorMessage = page.locator('.bg-red-50');
    this.registerLink = page.getByRole('link', {
      name: /create account|créer un compte/i,
    });
    this.rememberMeCheckbox = page.getByRole('checkbox', { name: /remember/i });
    this.showPasswordButton = page.locator('button[aria-label*="password"]');
  }

  /**
   * Navigate to login page
   */
  async navigate(callbackUrl?: string) {
    const url = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/login';
    await this.goto(url);
  }

  /**
   * Fill login form
   */
  async fillForm(data: LoginFormData) {
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  /**
   * Submit login form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Perform complete login
   */
  async login(data: LoginFormData) {
    await this.fillForm(data);
    await this.submit();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return this.getText(this.errorMessage);
  }

  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Wait for redirect after successful login
   */
  async waitForLoginRedirect(expectedRole: UserRole) {
    const urlPatterns: Record<UserRole, RegExp> = {
      CLIENT: /\/dashboard$/,
      WINEMAKER: /\/dashboard\/bookings/,
      ADMIN: /\/admin/,
    };
    await this.page.waitForURL(urlPatterns[expectedRole], { timeout: 10000 });
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  /**
   * Check remember me
   */
  async checkRememberMe() {
    await this.rememberMeCheckbox.check();
  }
}

/**
 * Register Page Object
 */
export class RegisterPage extends BasePage {
  // Locators
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly winemakerCheckbox: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly passwordHint: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByRole('textbox', { name: /name|nom/i });
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    // Get password fields by their labels more specifically
    this.passwordInput = page
      .locator('input[autocomplete="new-password"]')
      .first();
    this.confirmPasswordInput = page
      .locator('input[autocomplete="new-password"]')
      .last();
    this.winemakerCheckbox = page.getByRole('checkbox');
    this.submitButton = page.getByRole('button', {
      name: /create account|créer|sign up/i,
    });
    this.errorMessage = page.locator('.bg-red-50');
    this.loginLink = page.getByRole('link', { name: /sign in|se connecter/i });
    this.passwordHint = page.locator('text=/8.*characters|caractères/i');
  }

  /**
   * Navigate to register page
   */
  async navigate(asWinemaker = false) {
    const url = asWinemaker ? '/register?winemaker=true' : '/register';
    await this.goto(url);
  }

  /**
   * Fill registration form
   */
  async fillForm(data: RegisterFormData) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);

    if (data.isWinemaker) {
      await this.winemakerCheckbox.check();
    }
  }

  /**
   * Submit registration form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Perform complete registration
   */
  async register(data: RegisterFormData) {
    await this.fillForm(data);
    await this.submit();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return this.getText(this.errorMessage);
  }

  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Wait for redirect after successful registration
   */
  async waitForRegistrationRedirect(isWinemaker: boolean) {
    if (isWinemaker) {
      await this.page.waitForURL(/\/onboarding\/winery/, { timeout: 15000 });
    } else {
      await this.page.waitForURL(/\/dashboard/, { timeout: 15000 });
    }
  }

  /**
   * Get form validation errors
   */
  async getFieldError(
    fieldName: 'name' | 'email' | 'password' | 'confirmPassword'
  ): Promise<string | null> {
    const fieldLocators = {
      name: this.nameInput,
      email: this.emailInput,
      password: this.passwordInput,
      confirmPassword: this.confirmPasswordInput,
    };

    const field = fieldLocators[fieldName];
    const formItem = field.locator('..').locator('..');
    const errorElement = formItem.locator(
      '[data-slot="form-message"], .text-red-500, .text-destructive'
    );

    if (await errorElement.isVisible()) {
      return this.getText(errorElement);
    }
    return null;
  }
}

/**
 * Header component with auth state
 */
export class AuthHeader extends BasePage {
  readonly userMenuButton: Locator;
  readonly logoutButton: Locator;
  readonly loginButton: Locator;
  readonly registerButton: Locator;

  constructor(page: Page) {
    super(page);
    this.userMenuButton = page
      .getByTestId('user-menu')
      .or(page.getByRole('button', { name: /account|profile|compte/i }));
    this.logoutButton = page
      .getByRole('menuitem', { name: /log out|sign out|déconnexion/i })
      .or(page.getByRole('button', { name: /log out|sign out|déconnexion/i }));
    this.loginButton = page.getByRole('link', {
      name: /log in|sign in|connexion/i,
    });
    this.registerButton = page.getByRole('link', {
      name: /register|sign up|inscription/i,
    });
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    return this.userMenuButton.isVisible();
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    await this.userMenuButton.click();
  }

  /**
   * Logout
   */
  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
  }

  /**
   * Navigate to login
   */
  async goToLogin() {
    await this.loginButton.click();
  }

  /**
   * Navigate to register
   */
  async goToRegister() {
    await this.registerButton.click();
  }
}
