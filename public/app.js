/* ASPIC II — Purchase Order generator + log
   Fills the fillable PDF template with pdf-lib and stores each PO
   via a Netlify Function backed by Netlify Blobs. */

const API = "/api/po-log";
const TEMPLATE_URL = "aspic-po-template.pdf";
const N_ROWS = 8;

// ---------------------------------------------------------------- helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

let toastTimer = null;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
}

// ---------------------------------------------------------------- tabs
$$(".tag").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tag").forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    $$(".panel").forEach((p) => p.classList.remove("active"));
    $(`#panel-${tab.dataset.tab}`).classList.add("active");
    if (tab.dataset.tab === "log") loadLog();
  });
});

// ---------------------------------------------------------------- line items table
const itemsBody = $("#items-body");

function buildRows() {
  let html = "";
  for (let i = 1; i <= N_ROWS; i++) {
    html += `
      <tr data-row="${i}">
        <td class="col-qty"><input type="number" min="0" step="1" data-field="qty" data-row="${i}" /></td>
        <td class="col-unit"><input type="text" data-field="unit" data-row="${i}" /></td>
        <td class="col-desc"><input type="text" data-field="desc" data-row="${i}" /></td>
        <td class="col-cost"><input type="number" min="0" step="0.01" data-field="cost" data-row="${i}" /></td>
        <td class="col-ext"><span class="ext-cell" id="ext-${i}">$0.00</span></td>
      </tr>`;
  }
  itemsBody.innerHTML = html;
}
buildRows();

function recalcTotals() {
  let total = 0;
  for (let i = 1; i <= N_ROWS; i++) {
    const qty = parseFloat($(`input[data-field="qty"][data-row="${i}"]`).value) || 0;
    const cost = parseFloat($(`input[data-field="cost"][data-row="${i}"]`).value) || 0;
    const ext = qty * cost;
    $(`#ext-${i}`).textContent = money(ext);
    total += ext;
  }
  $("#order-total").textContent = money(total);
  return total;
}
itemsBody.addEventListener("input", recalcTotals);

// default date fields to today
$("#date").value = todayISO();

// ---------------------------------------------------------------- suggest PO number
$("#suggest-po").addEventListener("click", async () => {
  try {
    const res = await fetch(API);
    const data = await res.json();
    const year = new Date().getFullYear().toString().slice(-2);
    let max = 0;
    data.forEach((o) => {
      const m = /^(\d{2})-(\d{5})$/.exec(o.po_number || "");
      if (m && m[1] === year) max = Math.max(max, parseInt(m[2], 10));
    });
    $("#po_number").value = `${year}-${String(max + 1).padStart(5, "0")}`;
  } catch (err) {
    toast("Couldn't reach the PO log to suggest a number", true);
  }
});

// ---------------------------------------------------------------- gather form data
function gatherData() {
  const data = {
    date: $("#date").value,
    po_number: $("#po_number").value.trim(),
    page: "1 OF 1",
    phone_contact: $("#phone_contact").value.trim(),
    supplier: $("#supplier").value.trim(),
    quote_number: $("#quote_number").value.trim(),
    date_needed: $("#date_needed").value,
    customer: $("#customer").value.trim(),
    customer_po: $("#customer_po").value.trim(),
    specifications: $("#specifications").value.trim(),
    authorized_by: $("#authorized_by").value.trim(),
    date_signed: $("#date_signed").value,
    vendor_confirm: $("#vendor_confirm").value.trim(),
    status: "Submitted",
    items: [],
  };

  let total = 0;
  for (let i = 1; i <= N_ROWS; i++) {
    const qty = $(`input[data-field="qty"][data-row="${i}"]`).value;
    const unit = $(`input[data-field="unit"][data-row="${i}"]`).value;
    const desc = $(`input[data-field="desc"][data-row="${i}"]`).value;
    const cost = $(`input[data-field="cost"][data-row="${i}"]`).value;
    const ext = (parseFloat(qty) || 0) * (parseFloat(cost) || 0);
    total += ext;
    data.items.push({ qty, unit, desc, cost, ext: ext ? ext.toFixed(2) : "" });
  }
  data.total = total.toFixed(2);
  return data;
}

// ---------------------------------------------------------------- fill + download PDF
async function fillAndDownloadPDF(data) {
  const bytes = await fetch(TEMPLATE_URL).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFLib.PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  const setText = (name, value) => {
    try { form.getTextField(name).setText(value == null ? "" : String(value)); }
    catch (e) { /* field not present — skip */ }
  };

  setText("date", data.date);
  setText("po_number", data.po_number);
  setText("page", data.page);
  setText("phone_contact", data.phone_contact);
  setText("supplier", data.supplier);
  setText("quote_number", data.quote_number);
  setText("date_needed", data.date_needed);
  setText("customer", data.customer);
  setText("customer_po", data.customer_po);
  setText("specifications", data.specifications);
  setText("authorized_by", data.authorized_by);
  setText("date_signed", data.date_signed);
  setText("vendor_confirm", data.vendor_confirm);
  setText("total", data.total ? money(data.total) : "");

  data.items.forEach((item, idx) => {
    const i = idx + 1;
    setText(`qty_${i}`, item.qty);
    setText(`unit_${i}`, item.unit);
    setText(`desc_${i}`, item.desc);
    setText(`cost_${i}`, item.cost ? money(item.cost) : "");
    setText(`ext_${i}`, item.ext ? money(item.ext) : "");
  });

  form.updateFieldAppearances();
  const outBytes = await pdfDoc.save();
  const blob = new Blob([outBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ASPIC_II_PO_${data.po_number || "draft"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- reset
function resetForm() {
  form.reset();
  buildRows();       // wipe the 8 line-item rows back to blank
  recalcTotals();     // reset the $0.00 total
  $("#date").value = todayISO(); // keep "today" pre-filled for convenience
}

// ---------------------------------------------------------------- submit
const form = $("#po-form");
const statusEl = $("#form-status");
const submitBtn = $("#submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  recalcTotals();

  if (!form.reportValidity()) return;

  const data = gatherData();
  submitBtn.disabled = true;
  statusEl.textContent = "Saving…";
  statusEl.className = "form-status";

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Save failed");

    await fillAndDownloadPDF(data);
    const savedPoNumber = data.po_number;
    resetForm();
    statusEl.textContent = `Saved PO ${savedPoNumber} to the log. Form cleared for the next order.`;
    statusEl.className = "form-status success";
    toast(`PO ${savedPoNumber} created and downloaded`);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Something went wrong — see below.";
    statusEl.className = "form-status error";
    toast(err.message || "Couldn't save this PO", true);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------- log tab
let logCache = [];
const STATUSES = ["Draft", "Submitted", "Confirmed", "In Production", "Shipped", "Received", "Cancelled"];

async function loadLog() {
  const body = $("#log-body");
  body.innerHTML = `<tr><td colspan="8" class="empty-row">Loading…</td></tr>`;
  try {
    const res = await fetch(API);
    logCache = await res.json();
    renderLog(logCache);
    renderStats(logCache);
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-row">Couldn't load the log. Try refresh.</td></tr>`;
  }
}

function renderStats(rows) {
  const count = rows.length;
  const total = rows.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const open = rows.filter((o) => ["Draft", "Submitted"].includes(o.status)).length;
  $("#stat-count").textContent = count;
  $("#stat-total").textContent = total.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  $("#stat-open").textContent = open;
}

function renderLog(rows) {
  const body = $("#log-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-row">No purchase orders logged yet — create one from the "New PO" tab.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((o) => `
    <tr data-po="${o.po_number}">
      <td class="po-cell">${escapeHtml(o.po_number || "")}</td>
      <td>${escapeHtml(o.date || "")}</td>
      <td>${escapeHtml(o.customer || "")}</td>
      <td>${escapeHtml(o.customer_po || "")}</td>
      <td>${escapeHtml(o.supplier || "")}</td>
      <td>${money(o.total)}</td>
      <td>
        <select class="status-select" data-po="${o.po_number}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td class="row-actions">
        <button class="icon-btn" data-action="pdf" data-po="${o.po_number}">PDF</button>
        <button class="icon-btn danger" data-action="delete" data-po="${o.po_number}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("#refresh-log").addEventListener("click", loadLog);

$("#log-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderLog(logCache);
  renderLog(logCache.filter((o) =>
    [o.po_number, o.customer, o.customer_po, o.supplier].some((v) => (v || "").toLowerCase().includes(q))
  ));
});

$("#log-body").addEventListener("change", async (e) => {
  if (!e.target.classList.contains("status-select")) return;
  const po = e.target.dataset.po;
  const record = logCache.find((o) => o.po_number === po);
  if (!record) return;
  record.status = e.target.value;
  try {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    toast(`PO ${po} marked ${record.status}`);
    renderStats(logCache);
  } catch {
    toast("Couldn't update status", true);
  }
});

$("#log-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const po = btn.dataset.po;
  const record = logCache.find((o) => o.po_number === po);
  if (!record) return;

  if (btn.dataset.action === "pdf") {
    btn.disabled = true;
    try { await fillAndDownloadPDF(record); } finally { btn.disabled = false; }
  }

  if (btn.dataset.action === "delete") {
    if (!confirm(`Delete PO ${po} from the log? This can't be undone.`)) return;
    try {
      await fetch(`${API}?po_number=${encodeURIComponent(po)}`, { method: "DELETE" });
      logCache = logCache.filter((o) => o.po_number !== po);
      renderLog(logCache);
      renderStats(logCache);
      toast(`PO ${po} deleted`);
    } catch {
      toast("Couldn't delete this PO", true);
    }
  }
});

$("#export-csv").addEventListener("click", () => {
  if (!logCache.length) { toast("Nothing to export yet", true); return; }
  const cols = ["po_number", "date", "customer", "customer_po", "supplier", "phone_contact",
    "quote_number", "date_needed", "total", "status"];
  const lines = [cols.join(",")];
  logCache.forEach((o) => {
    lines.push(cols.map((c) => `"${String(o[c] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aspic-po-log-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
