import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const configPath = resolve(root, 'features.config.json');

const featurePackages = {
  customers: {
    directory: 'packages/features/customers',
    packageName: '@fleet/customers',
    entrypoint: 'src/index.ts',
  },
  messages: {
    directory: 'packages/features/messages',
    packageName: '@fleet/messages',
    entrypoint: 'index.ts',
  },
  movements: {
    directory: 'packages/features/movements',
    packageName: '@fleet/movements',
    entrypoint: 'index.ts',
  },
  'customer-skid-loadings': {
    directory: 'packages/features/customer-skid-loadings',
    packageName: '@fleet/customer-skid-loadings',
    entrypoint: 'index.ts',
  },
  'plant-status': {
    directory: 'packages/features/plant-status',
    packageName: '@fleet/plant-status',
    entrypoint: 'index.ts',
  },
  trucks: {
    directory: 'packages/features/trucks',
    packageName: '@fleet/trucks',
    entrypoint: 'index.ts',
  },
} as const;

type FeatureId = keyof typeof featurePackages;
type FeatureConfig = {
  required: boolean;
  dependencies: FeatureId[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFeatureConfig(): Record<FeatureId, FeatureConfig> {
  const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!isRecord(parsed) || !isRecord(parsed.features)) {
    throw new Error('features.config.json must contain a features object');
  }

  const featureIds = Object.keys(featurePackages) as FeatureId[];
  for (const id of Object.keys(parsed.features)) {
    if (!featureIds.includes(id as FeatureId)) {
      throw new Error(`Unknown feature "${id}" in features.config.json`);
    }
  }

  const config = {} as Record<FeatureId, FeatureConfig>;
  for (const id of featureIds) {
    const feature = parsed.features[id];
    if (
      !isRecord(feature) ||
      typeof feature.required !== 'boolean' ||
      !Array.isArray(feature.dependencies) ||
      !feature.dependencies.every(
        (dependency): dependency is FeatureId =>
          typeof dependency === 'string' &&
          featureIds.includes(dependency as FeatureId),
      )
    ) {
      throw new Error(
        `Feature "${id}" must define required and a valid dependencies array`,
      );
    }

    config[id] = {
      required: feature.required,
      dependencies: feature.dependencies,
    };
  }

  return config;
}

export function isFeatureAvailable(featureId: FeatureId): boolean {
  const config = readFeatureConfig();
  const resolving = new Set<FeatureId>();

  function resolveFeature(id: FeatureId): boolean {
    if (resolving.has(id)) {
      throw new Error(`Feature dependency cycle detected at "${id}"`);
    }

    const definition = config[id];
    const packageInfo = featurePackages[id];
    const featureDirectory = resolve(root, packageInfo.directory);
    const installed = existsSync(featureDirectory);

    if (!installed) {
      if (definition.required) {
        throw new Error(
          `Required feature "${id}" is missing at ${packageInfo.directory}`,
        );
      }
      return false;
    }

    const packageManifestPath = resolve(featureDirectory, 'package.json');
    if (!existsSync(packageManifestPath)) {
      throw new Error(`Feature "${id}" is missing package.json`);
    }

    const packageManifest: unknown = JSON.parse(
      readFileSync(packageManifestPath, 'utf8'),
    );
    if (
      !isRecord(packageManifest) ||
      packageManifest.name !== packageInfo.packageName
    ) {
      throw new Error(
        `Feature "${id}" must have package name "${packageInfo.packageName}"`,
      );
    }

    if (!existsSync(resolve(featureDirectory, packageInfo.entrypoint))) {
      throw new Error(`Feature "${id}" is missing ${packageInfo.entrypoint}`);
    }

    resolving.add(id);
    const dependenciesAvailable = definition.dependencies.every(resolveFeature);
    resolving.delete(id);

    if (!dependenciesAvailable && definition.required) {
      throw new Error(`Required feature "${id}" has an unavailable dependency`);
    }

    return dependenciesAvailable;
  }

  return resolveFeature(featureId);
}
