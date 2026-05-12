export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
  title: string;
}) {
  return (
    <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
      <span
        className="flex items-center justify-center rounded-md bg-primary/10 p-1.5 text-primary"
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      {title}
    </h2>
  );
}
