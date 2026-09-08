export function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value ?? 0);
}

export function dateLabel(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Not scheduled';
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric' }).format(parsed);
}

export function dateRange(start: string, end: string) {
  return `${dateLabel(start)} – ${dateLabel(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
}
