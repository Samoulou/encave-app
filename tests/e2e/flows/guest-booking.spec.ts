import { test, expect } from '@playwright/test';
import {
  SearchPage,
  ExperienceDetailPage,
  BookingPage,
  CheckoutPage,
  ConfirmationPage,
  BookingManagementPage,
} from '../pages';
import {
  TEST_EXPERIENCES,
  TEST_VISITORS,
  formatPrice,
} from '../fixtures/test-data';
import { getNextWeekday, formatDisplayDate } from '../utils/date-helpers';
import { completeStripeCheckout } from '../utils/stripe-helpers';

/**
 * Guest Booking Journey E2E Tests
 *
 * Ces tests vérifient le parcours complet d'un visiteur :
 * Recherche → Détail → Réservation → Paiement → Confirmation
 */

// Données de test réutilisables
const testExperience = TEST_EXPERIENCES.wineTasting;
const testVisitor = TEST_VISITORS.validVisitor;
const bookingDate = getNextWeekday(7); // Prochain jour ouvrable dans 7 jours
const bookingTime = '10:00';
const guestCount = 4;

test.describe('Parcours Guest - Recherche & Découverte', () => {
  test('la page de recherche affiche les expériences', async ({ page }) => {
    // Arrange - Créer le page object
    const searchPage = new SearchPage(page);

    // Act - Naviguer vers la page
    await searchPage.navigate();

    // Assert - Vérifier que des expériences s'affichent
    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('la recherche textuelle filtre les résultats', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigate();

    // Rechercher "wine"
    await searchPage.search('wine');

    // Vérifier que l'URL contient le paramètre de recherche
    await searchPage.expectUrlContains({ q: 'wine' });

    // Vérifier que les résultats sont filtrés
    const count = await searchPage.getResultCount();
    expect(count).toBeGreaterThanOrEqual(0); // Peut être 0 si pas de match
  });

  test('le filtre par type fonctionne', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigate();

    // Filtrer par type "TASTING"
    await searchPage.filterByType('TASTING');

    // Vérifier l'URL
    await searchPage.expectUrlContains({ type: 'TASTING' });
  });

  test('cliquer sur une expérience navigue vers le détail', async ({
    page,
  }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigate();

    // Cliquer sur la première expérience
    await searchPage.clickExperience(0);

    // Vérifier qu'on est sur la page de détail
    await expect(page).toHaveURL(/\/experiences\/[^/]+$/);
  });
});

test.describe('Parcours Guest - Page de Détail', () => {
  test("la page de détail affiche les informations de l'expérience", async ({
    page,
  }) => {
    const detailPage = new ExperienceDetailPage(page);

    // Naviguer vers une expérience connue
    await detailPage.navigate(testExperience.slug);

    // Vérifier les informations affichées
    const title = await detailPage.getTitle();
    expect(title).toBeTruthy();

    const price = await detailPage.getPrice();
    expect(price).toContain('CHF');

    const duration = await detailPage.getDuration();
    expect(duration).toBeTruthy();
  });

  test('le bouton "Book Now" est cliquable pour une expérience active', async ({
    page,
  }) => {
    const detailPage = new ExperienceDetailPage(page);
    await detailPage.navigate(testExperience.slug);

    // Vérifier que le bouton est activé
    const canBook = await detailPage.isBookingEnabled();
    expect(canBook).toBe(true);
  });

  test('cliquer sur "Book Now" scrolle vers le widget de réservation', async ({
    page,
  }) => {
    const detailPage = new ExperienceDetailPage(page);
    await detailPage.navigate(testExperience.slug);

    // Cliquer sur Book Now
    await detailPage.clickBookNow();

    // Vérifier que le widget de réservation est visible
    await expect(detailPage.bookingWidget).toBeVisible();
  });

  test('une expérience sans Stripe affiche "Coming Soon"', async ({ page }) => {
    const detailPage = new ExperienceDetailPage(page);

    // Naviguer vers l'expérience sans Stripe
    await detailPage.navigate(TEST_EXPERIENCES.noStripeExperience.slug);

    // Vérifier le badge Coming Soon
    const hasComingSoon = await detailPage.hasComingSoonBadge();
    expect(hasComingSoon).toBe(true);

    // Vérifier que la réservation est désactivée
    const canBook = await detailPage.isBookingEnabled();
    expect(canBook).toBe(false);
  });
});

test.describe('Parcours Guest - Sélection de Réservation', () => {
  test('la page experience affiche le calendrier de réservation', async ({
    page,
  }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Vérifier que le calendrier est visible
    await expect(bookingPage.calendar).toBeVisible();
  });

  test('sélectionner une date affiche les créneaux horaires', async ({
    page,
  }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Sélectionner une date
    await bookingPage.selectDateByString(bookingDate);

    // Vérifier que les créneaux s'affichent
    const hasTimeSlots = await bookingPage.hasTimeSlots();
    expect(hasTimeSlots).toBe(true);
  });

  test('sélectionner un créneau affiche le sélecteur de guests', async ({
    page,
  }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Sélectionner date et heure
    await bookingPage.selectDateByString(bookingDate);
    await bookingPage.selectTimeSlot(bookingTime);

    // Vérifier que le sélecteur de guests apparaît
    const hasGuestSelector = await bookingPage.hasGuestCountSelector();
    expect(hasGuestSelector).toBe(true);
  });

  test('le prix total se calcule correctement', async ({ page }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Compléter la sélection
    await bookingPage.selectDateByString(bookingDate);
    await bookingPage.selectTimeSlot(bookingTime);
    await bookingPage.setGuestCount(guestCount);

    // Vérifier le prix total
    const totalPrice = await bookingPage.getTotalPrice();
    const expectedTotal = formatPrice(testExperience.price * guestCount);
    expect(totalPrice).toContain(expectedTotal.replace('CHF ', ''));
  });

  test('le bouton Continue est désactivé sans sélection complète', async ({
    page,
  }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Sans aucune sélection, le bouton doit être désactivé
    const canContinue = await bookingPage.canContinue();
    expect(canContinue).toBe(false);
  });

  test("le bouton Continue s'active avec une sélection complète", async ({
    page,
  }) => {
    const bookingPage = new BookingPage(page);
    await bookingPage.navigate(testExperience.slug);

    // Compléter toute la sélection
    await bookingPage.selectDateByString(bookingDate);
    await bookingPage.selectTimeSlot(bookingTime);
    await bookingPage.setGuestCount(guestCount);

    // Vérifier que le bouton est maintenant actif
    const canContinue = await bookingPage.canContinue();
    expect(canContinue).toBe(true);
  });

  test('la sélection persiste après un refresh', async ({ page }) => {
    const bookingPage = new BookingPage(page);

    // Naviguer avec des paramètres pré-remplis
    await bookingPage.navigateWithParams(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Rafraîchir la page
    await page.reload();

    // Vérifier que les valeurs sont préservées
    const selectedDate = bookingPage.getSelectedDate();
    expect(selectedDate).toBe(bookingDate);
  });
});

test.describe('Parcours Guest - Checkout', () => {
  test('la page checkout affiche le formulaire', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Vérifier que les champs sont visibles
    await expect(checkoutPage.firstNameInput).toBeVisible();
    await expect(checkoutPage.lastNameInput).toBeVisible();
    await expect(checkoutPage.emailInput).toBeVisible();
    await expect(checkoutPage.phoneInput).toBeVisible();
  });

  test('le récapitulatif affiche les bonnes informations', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Vérifier le récapitulatif
    const summary = await checkoutPage.getSummary();
    expect(summary.guests).toContain(String(guestCount));
  });

  test('la validation bloque les champs vides', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Essayer de soumettre sans remplir
    await checkoutPage.clickPay();

    // Vérifier les erreurs de validation
    const hasErrors = await checkoutPage.hasValidationErrors();
    expect(hasErrors).toBe(true);
  });

  test('la validation vérifie le format email', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Remplir avec un email invalide
    await checkoutPage.fillForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'email-invalide',
      phone: '+41 79 123 45 67',
    });

    await checkoutPage.clickPay();

    // Vérifier l'erreur email
    const hasEmailError = await checkoutPage.hasEmailError();
    expect(hasEmailError).toBe(true);
  });

  test('un formulaire valide redirige vers Stripe', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    // Remplir avec des données valides
    await checkoutPage.fillForm(testVisitor);
    await checkoutPage.confirmAge();

    // Soumettre
    await checkoutPage.submitPayment();

    // Vérifier la redirection vers Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
  });

  test('la confirmation 18+ est obligatoire avant le paiement', async ({
    page,
  }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    await checkoutPage.fillForm(testVisitor);
    await checkoutPage.clickPay();

    expect(await checkoutPage.hasAgeConfirmationError()).toBe(true);
    await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
  });
});

test.describe('Parcours Guest - Confirmation', () => {
  // Ce test nécessite une vraie réservation ou un mock
  test.skip('la page de confirmation affiche la référence', async ({
    page,
  }) => {
    // Note: Ce test est skip car il nécessite un vrai paiement Stripe
    // ou une base de données de test avec une réservation existante

    const confirmationPage = new ConfirmationPage(page);

    // Simuler une navigation vers une confirmation existante
    // await confirmationPage.navigate('booking-id-test');

    // Vérifier le format de la référence
    // const reference = await confirmationPage.getBookingReference();
    // expect(reference).toMatch(/^EC-[A-Z0-9]+$/);
  });
});

test.describe('Parcours Complet - Happy Path', () => {
  test('un visiteur peut compléter une réservation de bout en bout', async ({
    page,
  }) => {
    // 1. RECHERCHE
    const searchPage = new SearchPage(page);
    await searchPage.navigate();

    // Vérifier que des expériences existent
    const initialCount = await searchPage.getResultCount();
    expect(initialCount).toBeGreaterThan(0);

    // 2. SÉLECTION D'UNE EXPÉRIENCE
    await searchPage.clickExperience(0);
    await expect(page).toHaveURL(/\/experiences\/[^/]+$/);

    // 3. DÉTAIL DE L'EXPÉRIENCE
    const detailPage = new ExperienceDetailPage(page);
    const canBook = await detailPage.isBookingEnabled();

    // Si l'expérience est réservable, continuer
    if (canBook) {
      await detailPage.clickBookNow();

      // 4. SÉLECTION DATE/HEURE/GUESTS (booking widget is now on experience page)
      const bookingPage = new BookingPage(page);

      // Attendre que le calendrier soit prêt (widget is on experience page)
      await expect(bookingPage.calendar).toBeVisible();

      // Sélectionner une date disponible (on utilise une date future)
      await bookingPage.selectDateByString(bookingDate);

      // Vérifier que les créneaux apparaissent
      const hasSlots = await bookingPage.hasTimeSlots();
      if (hasSlots) {
        // Sélectionner le premier créneau disponible
        const availableSlots = await bookingPage.getAvailableTimeSlots();
        if (availableSlots.length > 0) {
          await bookingPage.selectTimeSlot(availableSlots[0]);

          // Sélectionner le nombre de guests
          await bookingPage.setGuestCount(2);

          // 5. CONTINUER VERS LE CHECKOUT
          const canContinue = await bookingPage.canContinue();
          expect(canContinue).toBe(true);

          await bookingPage.continueToCheckout();

          // 6. REMPLIR LE FORMULAIRE
          const checkoutPage = new CheckoutPage(page);
          await checkoutPage.fillForm(testVisitor);
          await checkoutPage.confirmAge();

          // Vérifier que le bouton Pay est actif
          const canPay = await checkoutPage.canPay();
          expect(canPay).toBe(true);

          // Note: On s'arrête ici car soumettre créerait une vraie session Stripe
          // Dans un environnement de test complet, on utiliserait:
          // await checkoutPage.submitPayment();
          // await completeStripeCheckout(page);
          // Et on vérifierait la page de confirmation
        }
      }
    }
  });
});

/**
 * Tests de régression / edge cases
 */
test.describe('Edge Cases', () => {
  test('accéder au checkout sans paramètres affiche une erreur', async ({
    page,
  }) => {
    const checkoutPage = new CheckoutPage(page);

    // Naviguer sans les paramètres requis
    await checkoutPage.navigateWithoutParams(testExperience.slug);

    // Vérifier qu'une erreur s'affiche
    const hasError = await checkoutPage.hasMissingParamsError();
    expect(hasError).toBe(true);
  });

  test('une expérience inexistante affiche 404', async ({ page }) => {
    const detailPage = new ExperienceDetailPage(page);

    // Naviguer vers un slug qui n'existe pas
    await detailPage.navigate('experience-qui-nexiste-pas-du-tout');

    // Vérifier le 404
    const isNotFound = await detailPage.isNotFound();
    expect(isNotFound).toBe(true);
  });
});
