#!/usr/bin/env tsx
/**
 * Translation Coverage Script
 *
 * This script verifies that all translation keys exist across all locale files.
 * It compares the French (default) translations against German and English files
 * and reports any missing or extra keys.
 *
 * Usage: npx tsx scripts/check-translations.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const LOCALES = ['fr', 'de', 'en'] as const;
const DEFAULT_LOCALE = 'fr';

interface TranslationStats {
  locale: string;
  totalKeys: number;
  missingKeys: string[];
  extraKeys: string[];
}

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Load a translation file
 */
function loadTranslations(locale: string): Record<string, unknown> {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compare translations between default locale and target locale
 */
function compareTranslations(
  defaultKeys: string[],
  targetKeys: string[],
  locale: string
): TranslationStats {
  const defaultSet = new Set(defaultKeys);
  const targetSet = new Set(targetKeys);

  const missingKeys = defaultKeys.filter((key) => !targetSet.has(key));
  const extraKeys = targetKeys.filter((key) => !defaultSet.has(key));

  return {
    locale,
    totalKeys: targetKeys.length,
    missingKeys,
    extraKeys,
  };
}

/**
 * Main function
 */
function main(): void {
  console.log('Translation Coverage Report');
  console.log('='.repeat(50));
  console.log();

  // Load default locale translations
  const defaultTranslations = loadTranslations(DEFAULT_LOCALE);
  const defaultKeys = getAllKeys(defaultTranslations);

  console.log(`Default locale (${DEFAULT_LOCALE}): ${defaultKeys.length} keys`);
  console.log();

  let hasIssues = false;

  // Compare each locale against the default
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;

    const translations = loadTranslations(locale);
    const keys = getAllKeys(translations);
    const stats = compareTranslations(defaultKeys, keys, locale);

    console.log(`Locale: ${locale}`);
    console.log('-'.repeat(30));
    console.log(`  Total keys: ${stats.totalKeys}`);
    console.log(`  Coverage: ${((stats.totalKeys - stats.extraKeys.length) / defaultKeys.length * 100).toFixed(1)}%`);

    if (stats.missingKeys.length > 0) {
      hasIssues = true;
      console.log(`  Missing keys (${stats.missingKeys.length}):`);
      stats.missingKeys.forEach((key) => {
        console.log(`    - ${key}`);
      });
    } else {
      console.log('  Missing keys: None');
    }

    if (stats.extraKeys.length > 0) {
      console.log(`  Extra keys (${stats.extraKeys.length}):`);
      stats.extraKeys.forEach((key) => {
        console.log(`    + ${key}`);
      });
    } else {
      console.log('  Extra keys: None');
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(50));
  if (hasIssues) {
    console.log('Status: ISSUES FOUND');
    console.log('Some translations are missing. Please update the translation files.');
    process.exit(1);
  } else {
    console.log('Status: ALL TRANSLATIONS COMPLETE');
    console.log('All translation keys are present in all locale files.');
    process.exit(0);
  }
}

main();
