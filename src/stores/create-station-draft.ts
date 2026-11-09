"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type StationDraft = {
  email: string;
  name: string;
  type: string;
  distance: string;
  location: string;
  latitude: string;
  longitude: string;
};

type StationDraftStore = StationDraft & {
  setField: (field: keyof StationDraft, value: string) => void;
  clear: () => void;
};

const emptyDraft: StationDraft = {
  email: "",
  name: "",
  type: "",
  distance: "",
  location: "",
  latitude: "",
  longitude: "",
};

export const useCreateStationDraft = create<StationDraftStore>()(
  persist(
    (set) => ({
      ...emptyDraft,
      setField: (field, value) => set({ [field]: value }),
      clear: () => set(emptyDraft),
    }),
    {
      name: "fleet-tracker:create-station-draft",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        email: state.email,
        name: state.name,
        type: state.type,
        distance: state.distance,
        location: state.location,
        latitude: state.latitude,
        longitude: state.longitude,
      }),
    }
  )
);
