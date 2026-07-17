export function Footer() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-xl px-4 pb-8 pt-10">
      <p className="text-xs text-muted">
        Revision status: continuous. Distribution: unrestricted.
      </p>
      <p className="mt-3">
        <a
          href="https://buymeacoffee.com/christrott"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support OM-Eat on Buy Me a Coffee"
          className="inline-block rounded bg-[#575757] px-3 py-1.5 font-mono text-xs text-[#ffffff] no-underline"
        >
          <span aria-hidden="true">🛫</span> Buy me a Pastel de Nata
        </a>
      </p>
    </footer>
  );
}
