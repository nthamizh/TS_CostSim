export function LoadingPane({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400 animate-pulse">
      {label}
    </div>
  );
}
export function ErrorPane({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
      <strong>Error: </strong>{message}
    </div>
  );
}
