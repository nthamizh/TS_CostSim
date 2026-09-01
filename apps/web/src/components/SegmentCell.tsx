export function SegmentCell({ v, s, old, isFirst }: { v: string|null; s?: string; old?: string|null; isFirst?: boolean }) {
  const border = isFirst ? "border-l-2 border-gray-300 " : "";
  if (!v) return <td className={`${border}px-2 py-2 text-center font-mono text-xs text-gray-300`}>-</td>;
  const cls =
    s === "s-ff"    ? "bg-amber-50 text-amber-700 font-semibold" :
    s === "s-pers"  ? "bg-blue-50 text-blue-700" :
    s === "s-dept"  ? "bg-purple-50 text-purple-700" :
    s === "s-elig"  ? "bg-green-50 text-green-700 font-semibold" :
    s === "s-cost"  ? "bg-gray-100 text-gray-500" :
    s === "s-ppg"   ? "bg-teal-50 text-teal-700 font-semibold" :
    s === "s-segov" ? "bg-pink-50 text-pink-700 font-semibold" :
    "text-gray-700";
  return (
    <td className={`${border}px-2 py-2 text-center font-mono text-xs ${cls}`}>
      {v}
      {old !== null && old !== undefined && old !== "" && (
        <span className="block text-[9px] text-gray-400 line-through">{old}</span>
      )}
    </td>
  );
}

export function SegmentHeaders({ segs, firstBorder }: { segs: readonly string[]; firstBorder?: boolean }) {
  return (
    <>
      {segs.map((s, i) => (
        <th key={s} className={`px-2 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap ${i === 0 && firstBorder ? "border-l-2 border-gray-200" : ""}`}>
          {s}
        </th>
      ))}
    </>
  );
}
