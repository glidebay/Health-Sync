'use client';

import React from 'react';
import { BranchLocationManager } from './BranchLocationManager';
import { DbClinicLocation } from '@/types/database';

export interface ClinicBrandingSettingsProps {
  currentLocationId?: string;
  onSelectLocation?: (loc: DbClinicLocation) => void;
  clinicId?: string | null;
  clinicName?: string | null;
}

export function ClinicBrandingSettings(props: ClinicBrandingSettingsProps) {
  return <BranchLocationManager {...props} />;
}

export default ClinicBrandingSettings;

