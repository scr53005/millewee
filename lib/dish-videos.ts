/**
 * Pilot map of dish_id -> video URL (Vercel Blob).
 *
 * Temporary mechanism to test the "Instagram-style" autoplay video on a single
 * dish before deciding whether to promote this to a `video_url` column on the
 * dish table. Keep this small — if the pilot works and we want it on more
 * than ~3 dishes, migrate to the DB.
 *
 * Videos must be:
 *   - Encoded H.264, 480-540p, ~800 kbps, muted, looping.
 *   - Hosted on the millewee-media Vercel Blob store (CDN-edge served).
 *   - Uploaded via `npx tsx scripts/upload-to-blob.ts <local> <dest>`.
 */
export const DISH_VIDEOS: Record<number, string> = {
  33: 'https://zimldlocanl3upzw.public.blob.vercel-storage.com/videos/dishes/cheeseburger.mp4',
};

export function getDishVideoUrl(dishId: number): string | null {
  return DISH_VIDEOS[dishId] ?? null;
}
