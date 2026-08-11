import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function deleteOne(fileId: string, auth: string) {
  await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: auth },
  }).catch(() => {});
}

// Deletes one or more ImageKit files by ID. Same auth constraint as the
// upload route — the private key stays server-side.
export async function POST(req: NextRequest) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "Screenshot storage isn't configured (missing IMAGEKIT_PRIVATE_KEY)." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const fileIds: unknown = body?.fileIds;
  if (!Array.isArray(fileIds) || fileIds.length === 0 || !fileIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "No file IDs provided." }, { status: 400 });
  }

  const auth = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  if (fileIds.length === 1) {
    await deleteOne(fileIds[0], auth);
    return NextResponse.json({ ok: true });
  }

  const res = await fetch("https://api.imagekit.io/v1/files/batch/deleteByFileIds", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  }).catch(() => null);

  // The bulk endpoint fails the WHOLE batch (404) if any single id in it
  // no longer exists — e.g. it was already deleted some other way. Fall
  // back to deleting one at a time so the still-valid ones aren't left
  // behind just because one was stale.
  if (!res || !res.ok) {
    await Promise.all(fileIds.map((id) => deleteOne(id, auth)));
  }

  return NextResponse.json({ ok: true });
}
