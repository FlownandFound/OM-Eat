import { createPublicClient } from "@/lib/supabase/public";
import { SubmissionForm } from "./submission-form";

export const revalidate = 3600;

export const metadata = {
  title: "Add a Find — OMEat",
};

export default async function AddFindPage() {
  const supabase = createPublicClient();
  const { data: destinations } = await supabase
    .from("destinations")
    .select("id, iata, city, country")
    .order("city");

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">Add a Find</h1>
      <p className="mt-2 text-sm">
        Report one specific thing to eat, at one specific place, at one
        destination. Entries are reviewed by a curator before publication.
      </p>
      <SubmissionForm destinations={destinations ?? []} />
    </main>
  );
}
