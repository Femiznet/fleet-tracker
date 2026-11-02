"use server";

import {
  saveAiProvider,
  listAiProviders,
  activateAiProvider,
  deactivateAiProvider,
  deleteAiProvider,
} from "./providers";

export async function saveAiProviderAction(input: {
  provider: string;
  model: string;
  apiKey: string;
}) {
  return saveAiProvider(input);
}

export async function listAiProvidersAction() {
  return listAiProviders();
}

export async function activateAiProviderAction(id: string) {
  return activateAiProvider(id);
}

export async function deactivateAiProviderAction(id: string) {
  return deactivateAiProvider(id);
}

export async function deleteAiProviderAction(id: string) {
  return deleteAiProvider(id);
}

// Test

import { testAiProvider } from "./providers";

export async function testAiProviderAction(id: string) {
  return testAiProvider(id);
}