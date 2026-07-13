// The single most important signal on the site: can this Find be reached
// without leaving the terminal? Rendered loud on the Find page, compact in
// lists.

export function AirsideBadge({
  airside,
  size = "large",
}: {
  airside: boolean;
  size?: "large" | "small";
}) {
  const label = airside ? "AIRSIDE" : "LANDSIDE";
  const colours = airside
    ? "bg-green-700 text-white"
    : "bg-amber-500 text-black";

  if (size === "small") {
    return (
      <span
        className={`shrink-0 rounded px-2 py-1 text-xs font-bold tracking-wide ${colours}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className={`rounded px-4 py-3 text-center ${colours}`}>
      <p className="text-2xl font-black tracking-widest">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">
        {airside
          ? "Past security. No re-screening required."
          : "Outside the terminal. Allow time to re-clear security."}
      </p>
    </div>
  );
}
