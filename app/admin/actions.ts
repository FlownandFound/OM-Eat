"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { FIND_IMAGES_BUCKET } from "@/lib/images";

// Curator queue actions. All writes go through the curator's authenticated
// client, so RLS (not the service key) is the authority here — an
// unauthenticated caller gets a database error, not a published Find.

// The submission payload fields that map 1:1 onto finds columns. Anything
// else in the payload (e.g. an update's `body`) never reaches the table.
const FIND_FIELDS = [
  "destination_id",
  "dish",
  "place",
  "airside",
  "walking_time",
  "cost_amount",
  "payment",
  "opening_hours",
  "directions",
  "maps_url",
] as const;

type Payload = Record<string, unknown>;

// Submission photo paths, uploaded to storage by the public intake route
// and only linked to a Find here, at publication.
function imagePaths(payload: Payload): string[] {
  return Array.isArray(payload.image_paths)
    ? payload.image_paths.filter((p): p is string => typeof p === "string")
    : [];
}

// Curator-entered fields follow the public intake's format rules. Without
// this, an unparseable price silently became null and a maps_url of any
// shape landed in a public href.
function findFieldsError(payload: Payload): string | null {
  const cost = payload.cost_amount;
  if (
    cost != null &&
    cost !== "" &&
    !/^\d+([.,]\d{1,2})?$/.test(String(cost).trim())
  ) {
    return "Price must be a plain number, e.g. 4.50.";
  }
  const maps = payload.maps_url;
  if (maps != null && maps !== "" && !/^https?:\/\//.test(String(maps))) {
    return "Map link must be a full web address (https://…).";
  }
  return null;
}

// Payload → finds row. Not exported: a "use server" module may only
// export async actions.
function mapPayloadToFind(payload: Payload): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of FIND_FIELDS) {
    row[field] = payload[field] ?? null;
  }

  // Price is stored in the payload as a string (JSON survives curator edits
  // losslessly that way); it becomes numeric here, at publication.
  const cost = Number(String(payload.cost_amount ?? "").replace(",", "."));
  row.cost_amount =
    payload.cost_amount != null &&
    payload.cost_amount !== "" &&
    Number.isFinite(cost)
      ? cost
      : null;

  const qty = Number(payload.cost_qty);
  row.cost_qty = Number.isInteger(qty) && qty >= 1 && qty <= 99 ? qty : 1;

  // Database check constraint: maps_url is landside only.
  if (row.airside === true) row.maps_url = null;

  // Checkbox semantics: absent or anything but true means false.
  row.crew_discount = payload.crew_discount === true;

  return row;
}

export async function publishNewFind(
  submissionId: string,
  edits?: Payload,
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, type, payload, submitter_display, status")
    .eq("id", submissionId)
    .eq("type", "new_find")
    .eq("status", "pending")
    .maybeSingle();
  if (!submission) return { error: "Submission not found or already handled." };

  // "Edit then publish": curator field edits overlay the payload.
  const merged = { ...submission.payload, ...edits };
  const fieldsError = findFieldsError(merged);
  if (fieldsError) return { error: fieldsError };

  const find = mapPayloadToFind(merged);
  if (find.airside == null) {
    return { error: "State whether the Find is airside or landside." };
  }
  find.submitter_display = submission.submitter_display;
  find.status = "published";

  // Claim the submission first (compare-and-set on status): if the insert
  // below fails partway, a retry — or a second curator — must not be able
  // to publish the same submission twice.
  const { data: claimed, error: claimError } = await supabase
    .from("submissions")
    .update({ status: "published" })
    .eq("id", submission.id)
    .eq("status", "pending")
    .select("id");
  if (claimError) return { error: claimError.message };
  if (!claimed?.length) {
    return { error: "Submission not found or already handled." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("finds")
    .insert(find)
    .select("id")
    .single();
  if (insertError || !inserted) {
    // Nothing was published; release the claim so the curator can retry.
    await supabase
      .from("submissions")
      .update({ status: "pending" })
      .eq("id", submission.id);
    return { error: insertError?.message ?? "Publish failed." };
  }

  const paths = imagePaths(submission.payload);
  if (paths.length > 0) {
    const { error: imagesError } = await supabase.from("find_images").insert(
      paths.map((path, index) => ({
        find_id: inserted.id,
        storage_path: path,
        alt_text: String(find.dish ?? "Find photo"),
        sort_order: index,
      })),
    );
    // The Find is live, so the claim must stand — releasing it would let a
    // retry publish a duplicate. Report the photos separately.
    if (imagesError) {
      revalidatePath("/", "layout");
      return {
        error: `Published, but the photos failed to attach (${imagesError.message}). Add them from the Finds editor.`,
      };
    }
  }

  revalidatePath("/", "layout");
  return {};
}

// Publishing an update never auto-applies: the curator reviews the diff and
// sends only the fields they accept.
export async function applyUpdate(
  submissionId: string,
  acceptedFields: Payload,
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, find_id, status, payload")
    .eq("id", submissionId)
    .eq("type", "update")
    .eq("status", "pending")
    .maybeSingle();
  if (!submission || !submission.find_id)
    return { error: "Submission not found or already handled." };

  const fieldsError = findFieldsError(acceptedFields);
  if (fieldsError) return { error: fieldsError };

  const changes = mapPayloadToFind(acceptedFields);
  // Only touch columns the curator explicitly accepted.
  for (const key of Object.keys(changes)) {
    if (!(key in acceptedFields)) delete changes[key];
  }
  delete changes.destination_id; // updates never move a Find

  // The database forbids a map link on an airside Find. Resolve that rule
  // here so the curator gets a plain answer, not a raw constraint error.
  if (changes.airside === true) {
    // Going airside clears any existing map link.
    changes.maps_url = null;
  } else if (changes.maps_url != null && changes.airside !== false) {
    const { data: current } = await supabase
      .from("finds")
      .select("airside")
      .eq("id", submission.find_id)
      .maybeSingle();
    if (current?.airside !== false) {
      return {
        error:
          "Map link not applied: this Find is airside and map links are landside only. Untick it and apply again.",
      };
    }
  }

  // Claim the submission first (compare-and-set on status) so a retry after
  // a partial failure, or a second curator, cannot apply it twice — photo
  // rows in particular would otherwise duplicate.
  const { data: claimed, error: claimError } = await supabase
    .from("submissions")
    .update({ status: "published" })
    .eq("id", submission.id)
    .eq("status", "pending")
    .select("id");
  if (claimError) return { error: claimError.message };
  if (!claimed?.length) {
    return { error: "Submission not found or already handled." };
  }
  const releaseClaim = () =>
    supabase
      .from("submissions")
      .update({ status: "pending" })
      .eq("id", submission.id);

  if (Object.keys(changes).length > 0) {
    const { error } = await supabase
      .from("finds")
      .update(changes)
      .eq("id", submission.find_id);
    if (error) {
      await releaseClaim();
      return { error: error.message };
    }
  }

  // Photos: attach only the paths the curator accepted, and only ones that
  // actually came with this submission — never arbitrary client strings.
  const submittedPaths = imagePaths(submission.payload ?? {});
  const acceptedPaths = imagePaths(acceptedFields).filter((path) =>
    submittedPaths.includes(path),
  );
  if (acceptedPaths.length > 0) {
    const { data: find } = await supabase
      .from("finds")
      .select("dish")
      .eq("id", submission.find_id)
      .maybeSingle();
    const { count } = await supabase
      .from("find_images")
      .select("id", { count: "exact", head: true })
      .eq("find_id", submission.find_id);
    const { error: imagesError } = await supabase.from("find_images").insert(
      acceptedPaths.map((path, index) => ({
        find_id: submission.find_id,
        storage_path: path,
        alt_text: String(find?.dish ?? "Find photo"),
        sort_order: (count ?? 0) + index,
      })),
    );
    if (imagesError) {
      // Field changes are idempotent, so releasing the claim makes a clean
      // retry possible.
      await releaseClaim();
      return { error: imagesError.message };
    }
  }

  // Unaccepted photos never reach the Find; clear them from storage.
  // Best-effort, as in rejectSubmission.
  const leftover = submittedPaths.filter(
    (path) => !acceptedPaths.includes(path),
  );
  if (leftover.length > 0) {
    await createServiceClient()
      .storage.from(FIND_IMAGES_BUCKET)
      .remove(leftover);
  }

  revalidatePath("/", "layout");
  return {};
}

// Full edit of an existing Find from /admin/finds/[id]. The form sends
// every field; empty means null, deliberately — this is the whole record.
export async function updateFind(
  findId: string,
  fields: Payload,
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const fieldsError = findFieldsError(fields);
  if (fieldsError) return { error: fieldsError };

  const changes = mapPayloadToFind(fields);
  delete changes.destination_id; // edits never move a Find
  if (changes.airside == null) {
    return { error: "State whether the Find is airside or landside." };
  }

  const { error } = await supabase
    .from("finds")
    .update(changes)
    .eq("id", findId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function setFindStatus(
  findId: string,
  status: "published" | "archived",
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const { error } = await supabase
    .from("finds")
    .update({ status })
    .eq("id", findId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

// Curator adds photos directly to a published Find. The database writes go
// through the authenticated client (RLS authority); storage uses the service
// key, so the session is checked explicitly first.
export async function addFindImages(
  findId: string,
  dataUrls: string[],
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: find } = await supabase
    .from("finds")
    .select("id, dish")
    .eq("id", findId)
    .maybeSingle();
  if (!find) return { error: "Find not found." };

  const { count } = await supabase
    .from("find_images")
    .select("id", { count: "exact", head: true })
    .eq("find_id", findId);
  const existing = count ?? 0;
  if (existing + dataUrls.length > 3) {
    return { error: "A Find carries at most 3 photos." };
  }

  const storage = createServiceClient().storage.from(FIND_IMAGES_BUCKET);

  for (const [index, dataUrl] of dataUrls.entries()) {
    const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { error: "Photos must be attached via the form." };
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > 1024 * 1024) {
      return { error: "Each photo must be under 1 MB." };
    }

    const path = `finds/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: "image/jpeg",
    });
    if (uploadError) return { error: "Photo upload failed. Try again." };

    const { error: insertError } = await supabase.from("find_images").insert({
      find_id: findId,
      storage_path: path,
      alt_text: String(find.dish ?? "Find photo"),
      sort_order: existing + index,
    });
    if (insertError) {
      await storage.remove([path]);
      return { error: insertError.message };
    }
  }

  revalidatePath("/", "layout");
  return {};
}

export async function removeFindImage(
  imageId: string,
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: image } = await supabase
    .from("find_images")
    .select("id, storage_path")
    .eq("id", imageId)
    .maybeSingle();
  if (!image) return { error: "Photo not found." };

  const { error } = await supabase
    .from("find_images")
    .delete()
    .eq("id", imageId);
  if (error) return { error: error.message };

  // Best-effort storage cleanup; the record removal has already succeeded.
  await createServiceClient()
    .storage.from(FIND_IMAGES_BUCKET)
    .remove([image.storage_path]);

  revalidatePath("/", "layout");
  return {};
}

export async function rejectSubmission(
  submissionId: string,
): Promise<{ error?: string }> {
  const supabase = await createAuthClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, payload")
    .eq("id", submissionId)
    .eq("status", "pending")
    .maybeSingle();
  if (!submission) return { error: "Submission not found or already handled." };

  const { error } = await supabase
    .from("submissions")
    .update({ status: "rejected" })
    .eq("id", submission.id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  // Rejected photos never reach a Find; remove them from storage so the
  // 1 GB bucket only holds published or pending images. Best-effort: the
  // rejection itself has already succeeded under RLS.
  const paths = imagePaths(submission.payload ?? {});
  if (paths.length > 0) {
    await createServiceClient()
      .storage.from(FIND_IMAGES_BUCKET)
      .remove(paths);
  }

  revalidatePath("/admin");
  return {};
}
