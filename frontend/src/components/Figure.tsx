interface FigureProps {
  label: string;
  value: string | number;
  /** Makes this the one emphasised figure in its row. */
  strong?: boolean;
}

/** A single headline number with its label, used on the dashboard and the booking page. */
export function Figure({ label, value, strong }: FigureProps) {
  return (
    <div className={strong ? 'figure figure-strong' : 'figure'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
