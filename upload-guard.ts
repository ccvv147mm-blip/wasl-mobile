/**
 * Client-side upload allowlist.
 * Mirrors the storage RLS check `public.storage_mime_allowed(...)`:
 * only these MIME types / extensions are accepted by the buckets.
 */
export type MediaKind = "image" | "video" | "audio" | "pdf";

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/oga": "oga",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
};

const PDF_EXT: Record<string, string> = { "application/pdf": "pdf" };

const TABLES: Record<MediaKind, Record<string, string>> = {
  image: IMAGE_EXT,
  video: VIDEO_EXT,
  audio: AUDIO_EXT,
  pdf: PDF_EXT,
};

const LABELS: Record<MediaKind, string> = {
  image: "صور (JPG, PNG, WEBP, GIF)",
  video: "فيديو (MP4, WEBM, MOV)",
  audio: "صوت (WEBM, MP3, M4A, OGG, WAV)",
  pdf: "ملف PDF",
};

/** Normalized MIME type without codec parameters. */
export function baseMime(type: string | undefined | null): string {
  return (type ?? "").split(";")[0]!.trim().toLowerCase();
}

/**
 * Validates a file against the allowed media kinds and returns the safe
 * content type + file extension to upload with. Throws an Arabic error
 * when the file type is not allowed.
 */
export function assertAllowedUpload(
  file: { type?: string; name?: string },
  kinds: MediaKind[],
): { contentType: string; ext: string } {
  const mime = baseMime(file.type);
  for (const kind of kinds) {
    const ext = TABLES[kind][mime];
    if (ext) return { contentType: mime, ext };
  }
  throw new Error(`نوع الملف غير مسموح. المسموح: ${kinds.map((k) => LABELS[k]).join(" أو ")}`);
}
