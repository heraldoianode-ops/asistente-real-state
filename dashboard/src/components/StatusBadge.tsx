interface StatusBadgeProps {
  label: string
  active: boolean
}

export function StatusBadge({ label, active }: StatusBadgeProps) {
  return (
    <span
      data-testid={`badge-${label}`}
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {label}
    </span>
  )
}
