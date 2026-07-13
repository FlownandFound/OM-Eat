import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// Public submission intake. Open but moderated: everything lands in the
// submissions queue as 'pending' and never appears on the site until a
// curator publishes it. Written with the service role key — the anon key
// has no insert policy anywhere.

const PAYMENT_OPTIONS = ["cash", "card", "both"] as const;

const logged = () =>
  NextResponse.json({ message: "Submission logged. A curator will review." });

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed.length > maxLength ? null : trimmed;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: humans never see or fill this field. Report success and
  // insert nothing.
  if (typeof body.website === "string" && body.website !== "") {
    return logged();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`submissions:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Submission limit reached. Try again later." },
      { status: 429 },
    );
  }

  // Required fields.
  const destinationId = text(body.destination_id, 36);
  const dish = text(body.dish, 200);
  const place = text(body.place, 200);
  const airside =
    body.airside === true ? true : body.airside === false ? false : null;

  if (!destinationId || !dish || !place || airside === null) {
    return NextResponse.json(
      { error: "Destination, dish, place, and airside/landside are required." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: destination } = await supabase
    .from("destinations")
    .select("id")
    .eq("id", destinationId)
    .maybeSingle();
  if (!destination) {
    return NextResponse.json({ error: "Unknown destination." }, { status: 400 });
  }

  // Optional fields.
  const costAmount = text(body.cost_amount, 12);
  if (costAmount !== null && !/^\d+([.,]\d{1,2})?$/.test(costAmount)) {
    return NextResponse.json({ error: "Cost must be a number." }, { status: 400 });
  }

  const costCurrency = text(body.cost_currency, 3)?.toUpperCase() ?? null;
  if (costCurrency !== null && !/^[A-Z]{3}$/.test(costCurrency)) {
    return NextResponse.json(
      { error: "Currency must be a three-letter code." },
      { status: 400 },
    );
  }

  const payment = text(body.payment, 10);
  if (
    payment !== null &&
    !PAYMENT_OPTIONS.includes(payment as (typeof PAYMENT_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }

  const mapsUrl = airside ? null : text(body.maps_url, 500);
  if (mapsUrl !== null && !/^https?:\/\//.test(mapsUrl)) {
    return NextResponse.json(
      { error: "Map link must be a full web address." },
      { status: 400 },
    );
  }

  const payload = {
    destination_id: destination.id,
    dish,
    place,
    airside,
    terminal_area: text(body.terminal_area, 200),
    walking_time: text(body.walking_time, 100),
    cost_amount: costAmount ? costAmount.replace(",", ".") : null,
    cost_currency: costCurrency,
    payment,
    opening_hours: text(body.opening_hours, 200),
    directions: text(body.directions, 2000),
    maps_url: mapsUrl,
  };

  const { error } = await supabase.from("submissions").insert({
    type: "new_find",
    payload,
    submitter_display: text(body.submitter_display, 40),
    status: "pending",
  });

  if (error) {
    return NextResponse.json(
      { error: "Submission could not be logged. Try again." },
      { status: 500 },
    );
  }

  return logged();
}
