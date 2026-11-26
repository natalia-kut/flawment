import { currentUser } from "@/lib/auth/session";
import { addFile, canAddFiles, FileError, recordId } from "@/lib/files/service";
import { formatSize, MAX_FILE_BYTES } from "@/lib/files/limits";

const tooLarge = () => Response.json({ error: `A file can have up to ${formatSize(MAX_FILE_BYTES)}.` }, { status: 413 });

/** Reads the body, giving up as soon as it is over the limit: the declared length may be missing or untrue. */
async function readBody(request: Request) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_FILE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data;
}

/** Adds one file: its bytes as the body, its name in X-File-Name (which also keeps other sites' forms out). */
export async function POST(request: Request, { params }: RouteContext<"/api/tasks/[id]/files">) {
  const actor = await currentUser();
  if (!actor) return Response.json({ error: "Sign in to add files." }, { status: 401 });
  const header = request.headers.get("x-file-name");
  if (!header) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES) return tooLarge();
  try {
    const taskId = recordId((await params).id);
    let name: string;
    try { name = decodeURIComponent(header); } catch { throw new FileError("Invalid file name."); }
    if (!await canAddFiles(actor, taskId)) return Response.json({ error: "This task is no longer available." }, { status: 404 });
    const data = await readBody(request);
    if (!data) return tooLarge();
    return Response.json(await addFile(actor, taskId, name, data), { status: 201 });
  } catch (error) {
    if (error instanceof FileError) return Response.json({ error: error.message }, { status: 400 });
    if (!request.signal.aborted) console.error("File upload failed", error);
    return Response.json({ error: "Could not add the file. Please try again." }, { status: 500 });
  }
}
