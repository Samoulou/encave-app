/**
 * Get initials from a name (first letter of first and last name).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]?.substring(0, 2).toUpperCase() ?? '';
  }
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
