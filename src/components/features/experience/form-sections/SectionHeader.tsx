export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
}) {
  return (
    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
      <span className="bg-primary/10 text-primary p-1.5 rounded-md flex items-center justify-center" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      {title}
    </h2>
  );
}
