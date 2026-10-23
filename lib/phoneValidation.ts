/**
 * Utility functions for validating and formatting mobile / phone numbers across HealthSync.
 * Supports standard 10-digit mobile numbers (e.g. Indian standard starting with 6, 7, 8, or 9),
 * numbers with +91 or other international country codes, and general E.164 formats.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates whether the given string is a valid mobile/phone number.
 * Ensures the number is non-empty, contains valid characters and digit lengths,
 * and conforms to standard 10-digit mobile or standard international format.
 */
export function validateMobileNumber(phone: string | null | undefined): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      errorMessage: 'Mobile number is mandatory.',
    };
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Mobile number is mandatory.',
    };
  }

  // Remove valid formatting characters: spaces, hyphens, brackets, dots
  const stripped = trimmed.replace(/[\s\-\(\)\.]/g, '');

  // Check for allowed characters only (optional leading '+', followed by digits)
  if (!/^\+?\d+$/.test(stripped)) {
    return {
      isValid: false,
      errorMessage: 'Mobile number can only contain digits, spaces, and optional "+" country code.',
    };
  }

  // Extract pure digits
  const digits = stripped.replace(/\D/g, '');

  // Check digit count
  if (digits.length < 10) {
    return {
      isValid: false,
      errorMessage: 'Mobile number must contain at least 10 digits.',
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      errorMessage: 'Mobile number cannot exceed 15 digits.',
    };
  }

  // Reject repeating identical digits (e.g., 0000000000, 1111111111, 9999999999)
  if (/^(\d)\1+$/.test(digits)) {
    return {
      isValid: false,
      errorMessage: 'Please enter a valid active mobile number, not repeated identical digits.',
    };
  }

  // Check for Indian mobile numbers (standard 10 digits starting with 6, 7, 8, or 9, with optional +91, 91, or 0)
  const indianMobileRegex = /^(?:(?:\+|00)?91|0)?[6-9]\d{9}$/;
  if (indianMobileRegex.test(stripped)) {
    return { isValid: true };
  }

  // Check general international format (starts with non-zero country code, 10 to 15 digits)
  const generalMobileRegex = /^\+?[1-9]\d{9,14}$/;
  if (generalMobileRegex.test(stripped)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    errorMessage: 'Please enter a valid 10-digit mobile number (e.g. 98460 12345 or +91 98460 12345).',
  };
}

/**
 * Quick boolean check for mobile number validity.
 */
export function isValidMobileNumber(phone: string | null | undefined): boolean {
  return validateMobileNumber(phone).isValid;
}

/**
 * Normalizes phone number for display or API payload.
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.trim();
}
