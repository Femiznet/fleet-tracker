export const one = <T,>(v: T | T[] | null | undefined): T | undefined =>
    Array.isArray(v) ? v[0] : v ?? undefined;