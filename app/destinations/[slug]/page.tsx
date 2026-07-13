import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { AirsideBadge } from "@/app/finds/airside-badge";

export const revalidate = 60;

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: destination } = await supabase
    .from("destinations")
    .select("id, iata, city, country")
    .eq("slug", slug)
    .maybeSingle();

  if (!destination) notFound();

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
      <p className="text-sm text-neutral-600">{destination.country}</p>

      {!finds?.length ? (
        <section className="mt-10 rounded border border-neutral-400 p-6 text-center">
          <p className="text-base font-semibold">
            Nothing found here yet. Be the first.
          </p>
          <Link
            href="/add"
            className="mt-4 inline-block rounded bg-black px-6 py-3 font-bold text-white"
          >
            Add a Find
          </Link>
        </section>
      ) : (
        <ul className="mt-6">
          {finds.map((f) => (
            <li key={f.id} className="border-b border-neutral-300">
              <Link href={`/finds/${f.id}`} className="block py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{f.dish}</p>
                    <p className="text-sm">{f.place}</p>
                    {f.walking_time && (
                      <p className="mt-1 text-xs text-neutral-600">
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
  const city = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { title: `${city} — OMEat` };
}
