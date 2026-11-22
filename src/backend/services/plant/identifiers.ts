export function plantDisplayNumber(slugNum: string | null, fullNumber: string, digits: number) {
  const slugDigits = slugNum?.replace(/\D/g, '') ?? '';
  return slugDigits ? slugDigits.slice(-digits) : fullNumber;
}
