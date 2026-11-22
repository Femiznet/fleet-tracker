import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlantReportMetrics, PlantSkidUpdate } from '@/frontend/types/plant-report';

type PlantStatusDraft = {
  officersOnDuty: string;
  metrics: PlantReportMetrics;
  skidUpdates: Record<string, PlantSkidUpdate>;
  formattedMessage: string | null;
  setOfficersOnDuty: (value: string) => void;
  setMetrics: (value: PlantReportMetrics) => void;
  setSkidUpdate: (id: string, update: PlantSkidUpdate) => void;
  removeSkidUpdate: (id: string) => void;
  setFormattedMessage: (value: string | null) => void;
  clearAfterSave: () => void;
};

export const usePlantStatusStore = create<PlantStatusDraft>()(
  persist(
    (set) => ({
      officersOnDuty: '',
      metrics: {},
      skidUpdates: {},
      formattedMessage: null,
      setOfficersOnDuty: (value) => set({ officersOnDuty: value, formattedMessage: null }),
      setMetrics: (value) => set({ metrics: value, formattedMessage: null }),
      setSkidUpdate: (id, update) =>
        set((state) => ({
          skidUpdates: { ...state.skidUpdates, [id]: update },
          formattedMessage: null,
        })),
      removeSkidUpdate: (id) =>
        set((state) => {
          const skidUpdates = { ...state.skidUpdates };
          delete skidUpdates[id];
          return { skidUpdates, formattedMessage: null };
        }),
      setFormattedMessage: (value) => set({ formattedMessage: value }),
      clearAfterSave: () =>
        set({
          officersOnDuty: '',
          metrics: {},
          skidUpdates: {},
          formattedMessage: null,
        }),
    }),
    {
      name: 'plant-status-draft',
      partialize: (state) => ({
        officersOnDuty: state.officersOnDuty,
        metrics: state.metrics,
        skidUpdates: state.skidUpdates,
        formattedMessage: state.formattedMessage,
      }),
    }
  )
);
