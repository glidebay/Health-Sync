
export interface PhoneValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

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

  const stripped = trimmed.replace(/[\s\-\(\)\.]/g, '');

  if (!/^\+?\d+$/.test(stripped)) {
    return {
      isValid: false,
      errorMessage: 'Mobile number can only contain digits, spaces, and optional "+" country code.',
    };
  }

  const digits = stripped.replace(/\D/g, '');

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

  if (/^(\d)\1+$/.test(digits)) {
    return {
      isValid: false,
      errorMessage: 'Please enter a valid active mobile number, not repeated identical digits.',
    };
  }

  const indianMobileRegex = /^(?:(?:\+|00)?91|0)?[6-9]\d{9}$/;
  if (indianMobileRegex.test(stripped)) {
    return { isValid: true };
  }

  const generalMobileRegex = /^\+?[1-9]\d{9,14}$/;
  if (generalMobileRegex.test(stripped)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    errorMessage: 'Please enter a valid 10-digit mobile number (e.g. 98460 12345 or +91 98460 12345).',
  };
}

export function isValidMobileNumber(phone: string | null | undefined): boolean {
  return validateMobileNumber(phone).isValid;
}

export function normalizePhoneNumber(phone: string): string {
  return phone.trim();
}
