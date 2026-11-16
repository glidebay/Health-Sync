'use client';

import { useState, useEffect, useCallback } from 'react';
import { enterpriseCLMSService } from '@/lib/enterpriseCLMSService';

export interface UseAnalyticsDashboardParams {
  locationId?: string | null;
  clinicId?: string | null;
  doctorId?: string | null;
  loggedDoctorId?: string | null;
}

export function useAnalyticsDashboard({
  locationId,
  clinicId,
  doctorId,
  loggedDoctorId,
}: UseAnalyticsDashboardParams = {}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await enterpriseCLMSService.fetchFullAnalyticsDashboard({
        locationId: locationId || undefined,
        clinicId: clinicId || undefined,
        doctorId: doctorId || undefined,
        loggedDoctorId: loggedDoctorId || undefined,
      });

      if (res) {
        setData(res as Record<string, unknown>);
        setError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics dashboard';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [locationId, clinicId, doctorId, loggedDoctorId]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const res = await enterpriseCLMSService.fetchFullAnalyticsDashboard({
          locationId: locationId || undefined,
          clinicId: clinicId || undefined,
          doctorId: doctorId || undefined,
          loggedDoctorId: loggedDoctorId || undefined,
        });

        if (isMounted && res) {
          setData(res as Record<string, unknown>);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load analytics dashboard';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [locationId, clinicId, doctorId, loggedDoctorId]);

  const scope = (data?.scope as Record<string, unknown> | undefined) || null;

  return {
    data,
    loading,
    error,
    refetch,
    scope,
  };
}

export default useAnalyticsDashboard;
