import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://nncypksjpfcdjndmoizt.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function uploadToSupabaseStorage({
  bucket = "attachments",
  path,
  buffer,
  contentType,
}: {
  bucket?: string;
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  if (!supabase) {
    console.warn("[Supabase] Storage client not configured. SUPABASE_SERVICE_ROLE_KEY missing.");
    return null;
  }

  try {
    let { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error && (error.message?.includes("Bucket not found") || (error as any).code === "NoSuchBucket" || (error as any).statusCode === "404")) {
      console.log(`[Supabase Storage] Bucket '${bucket}' not found. Auto-creating public bucket...`);
      const { error: createErr } = await supabase.storage.createBucket(bucket, {
        public: true,
      });

      if (!createErr) {
        console.log(`[Supabase Storage] Successfully created bucket '${bucket}'. Retrying file upload...`);
        const retry = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType,
          upsert: true,
        });
        data = retry.data;
        error = retry.error;
      } else {
        console.warn(`[Supabase Storage] Could not auto-create bucket '${bucket}':`, createErr);
      }
    }

    if (error || !data) {
      console.error("[Supabase Storage Error]:", error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.error("[Supabase Storage Upload Exception]:", err);
    return null;
  }
}
