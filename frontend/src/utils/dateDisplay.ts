/** Format ISO calendar dates for display without parsing them or shifting their timezone.
 * Also accepts schedule strings containing multiple dates. Internal calendar keys stay ISO.
 */
export function displayDateText(value: string): string {
  return value.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1');
}
