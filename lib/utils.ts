export type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: boolean | number | string | undefined | null }
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  function process(input: ClassValue) {
    if (!input) return;
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      input.forEach(process);
    } else if (typeof input === 'object') {
      for (const [key, val] of Object.entries(input)) {
        if (Boolean(val)) {
          classes.push(key);
        }
      }
    }
  }

  inputs.forEach(process);
  return classes.join(' ');
}

/**
 * Formats a patient token, display_id, or patient_number into the standard P### format (e.g., P072, P073).
 */
export function formatPatientToken(p?: {
  displayId?: string;
  patientNumber?: number;
  tokenNumber?: number | string;
  queueTokenNo?: number | string;
} | null): string {
  if (!p) return 'P001';

  // 1. Prioritize queueTokenNo from backend appointments table (e.g., 1 -> P001, 2 -> P002)
  if (p.queueTokenNo !== undefined && p.queueTokenNo !== null) {
    const raw = String(p.queueTokenNo).trim();
    if (raw) {
      if (raw.toUpperCase().startsWith('P')) {
        const numPart = raw.slice(1);
        return !isNaN(Number(numPart)) ? `P${numPart.padStart(3, '0')}` : raw;
      }
      if (!isNaN(Number(raw))) {
        return `P${raw.padStart(3, '0')}`;
      }
      return raw;
    }
  }

  // 2. Check tokenNumber (e.g., 'P001', 1)
  if (p.tokenNumber !== undefined && p.tokenNumber !== null) {
    const raw = String(p.tokenNumber).trim();
    if (raw) {
      if (raw.toUpperCase().startsWith('P')) {
        const numPart = raw.slice(1);
        return !isNaN(Number(numPart)) ? `P${numPart.padStart(3, '0')}` : raw;
      }
      if (!isNaN(Number(raw))) {
        return `P${raw.padStart(3, '0')}`;
      }
      return raw;
    }
  }

  // 3. Fallback to displayId
  if (p.displayId && typeof p.displayId === 'string') {
    const trimmed = p.displayId.trim();
    if (trimmed) {
      if (trimmed.toUpperCase().startsWith('P')) {
        const num = trimmed.slice(1);
        return !isNaN(Number(num)) ? `P${num.padStart(3, '0')}` : trimmed;
      }
      return `P${trimmed.padStart(3, '0')}`;
    }
  }

  // 4. Fallback to patientNumber
  if (p.patientNumber !== undefined && p.patientNumber !== null) {
    const num = Number(p.patientNumber);
    if (!isNaN(num)) {
      return `P${String(num).padStart(3, '0')}`;
    }
  }

  return 'P001';
}
