import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { AirsideBadge } from "@/app/finds/airside-badge";
import { countryFlag } from "@/lib/countries";

export const revalidate = 60;

// Crew know the airport codes, so /destinations/SZG (any case) is the
// canonical URL; the old city slugs keep working. The lookup builds a
// PostgREST `or` filter by string, so the slug is checked against the shape
// both columns actually hold first — a comma or bracket from the URL would
// otherwise be read as filter syntax. cache() keeps the page and its
// generateMetadata to a single query per request.
const SLUG_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

const getDestination = cache(async (slug: string) => {
  if (!SLUG_PATTERN.test(slug)) return null;

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("destinations")
    .select("id, iata, city, country")
    .or(`iata.eq.${slug.toUpperCase()},slug.eq.${slug.toLowerCase()}`)
    .maybeSingle();

  return data;
});

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getDestination(slug);

  if (!destination) notFound();

  const supabase = createPublicClient();
  const { data: finds } = await supabase
    .from("finds")
    .select("id, dish, place, airside, walking_time")
    .eq("destination_id", destination.id)
    .eq("status", "published")
    .order("created_at");

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="font-mono text-sm font-bold">{destination.iata}</p>
      <h1 className="text-2xl font-bold">{destination.city}</h1>
      <p className="text-sm text-secondary">
        <span aria-hidden="true">{countryFlag(destination.country)}</span>{" "}
        {destination.country}
      </p>

      {!finds?.length ? (
        <section className="mt-10 rounded border border-line bg-surface p-6 text-center">
          <p className="font-sans text-lg font-bold">
            Nothing found here yet. Be the first.
          </p>
          <Link
            href={`/add?destination=${destination.iata}`}
            className="mt-4 inline-block rounded border-2 border-ink bg-ink px-6 py-3 font-sans font-bold text-page no-underline"
          >
            Add a Find
          </Link>
        </section>
      ) : (
        <>
          <ul className="mt-6">
            {finds.map((f) => (
              <li key={f.id} className="border-b border-line">
                <Link
                  href={`/finds/${f.id}`}
                  className="block py-4 text-ink no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-lg font-bold">{f.dish}</p>
                      <p className="text-sm">{f.place}</p>
                      {f.walking_time && (
                        <p className="mt-1 text-xs text-muted">
                          {f.walking_time} on foot
                        </p>
                      )}
                    </div>
                    <AirsideBadge airside={f.airside} size="small" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href={`/add?destination=${destination.iata}`}
              className="block w-full rounded border-2 border-ink px-4 py-3 text-center font-sans font-bold text-ink no-underline"
            >
              Add a Find at {destination.city}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getDestination(slug);
  if (!destination) return { title: "OM-Eat" };
  return { title: `${destination.iata} ${destination.city} — OM-Eat` };
}
