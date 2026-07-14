// The storage bucket was created in the dashboard as "Find-images"
// (capital F) — the docs say find-images, but the name is load-bearing:
// this constant must match the dashboard exactly.
export const FIND_IMAGES_BUCKET = "Find-images";

// Public URL for an object in the find-images bucket.
export function findImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${FIND_IMAGES_BUCKET}/${storagePath}`;
}
