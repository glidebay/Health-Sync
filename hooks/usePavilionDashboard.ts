'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  enterpriseCLMSService,
  PavilionDashboardData,
  DashboardScope,
} from '@/lib/enterpriseCLMSService';
import { subscribeToClinicUpdates } from '@/lib/supabaseService';

export interface UsePavilionDashboardParams {
  locationId?: string | null;
  clinicId?: string | null;
  doctorId?: string | null;
  loggedDoctorId?: string | null;
  pollInterval?: number;
}

export function usePavilionDashboard({
  locationId,
  clinicId,
  doctorId,
  loggedDoctorId,
  pollInterval = 0,
}: UsePavilionDashboardParams = {}) {
  const [data, setData] = useState<PavilionDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const summary = await enterpriseCLMSService.fetchPavilionDashboardSummary({
        locationId: locationId || undefined,
        clinicId: clinicId || undefined,
        doctorId: doctorId || undefined,
        loggedDoctorId: loggedDoctorId || undefined,
      });

      if (summary) {
        setData(summary);
        setError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load pavilion summary';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [locationId, clinicId, doctorId, loggedDoctorId]);

  useEffect(() => {
    let isMounted = true;

    const runFetch = async () => {
      try {
        const summary = await enterpriseCLMSService.fetchPavilionDashboardSummary({
          locationId: locationId || undefined,
          clinicId: clinicId || undefined,
          doctorId: doctorId || undefined,
          loggedDoctorId: loggedDoctorId || undefined,
        });

        if (isMounted && summary) {
          setData(summary);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load pavilion summary';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void runFetch();

    // Event-driven Realtime subscription: updates automatically on DB mutations
    const unsubscribe = subscribeToClinicUpdates(() => {
      void runFetch();
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    if (pollInterval > 0) {
      timer = setInterval(() => {
        void runFetch();
      }, pollInterval);
    }

    return () => {
      isMounted = false;
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [locationId, clinicId, doctorId, loggedDoctorId, pollInterval]);

  const scope: DashboardScope | null = data?.scope || null;
  const isAdmin = Boolean(scope?.is_admin);
  const accessibleBranches = data?.accessible_branches || [];
  const accessibleDoctors = data?.accessible_doctors || [];

  return {
    data,
    loading,
    error,
    refresh,
    isAdmin,
    scope,
    accessibleBranches,
    accessibleDoctors,
  };
}

export default usePavilionDashboard;
