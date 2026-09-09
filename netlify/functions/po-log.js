// Netlify Function (v2 API) — stores the PO log as a single JSON blob
// using Netlify Blobs. No external database needed.
//
// GET    /.netlify/functions/po-log            -> list all POs
// POST   /.netlify/functions/po-log            -> create/update one PO (by po_number)
// DELETE /.netlify/functions/po-log?po_number=X -> delete one PO

import { getStore } from "@netlify/blobs";

const KEY = "orders.json";
const JSON_HEADERS = { "Content-Type": "application/json" };

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  const store = getStore("aspic-po-log");

  try {
    if (req.method === "GET") {
      const data = (await store.get(KEY, { type: "json" })) || [];
      // newest first
      data.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return cors(new Response(JSON.stringify(data), { headers: JSON_HEADERS }));
    }

    if (req.method === "POST") {
      const body = await req.json();
      if (!body.po_number) {
        return cors(new Response(JSON.stringify({ error: "po_number is required" }), {
          status: 400, headers: JSON_HEADERS,
        }));
      }
      const data = (await store.get(KEY, { type: "json" })) || [];
      const idx = data.findIndex((o) => o.po_number === body.po_number);
      const now = new Date().toISOString();
      const record = { ...body, updated_at: now };

      if (idx >= 0) {
        record.created_at = data[idx].created_at || now;
        data[idx] = record;
      } else {
        record.created_at = now;
        data.push(record);
      }

      await store.setJSON(KEY, data);
      return cors(new Response(JSON.stringify(record), { headers: JSON_HEADERS }));
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const po = url.searchParams.get("po_number");
      let data = (await store.get(KEY, { type: "json" })) || [];
      data = data.filter((o) => o.po_number !== po);
      await store.setJSON(KEY, data);
      return cors(new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS }));
    }

    return cors(new Response("Method not allowed", { status: 405 }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: JSON_HEADERS,
    }));
  }
};
