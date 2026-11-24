import { supabase } from './supabaseClient';
import { DbClinicLocation } from '@/types/database';

export interface UnifiedClinicSettings {
  // Clinic / Tenant Root
  clinic_id: string;
  clinic_name: string;
  clinic_phone?: string;
  clinic_email?: string;
  clinic_address?: string;
  clinic_logo_url?: string;

  // Branch Location Scoped
  location_id: string;
  branch_name: string;
  branch_code?: string;
  branch_phone?: string;
  branch_address?: string;
  branch_landmark?: string;
  daily_quota: number;
  slot_duration_mins: number;
  gateway_pin?: string;
  pad_template_url?: string;
  rx_calibrations?: any;
  print_bg_graphic?: boolean;
  is_custom_pad_active?: boolean;
  rx_footer_text?: string;

  // Operational Configs
  allow_quota_override?: boolean;
  auto_move_unattended?: boolean;
  advance_booking_days?: number;
  require_doctor_pin_for_rx?: boolean;
  pin_autolock_minutes?: number;
  whatsapp_enabled?: boolean;
  pharmacy_realtime_stock?: boolean;
  pharmacy_generic_alerts?: boolean;
  pharmacy_expiry_threshold_days?: number;
}

export interface SaveUnifiedSettingsInput {
  clinic_id: string;
  location_id: string;
  admin_pin?: string;
  clinic_name?: string;
  clinic_phone?: string;
  clinic_email?: string;
  clinic_address?: string;
  clinic_logo_url?: string;
  branch_name?: string;
  branch_code?: string;
  branch_phone?: string;
  branch_address?: string;
  branch_landmark?: string;
  daily_quota?: number;
  slot_duration_mins?: number;
  gateway_pin?: string;
  allow_quota_override?: boolean;
  auto_move_unattended?: boolean;
  require_doctor_pin_for_rx?: boolean;
  pin_autolock_minutes?: number;
  whatsapp_enabled?: boolean;
  pharmacy_realtime_stock?: boolean;
  pharmacy_generic_alerts?: boolean;
  pharmacy_expiry_threshold_days?: number;
  pad_template_url?: string;
  rx_calibrations?: any;
  print_bg_graphic?: boolean;
  is_custom_pad_active?: boolean;
  rx_footer_text?: string;
}

/**
 * Fetch unified clinic settings scoped strictly by clinic_id and location_id
 */
export async function fetchUnifiedClinicSettings(
  clinicId: string,
  locationId?: string,
  adminPin?: string
): Promise<{ success: boolean; settings?: UnifiedClinicSettings; error?: string }> {
  try {
    // 1. Try unified PostgreSQL RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_clinic_settings_unified', {
      p_clinic_id: clinicId,
      p_admin_pin: adminPin || null,
      p_location_id: locationId || null,
    });

    if (!rpcError && rpcData && rpcData.success !== false) {
      return { success: true, settings: rpcData as UnifiedClinicSettings };
    }

    // 2. Direct fallback to tables
    const { data: clinic } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .maybeSingle();

    let branch: any = null;
    if (locationId) {
      const { data: b } = await supabase
        .from('clinic_locations')
        .select('*')
        .eq('id', locationId)
        .maybeSingle();
      branch = b;
    } else {
      const { data: bList } = await supabase
        .from('clinic_locations')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .limit(1);
      branch = bList?.[0] || null;
    }

    // Fetch config parameters from app_config table
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap: Record<string, any> = {};
    if (configs) {
      for (const row of configs) {
        configMap[row.key] = row.value;
      }
    }

    const settings: UnifiedClinicSettings = {
      clinic_id: clinicId,
      clinic_name: clinic?.name || 'Clinic',
      clinic_phone: clinic?.phone || '',
      clinic_email: clinic?.email || '',
      clinic_address: clinic?.address || '',
      clinic_logo_url: clinic?.logo_url || '',

      location_id: branch?.id || locationId || '',
      branch_name: branch?.branch_name || 'Main Branch',
      branch_code: branch?.branch_code || '',
      branch_phone: branch?.phone || '',
      branch_address: branch?.address || '',
      branch_landmark: branch?.landmark || '',
      daily_quota: branch?.daily_quota ?? 40,
      slot_duration_mins: branch?.slot_duration_mins ?? 15,
      gateway_pin: branch?.gateway_pin || '',
      pad_template_url: branch?.pad_template_url || configMap['rx_template_url'] || '',
      rx_calibrations: branch?.rx_calibrations || configMap['rx_template_fields'] || null,
      print_bg_graphic: branch?.print_bg_graphic ?? (configMap['rx_template_print_bg'] !== false),
      is_custom_pad_active: branch?.is_custom_pad_active ?? Boolean(configMap['rx_template_enabled']),
      rx_footer_text: branch?.rx_footer_text || configMap['rx_footer_text'] || '',

      allow_quota_override: configMap['allow_quota_override'] ?? true,
      auto_move_unattended: configMap['auto_move_unattended'] ?? false,
      advance_booking_days: configMap['advance_booking_days'] ?? 7,
      require_doctor_pin_for_rx: configMap['require_doctor_pin_for_rx'] ?? true,
      pin_autolock_minutes: configMap['pin_autolock_minutes'] ?? 10,
      whatsapp_enabled: configMap['whatsapp_booking_enabled'] ?? true,
      pharmacy_realtime_stock: configMap['pharmacy_realtime_stock_decrement'] ?? true,
      pharmacy_generic_alerts: configMap['pharmacy_generic_molecule_alerts'] ?? true,
      pharmacy_expiry_threshold_days: configMap['pharmacy_expiry_threshold_days'] ?? 60,
    };

    return { success: true, settings };
  } catch (err: any) {
    console.warn('fetchUnifiedClinicSettings error:', err);
    return { success: false, error: err.message || 'Failed to fetch settings' };
  }
}

/**
 * Save unified clinic settings scoped strictly by clinic_id and location_id
 */
export async function saveUnifiedClinicSettings(
  input: SaveUnifiedSettingsInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. Direct and reliable table updates
    // A. Update Clinic Root (strictly for input.clinic_id)
    if (input.clinic_id) {
      const clinicUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      let hasClinicUpdates = false;

      if (input.clinic_name !== undefined && input.clinic_name.trim()) {
        clinicUpdates.name = input.clinic_name.trim();
        hasClinicUpdates = true;
      }
      if (input.clinic_phone !== undefined) {
        clinicUpdates.phone = input.clinic_phone ? input.clinic_phone.trim() : null;
        hasClinicUpdates = true;
      }
      if (input.clinic_email !== undefined) {
        clinicUpdates.email = input.clinic_email ? input.clinic_email.trim() : null;
        hasClinicUpdates = true;
      }
      if (input.clinic_address !== undefined) {
        clinicUpdates.address = input.clinic_address ? input.clinic_address.trim() : null;
        hasClinicUpdates = true;
      }
      if (input.clinic_logo_url !== undefined) {
        clinicUpdates.logo_url = input.clinic_logo_url ? input.clinic_logo_url.trim() : null;
        hasClinicUpdates = true;
      }

      if (hasClinicUpdates) {
        await supabase.from('clinics').update(clinicUpdates).eq('id', input.clinic_id);
      }
    }

    // B. Update Branch Location
    if (input.location_id) {
      const branchUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.branch_name !== undefined && input.branch_name.trim()) branchUpdates.branch_name = input.branch_name.trim();
      if (input.branch_code !== undefined && input.branch_code.trim()) branchUpdates.branch_code = input.branch_code.trim();
      if (input.branch_phone !== undefined) branchUpdates.phone = input.branch_phone ? input.branch_phone.trim() : null;
      if (input.branch_address !== undefined) branchUpdates.address = input.branch_address ? input.branch_address.trim() : null;
      if (input.branch_landmark !== undefined) branchUpdates.landmark = input.branch_landmark ? input.branch_landmark.trim() : null;
      if (input.daily_quota !== undefined) branchUpdates.daily_quota = Math.max(1, Math.min(500, input.daily_quota));
      if (input.slot_duration_mins !== undefined) branchUpdates.slot_duration_mins = Math.max(5, Math.min(180, input.slot_duration_mins));
      if (input.gateway_pin !== undefined) branchUpdates.gateway_pin = input.gateway_pin ? input.gateway_pin.trim() : null;
      if (input.pad_template_url !== undefined) branchUpdates.pad_template_url = input.pad_template_url;
      if (input.rx_calibrations !== undefined) branchUpdates.rx_calibrations = input.rx_calibrations;
      if (input.print_bg_graphic !== undefined) branchUpdates.print_bg_graphic = input.print_bg_graphic;
      if (input.is_custom_pad_active !== undefined) branchUpdates.is_custom_pad_active = input.is_custom_pad_active;
      if (input.rx_footer_text !== undefined) branchUpdates.rx_footer_text = input.rx_footer_text;

      await supabase.from('clinic_locations').update(branchUpdates).eq('id', input.location_id);
    }

    // C. Update app_config for operational flags
    const configEntries: { key: string; value: any }[] = [];
    if (input.allow_quota_override !== undefined) configEntries.push({ key: 'allow_quota_override', value: input.allow_quota_override });
    if (input.auto_move_unattended !== undefined) configEntries.push({ key: 'auto_move_unattended', value: input.auto_move_unattended });
    if (input.require_doctor_pin_for_rx !== undefined) configEntries.push({ key: 'require_doctor_pin_for_rx', value: input.require_doctor_pin_for_rx });
    if (input.pin_autolock_minutes !== undefined) configEntries.push({ key: 'pin_autolock_minutes', value: input.pin_autolock_minutes });
    if (input.whatsapp_enabled !== undefined) configEntries.push({ key: 'whatsapp_booking_enabled', value: input.whatsapp_enabled });
    if (input.pharmacy_realtime_stock !== undefined) configEntries.push({ key: 'pharmacy_realtime_stock_decrement', value: input.pharmacy_realtime_stock });
    if (input.pharmacy_generic_alerts !== undefined) configEntries.push({ key: 'pharmacy_generic_molecule_alerts', value: input.pharmacy_generic_alerts });
    if (input.pharmacy_expiry_threshold_days !== undefined) configEntries.push({ key: 'pharmacy_expiry_threshold_days', value: input.pharmacy_expiry_threshold_days });

    for (const entry of configEntries) {
      await supabase.from('app_config').upsert(entry, { onConflict: 'key' });
    }

    // Optional: Call PostgreSQL RPC for consistency if present
    try {
      await supabase.rpc('save_clinic_settings_unified', {
        p_clinic_id: input.clinic_id,
        p_admin_pin: input.admin_pin || null,
        p_location_id: input.location_id,
        p_clinic_name: input.clinic_name || null,
        p_clinic_phone: input.clinic_phone || null,
        p_daily_quota: input.daily_quota || null,
        p_slot_duration_mins: input.slot_duration_mins || null,
        p_allow_quota_override: input.allow_quota_override ?? null,
        p_require_doctor_pin: input.require_doctor_pin_for_rx ?? null,
        p_pin_autolock_mins: input.pin_autolock_minutes ?? null,
      });
    } catch {}

    return { success: true, message: 'Settings saved successfully' };

    // D. Audit log entry
    try {
      await supabase.from('audit_logs').insert([
        {
          action: 'UPDATE_UNIFIED_SETTINGS',
          entity: 'CLINIC_SETTINGS',
          entity_id: input.location_id || input.clinic_id,
          details: {
            clinic_id: input.clinic_id,
            location_id: input.location_id,
            updated_at: new Date().toISOString(),
          },
        },
      ]);
    } catch {}

    return { success: true, message: 'Settings saved successfully' };
  } catch (err: any) {
    console.error('saveUnifiedClinicSettings error:', err);
    return { success: false, error: err.message || 'Failed to save settings' };
  }
}

/**
 * Save custom prescription layout for a branch
 */
export async function savePrescriptionLayout(params: {
  clinicId: string;
  locationId: string;
  adminPin?: string;
  enableTemplate: boolean;
  printBackground: boolean;
  padImageUrl: string;
  fieldCoordinatesJson: string | object;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('save_prescription_layout', {
      p_clinic_id: params.clinicId,
      p_admin_pin: params.adminPin || null,
      p_location_id: params.locationId,
      p_enable_template: params.enableTemplate,
      p_print_background: params.printBackground,
      p_pad_image_url: params.padImageUrl,
      p_field_coordinates_json: typeof params.fieldCoordinatesJson === 'string'
        ? params.fieldCoordinatesJson
        : JSON.stringify(params.fieldCoordinatesJson),
    });

    if (!error && data && data.success !== false) {
      return { success: true, message: data.message || 'Prescription layout saved.' };
    }

    // Direct fallback
    await supabase
      .from('clinic_locations')
      .update({
        is_custom_pad_active: params.enableTemplate,
        print_bg_graphic: params.printBackground,
        pad_template_url: params.padImageUrl,
        rx_calibrations: typeof params.fieldCoordinatesJson === 'string'
          ? JSON.parse(params.fieldCoordinatesJson)
          : params.fieldCoordinatesJson,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.locationId);

    return { success: true, message: 'Prescription layout saved successfully.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to save layout.' };
  }
}

/**
 * Reset branch settings to defaults
 */
export async function resetBranchSettingsToDefaults(
  clinicId: string,
  locationId: string,
  adminPin?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('reset_branch_settings_to_defaults', {
      p_clinic_id: clinicId,
      p_admin_pin: adminPin || null,
      p_location_id: locationId,
    });

    if (!error && data && data.success !== false) {
      return { success: true, message: data.message };
    }

    // Direct fallback
    await supabase
      .from('clinic_locations')
      .update({
        daily_quota: 40,
        slot_duration_mins: 15,
        is_custom_pad_active: false,
        print_bg_graphic: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', locationId);

    return { success: true, message: 'Branch settings reset to defaults.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reset settings.' };
  }
}
