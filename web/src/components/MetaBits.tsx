// Small inline display helpers for rating + price level, reused across cards.

export function priceLabel(level: number | null | undefined): string {
  if (!level || level < 1) return "";
  return "$".repeat(Math.min(level, 4));
}

export function Rating({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-600">
      <span aria-hidden>★</span>
      {value.toFixed(1)}
    </span>
  );
}

export function Meta({
  cuisine,
  rating,
  price,
}: {
  cuisine?: string | null;
  rating?: number | null;
  price?: number | null;
}) {
  const parts: React.ReactNode[] = [];
  if (cuisine) parts.push(<span key="c">{cuisine}</span>);
  if (rating != null) parts.push(<Rating key="r" value={rating} />);
  const p = priceLabel(price);
  if (p) parts.push(<span key="p" className="text-emerald-700">{p}</span>);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
      {parts.map((node, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-300">·</span>}
          {node}
        </span>
      ))}
    </div>
  );
}
