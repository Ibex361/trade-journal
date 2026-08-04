import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxies a screenshot upload to ImageKit. This has to happen server-side
// because it's authenticated with ImageKit's private key, which must never
// reach the browser — the client only ever talks to this route.
export async function POST(req: NextRequest) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "Screenshot storage isn't configured (missing IMAGEKIT_PRIVATE_KEY)." },
      { status: 500 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = incoming.get("file");
  const accountId = incoming.get("accountId");
  if (!(file instanceof File) || typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Missing file or account." }, { status: 400 });
  }

  // Optional namespace within the account's folder — trade chart screenshots
  // and note-embedded images are kept in separate ImageKit folders so the
  // media library stays organized. Whitelisted rather than accepting an
  // arbitrary client-supplied path.
  const rawContext = incoming.get("context");
  const context = rawContext === "note-images" ? "note-images" : "trade-screenshots";

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `${crypto.randomUUID()}.${ext}`;

  // Namespaced by account, same as the old Supabase Storage layout, so
  // uploads never mix between accounts (or between trades and notes) in
  // the ImageKit media library.
  const outgoing = new FormData();
  outgoing.append("file", file, fileName);
  outgoing.append("fileName", fileName);
  outgoing.append("folder", `/${context}/${accountId}`);
  outgoing.append("useUniqueFileName", "false");

  let res: Response;
  try {
    res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
      },
      body: outgoing,
    });
  } catch {
    return NextResponse.json({ error: "Screenshot upload failed. Please try again." }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url || !data?.fileId) {
    return NextResponse.json(
      { error: data?.message || "Screenshot upload failed. Please try again." },
      { status: res.status || 502 }
    );
  }

  return NextResponse.json({ url: data.url as string, fileId: data.fileId as string });
}
