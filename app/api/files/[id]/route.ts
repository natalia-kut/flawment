import { currentUser } from "@/lib/auth/session";
import { FileError, readFile, recordId } from "@/lib/files/service";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  // Whatever the file holds, it may not run or load anything here.
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** A download; images may also be shown (?view) and have a small preview (?thumbnail). */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const actor = await currentUser();
  if (!actor) return new Response(null, { status: 401, headers });
  const query = new URL(request.url).searchParams;
  let id: number;
  try { id = recordId((await params).id); } catch (error) {
    if (error instanceof FileError) return new Response(null, { status: 404, headers });
    throw error;
  }
  const file = await readFile(actor, id, query.has("thumbnail"));
  if (!file) return new Response(null, { status: 404, headers });
  const inline = file.type.startsWith("image/") && (query.has("thumbnail") || query.has("view"));
  const plainName = file.name.replace(/[^\x20-\x7e]|["\\%]/g, "_");
  const fullName = encodeURIComponent(file.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return new Response(new Uint8Array(file.data), { headers: {
    ...headers,
    "Content-Type": file.type,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${plainName}"; filename*=UTF-8''${fullName}`,
  } });
}
