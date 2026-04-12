'use client';

interface AllergenInfo {
  icon: string | null;
  name: string;
}

export function AllergenIcons({ allergens }: { allergens: AllergenInfo[] }) {
  if (allergens.length === 0) return null;

  return (
    <span className="inline-flex gap-0.5 flex-wrap">
      {allergens.map((a, i) => (
        <span key={i} title={a.name} className="text-sm leading-none cursor-default">
          {a.icon || '⚠'}
        </span>
      ))}
    </span>
  );
}
