import { supabase } from "./supabase";
import type { GarageData } from "./types";

const bucket = "garage-private-files";
const marker = "garage-storage://";

function extension(mime: string) {
  return ({
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "image/avif": "avif", "application/pdf": "pdf",
  } as Record<string, string>)[mime] ?? "bin";
}

async function storeDataUrl(value: string, userId: string, folder: string) {
  if (!supabase || !value.startsWith("data:")) return value;
  const blob = await fetch(value).then((response) => response.blob());
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `${userId}/${folder}/${hash}.${extension(blob.type)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
    cacheControl: "3600",
  });
  if (error) throw error;
  return marker + path;
}

async function restoreDataUrl(value: string) {
  if (!supabase || !value.startsWith(marker)) return value;
  const path = value.slice(marker.length);
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("A backed-up garage file could not be restored."));
    reader.readAsDataURL(data);
  });
}

export async function prepareCloudData(data: GarageData, userId: string) {
  const copy = structuredClone(data);
  copy.vehicle.photo = await storeDataUrl(copy.vehicle.photo, userId, "vehicle");
  for (const document of copy.documents)
    document.data = await storeDataUrl(document.data, userId, `documents/${document.id}`);
  return copy;
}

export async function restoreCloudFiles(data: GarageData) {
  const copy = structuredClone(data);
  copy.vehicle.photo = await restoreDataUrl(copy.vehicle.photo);
  for (const document of copy.documents)
    document.data = await restoreDataUrl(document.data);
  return copy;
}
