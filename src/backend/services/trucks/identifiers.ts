export function deriveTruckSlugNumber(plateNumber: string) {
  return plateNumber.match(/\d+/g)?.join('') || null;
}
