import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE — HARDCODED TO GUARANTEE IT WORKS ──────────────────────────────
const SB_URL = "https://uhkfesqvkxrajaaztuch.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa2Zlc3F2a3hyYWphYXp0dWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODY5NzYsImV4cCI6MjA5NjI2Mjk3Nn0.DZMd6JrFaPY_22rvSWpQ0JkVVC-3tl4emIyW6kOhSqc";
const WA_NUM = "265987596070";
const ADMIN_PASS = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

const H = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

// ─── DATABASE FUNCTIONS ───────────────────────────────────────────────────────
async function dbGet(table, query = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: H });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${table} failed: ${t}`);
  return JSON.parse(t);
}

async function dbPatch(table, data, id) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify(data),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`UPDATE ${table} failed (${r.status}): ${t}`);
  return t ? JSON.parse(t) : {};
}

async function dbPost(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(data),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`INSERT ${table} failed (${r.status}): ${t}`);
  return JSON.parse(t);
}

async function uploadPhoto(file) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/house-photos/${name}`, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Photo upload failed: ${t}`);
  }
  return `${SB_URL}/storage/v1/object/public/house-photos/${name}`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => `MWK ${Number(n || 0).toLocaleString()}`;
const ago = d => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const waMsg = (phone, msg) => `https://wa.me/265${(phone || "").replace(/^0/, "")}?text=${encodeURIComponent(msg)}`;

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Toast({ msg, isErr, onClose }) {
  if (!msg) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: isErr ? "#dc2626" : "#052e16", color: "#fff", borderRadius: 14, padding: "13px 24px", fontWeight: 600, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,.3)", cursor: "pointer", maxWidth: "90vw", textAlign: "center", fontSize: ".9rem" }}>
      {isErr ? "❌" : "✅"} {msg}
    </div>
  );
}

function Confirm({ cfg, onYes, onNo }) {
  if (!cfg) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: 400, width: "100%", padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>{cfg.icon || "⚠️"}</div>
        <h3 style={{ margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>{cfg.title}</h3>
        <p style={{ color: "#6b7280", marginBottom: 22, lineHeight: 1.6, fontSize: ".88rem" }}>{cfg.msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onNo} style={{ flex: 1, background: "#f3f4f6", border: "none", borderRadius: 10, padding: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={onYes} style={{ flex: 2, background: cfg.danger ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer" }}>{cfg.action}</button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 44, height: 44, border: "4px solid #dcfce7", borderTop: "4px solid #15803d", borderRadius: "50%", margin: "60px auto", animation: "spin .7s linear infinite" }} />;
}

// ─── PHOTO UPLOADER ───────────────────────────────────────────────────────────
function PhotoUploader({ photos, setPhotos, previews, setPreviews }) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files).slice(0, 4);
    if (!files.length) return;
    setUploading(true);
    const newPreviews = [...previews];
    const newPhotos   = [...photos];
    for (const file of files) {
      try {
        const url = await uploadPhoto(file);
        newPhotos.push(url);
        newPreviews.push(url);
      } catch (err) {
        alert(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    setPhotos(newPhotos.slice(0, 4));
    setPreviews(newPreviews.slice(0, 4));
    setUploading(false);
  };

  const remove = (i) => {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontWeight: 700, marginBottom: 8, color: "#374151", fontSize: ".86rem" }}>
        📸 House Photos <span style={{ color: "#9ca3af", fontWeight: 400 }}>(up to 4 — optional)</span>
      </label>

      {/* Upload zone */}
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "#f0fdf4", border: "2px dashed #86efac", borderRadius: 14, padding: 20, cursor: uploading ? "wait" : "pointer", textAlign: "center" }}>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || photos.length >= 4} onChange={handleFiles} style={{ display: "none" }} />
        <div style={{ fontSize: "2rem" }}>{uploading ? "⏳" : "📷"}</div>
        <div style={{ fontWeight: 700, color: "#15803d", fontSize: ".9rem" }}>
          {uploading ? "Uploading to Supabase..." : photos.length >= 4 ? "Maximum 4 photos" : "Tap to upload photos"}
        </div>
        <div style={{ color: "#9ca3af", fontSize: ".74rem" }}>JPG or PNG • Max 4 photos • Uploads directly to Supabase</div>
      </label>

      {/* Previews */}
      {previews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 12 }}>
          {previews.map((url, i) => (
            <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1", border: `2px solid ${i === 0 ? "#15803d" : "#bbf7d0"}` }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => remove(i)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(220,38,38,.9)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: ".65rem", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
              {i === 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(21,128,61,.85)", color: "#fff", fontSize: ".55rem", textAlign: "center", padding: "2px 0", fontWeight: 700 }}>MAIN</div>}
            </div>
          ))}
          {previews.length < 4 && !uploading && (
            <label style={{ border: "2px dashed #d1fae5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "1", cursor: "pointer", background: "#f9fafb" }}>
              <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
              <span style={{ color: "#9ca3af", fontSize: "1.8rem" }}>+</span>
            </label>
          )}
        </div>
      )}
      {photos.length > 0 && <div style={{ color: "#15803d", fontSize: ".76rem", marginTop: 6, fontWeight: 600 }}>✅ {photos.length} photo{photos.length > 1 ? "s" : ""} uploaded to Supabase</div>}
    </div>
  );
}

// ─── CREATE LISTING ───────────────────────────────────────────────────────────
function CreateListing({ setListings, showToast, setPage }) {
  const [form, setForm] = useState({ title: "", location: "", city: "Lilongwe", price: "", bedrooms: "", bathrooms: "", tier: "basic", description: "", landlord_name: "", landlord_phone: "", chief_name: "", national_id: "", amenities: "" });
  const [photos,   setPhotos]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState("");
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", fontSize: ".88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  const submit = async (status) => {
    if (!form.title || !form.location || !form.price || !form.landlord_name || !form.landlord_phone) { setErr("Please fill all required fields (*)"); return; }
    setBusy(true); setErr("");
    try {
      const data = {
        title:          form.title,
        location:       form.location,
        city:           form.city,
        price:          parseInt(form.price),
        bedrooms:       parseInt(form.bedrooms) || 1,
        bathrooms:      parseInt(form.bathrooms) || 1,
        tier:           form.tier,
        description:    form.description,
        landlord_name:  form.landlord_name,
        landlord_phone: form.landlord_phone,
        amenities:      form.amenities ? form.amenities.split(",").map(a => a.trim()).filter(Boolean) : [],
        photos:         photos,
        status:         status,
        id_checked:     status === "active",
        chief_verified: status === "active",
      };
      const result = await dbPost("listings", data);
      setListings(p => [...p, ...(Array.isArray(result) ? result : [result])]);
      showToast(status === "active" ? `✅ "${form.title}" is LIVE!` : `⏳ "${form.title}" saved as pending.`);
      setPage("listings");
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 620, animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 4px" }}>➕ Post New Listing</h2>
      <p style={{ color: "#6b7280", margin: "0 0 22px", fontSize: ".84rem" }}>Fill in details and upload real photos of the house.</p>
      {err && <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: ".84rem", marginBottom: 16 }}>❌ {err}</div>}
      <div style={{ background: "#fff", borderRadius: 18, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>

        {/* Photo uploader FIRST — most important */}
        <PhotoUploader photos={photos} setPhotos={setPhotos} previews={previews} setPreviews={setPreviews} />

        {[["Property Title *", "title", "text", "e.g. Modern 3-Bed in Area 47"],
          ["Landlord Full Name *", "landlord_name", "text", "e.g. James Phiri"],
          ["Landlord WhatsApp *", "landlord_phone", "tel", "e.g. 0991234567"],
          ["Monthly Rent (MWK) *", "price", "number", "e.g. 120000"],
          ["Bedrooms", "bedrooms", "number", "e.g. 3"],
          ["Bathrooms", "bathrooms", "number", "e.g. 2"],
          ["Location *", "location", "text", "e.g. Area 47, Lilongwe"],
          ["Chief / Headman Name", "chief_name", "text", "Name of area chief"],
          ["National ID Number", "national_id", "text", "e.g. 12345678A"],
          ["Amenities (comma separated)", "amenities", "text", "e.g. Borehole, Parking, Generator"],
        ].map(([l, k, t, p]) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#374151", fontSize: ".83rem" }}>{l}</label>
            <input type={t} placeholder={p} value={form[k]} onChange={e => s(k, e.target.value)} style={inp} onFocus={e => e.target.style.borderColor = "#15803d"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#374151", fontSize: ".83rem" }}>City</label>
          <select value={form.city} onChange={e => s("city", e.target.value)} style={{ ...inp, background: "#fff" }}>
            {["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Other"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#374151", fontSize: ".83rem" }}>Tier</label>
          <select value={form.tier} onChange={e => s("tier", e.target.value)} style={{ ...inp, background: "#fff" }}>
            <option value="basic">🌿 Basic (MWK 30k–80k/mo)</option>
            <option value="standard">🏠 Standard (MWK 80k–250k/mo)</option>
            <option value="premium">✨ Premium (MWK 250k+/mo)</option>
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#374151", fontSize: ".83rem" }}>Description</label>
          <textarea rows={4} placeholder="Describe the property — water supply, security, nearby landmarks..." value={form.description} onChange={e => s("description", e.target.value)} style={{ ...inp, resize: "vertical" }} onFocus={e => e.target.style.borderColor = "#15803d"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
        </div>

        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: 13, marginBottom: 20, fontSize: ".78rem", color: "#92400e", lineHeight: 1.7 }}>
          ⚠️ <strong>Before posting LIVE:</strong> Verify National ID + Chief's letter + Video call inside house
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPage("listings")} style={{ flex: 1, background: "#f3f4f6", border: "none", borderRadius: 12, padding: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => submit("pending")} disabled={busy} style={{ flex: 1, background: "#fffbeb", color: "#f59e0b", border: "1.5px solid #fde68a", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer" }}>
            {busy ? "..." : "⏳ Pending"}
          </button>
          <button onClick={() => submit("active")} disabled={busy} style={{ flex: 2, background: "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(21,128,61,.28)" }}>
            {busy ? "Posting..." : "✅ Post Live Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LISTINGS PAGE ────────────────────────────────────────────────────────────
function Listings({ listings, setListings, showToast, showConfirm, loading, reload }) {
  const [filter, setFilter] = useState("pending");
  const [sel, setSel] = useState(null);
  const visible = listings.filter(l => filter === "all" ? true : l.status === filter);

  const approve = (l) => showConfirm({
    icon: "✅", title: "Approve & Go Live?",
    msg: `"${l.title}" will be LIVE on NyumbaFind immediately.`,
    action: "Yes, Approve",
  }, async () => {
    try {
      await dbPatch("listings", { status: "active", id_checked: true, chief_verified: true }, l.id);
      setListings(p => p.map(x => x.id === l.id ? { ...x, status: "active", id_checked: true, chief_verified: true } : x));
      setSel(null);
      showToast(`✅ "${l.title}" is now LIVE!`);
    } catch (e) { showToast(e.message, true); }
  });

  const reject = (l) => showConfirm({
    icon: "❌", title: "Reject This Listing?",
    msg: `"${l.title}" will be rejected. WhatsApp the landlord to explain why.`,
    action: "Yes, Reject", danger: true,
  }, async () => {
    try {
      await dbPatch("listings", { status: "rejected" }, l.id);
      setListings(p => p.map(x => x.id === l.id ? { ...x, status: "rejected" } : x));
      setSel(null);
      showToast(`Listing rejected.`);
    } catch (e) { showToast(e.message, true); }
  });

  const markRented = (l) => showConfirm({
    icon: "🏠", title: "Mark as Rented?",
    msg: `Remove "${l.title}" from the site — house is now rented.`,
    action: "Yes, Remove", danger: true,
  }, async () => {
    try {
      await dbPatch("listings", { status: "removed" }, l.id);
      setListings(p => p.map(x => x.id === l.id ? { ...x, status: "removed" } : x));
      showToast(`House removed from site.`);
    } catch (e) { showToast(e.message, true); }
  });

  const photo = l => (l.photos || [])[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=80";
  const statusColors = { pending: { c: "#f59e0b", bg: "#fffbeb", label: "⏳ Pending" }, active: { c: "#15803d", bg: "#f0fdf4", label: "✅ Live" }, rejected: { c: "#ef4444", bg: "#fef2f2", label: "❌ Rejected" }, removed: { c: "#6b7280", bg: "#f9fafb", label: "Removed" } };

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 3px" }}>🏠 Listings</h2>
          <p style={{ color: "#6b7280", margin: 0, fontSize: ".82rem" }}>Approve before going live. Every listing must be verified.</p>
        </div>
        <button onClick={reload} style={{ background: "#f0fdf4", color: "#15803d", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>🔄 Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
        {[["pending", "⏳ Pending"], ["active", "✅ Live"], ["rejected", "❌ Rejected"], ["removed", "Removed"], ["all", "All"]].map(([v, l]) => {
          const cnt = listings.filter(x => v === "all" ? true : x.status === v).length;
          return <button key={v} onClick={() => setFilter(v)} style={{ background: filter === v ? "#052e16" : "#f3f4f6", color: filter === v ? "#4ade80" : "#374151", border: "none", borderRadius: 30, padding: "7px 15px", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>{l} ({cnt})</button>;
        })}
      </div>

      {loading && <Spinner />}
      {!loading && visible.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}><div style={{ fontSize: "3rem" }}>🏚</div><p>Nothing here.</p></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map(l => {
          const sc = statusColors[l.status] || statusColors.pending;
          return (
            <div key={l.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.07)", display: "flex" }}>
              <img src={photo(l)} alt="" style={{ width: 120, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ padding: "14px 16px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <h3 style={{ margin: "0 0 2px", fontFamily: "'Playfair Display',serif", fontSize: ".96rem" }}>{l.title}</h3>
                    <p style={{ margin: "0 0 3px", color: "#6b7280", fontSize: ".76rem" }}>📍 {l.location} • {fmt(l.price)}/mo • 🛏 {l.bedrooms} beds</p>
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: ".71rem" }}>👤 {l.landlord_name || "—"} • 📱 {l.landlord_phone || "—"} • ⏰ {ago(l.created_at)}</p>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <span style={{ background: sc.bg, color: sc.c, borderRadius: 20, padding: "3px 10px", fontSize: ".68rem", fontWeight: 700 }}>{sc.label}</span>
                    <span style={{ background: l.id_checked ? "#f0fdf4" : "#fef2f2", color: l.id_checked ? "#15803d" : "#ef4444", borderRadius: 20, padding: "3px 8px", fontSize: ".66rem", fontWeight: 700 }}>{l.id_checked ? "🪪 ✓" : "🪪 ✗"}</span>
                    <span style={{ background: l.chief_verified ? "#f0fdf4" : "#fef2f2", color: l.chief_verified ? "#15803d" : "#ef4444", borderRadius: 20, padding: "3px 8px", fontSize: ".66rem", fontWeight: 700 }}>{l.chief_verified ? "👑 ✓" : "👑 ✗"}</span>
                    {(l.photos || []).length > 0 && <span style={{ background: "#eff6ff", color: "#3b82f6", borderRadius: 20, padding: "3px 8px", fontSize: ".66rem", fontWeight: 700 }}>📸 {l.photos.length}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  <button onClick={() => setSel(l)} style={{ background: "#f0fdf4", color: "#15803d", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "6px 12px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>👁 View</button>
                  {l.status === "pending" && <>
                    <button onClick={() => approve(l)} style={{ background: "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>✅ Approve</button>
                    <button onClick={() => reject(l)} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>❌ Reject</button>
                  </>}
                  {l.status === "active" && <button onClick={() => markRented(l)} style={{ background: "#fffbeb", color: "#f59e0b", border: "1.5px solid #fde68a", borderRadius: 8, padding: "6px 12px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>🏠 Mark Rented</button>}
                  {l.landlord_phone && <button onClick={() => window.open(waMsg(l.landlord_phone, `Hi ${l.landlord_name || ""}! This is NyumbaFind regarding your listing "${l.title}".`), "_blank")} style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>💬 WhatsApp</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Photos gallery */}
            {(sel.photos || []).length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: (sel.photos || []).length > 1 ? "1fr 1fr" : "1fr", gap: 2 }}>
                {(sel.photos || []).slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: "100%", height: i === 0 && sel.photos.length > 1 ? 200 : 180, objectFit: "cover", borderRadius: i === 0 ? "24px 0 0 0" : i === 1 ? "0 24px 0 0" : 0 }} />
                ))}
              </div>
            ) : (
              <img src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80" alt="" style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: "24px 24px 0 0" }} />
            )}
            <div style={{ padding: 22 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "'Playfair Display',serif" }}>{sel.title}</h2>
              <p style={{ margin: "0 0 14px", color: "#6b7280", fontSize: ".84rem" }}>📍 {sel.location} • {fmt(sel.price)}/mo</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 16 }}>
                {[["Landlord", sel.landlord_name || "—"], ["Phone", sel.landlord_phone || "—"], ["Beds", `${sel.bedrooms} / ${sel.bathrooms} baths`], ["Tier", sel.tier || "—"], ["Chief", sel.chief_name || "—"], ["National ID", sel.national_id || "—"]].map(([l, v]) => (
                  <div key={l} style={{ background: "#f9fafb", borderRadius: 10, padding: "9px 12px" }}>
                    <div style={{ fontSize: ".68rem", color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 700, fontSize: ".84rem" }}>{v}</div>
                  </div>
                ))}
              </div>
              {sel.description && <p style={{ color: "#374151", lineHeight: 1.7, marginBottom: 14, fontSize: ".86rem" }}>{sel.description}</p>}
              {(sel.amenities || []).length > 0 && (
                <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {sel.amenities.map(a => <span key={a} style={{ background: "#f0fdf4", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontSize: ".74rem", fontWeight: 600 }}>{a}</span>)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setSel(null)} style={{ flex: 1, background: "#f3f4f6", border: "none", borderRadius: 10, padding: 12, fontWeight: 600, cursor: "pointer" }}>Close</button>
                {sel.landlord_phone && <button onClick={() => window.open(waMsg(sel.landlord_phone, `Hi ${sel.landlord_name || ""}! NyumbaFind here regarding "${sel.title}".`), "_blank")} style={{ flex: 1, background: "#25d366", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>💬 WhatsApp</button>}
                {sel.status === "pending" && <>
                  <button onClick={() => approve(sel)} style={{ flex: 2, background: "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>✅ Approve & Go Live</button>
                  <button onClick={() => reject(sel)} style={{ flex: 1, background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>❌ Reject</button>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOOKINGS PAGE ────────────────────────────────────────────────────────────
function Bookings({ bookings, setBookings, setListings, showToast, showConfirm, loading, reload }) {
  const [filter, setFilter] = useState("all");
  const visible = bookings.filter(b => filter === "all" ? true : b.status === filter);

  const release = (b) => showConfirm({
    icon: "💸", title: "Release Payment?",
    msg: `Release ${fmt(b.deposit_amount)} to ${b.landlord_name || "landlord"}? NyumbaFind keeps ${fmt(b.service_fee)}.`,
    action: "Yes, Release",
  }, async () => {
    try {
      await dbPatch("bookings", { status: "confirmed" }, b.id);
      if (b.listing_id) await dbPatch("listings", { status: "removed" }, b.listing_id);
      setBookings(p => p.map(x => x.id === b.id ? { ...x, status: "confirmed" } : x));
      setListings(p => p.map(l => l.id === b.listing_id ? { ...l, status: "removed" } : l));
      showToast(`💸 Payment released! House removed from site.`);
    } catch (e) { showToast(e.message, true); }
  });

  const refund = (b) => {
    const ra = Math.round((b.deposit_amount || 0) * 0.9);
    showConfirm({
      icon: "↩️", title: "Issue Refund?",
      msg: `Refund ${fmt(ra)} (90%) to ${b.tenant_name || "tenant"}?`,
      action: "Yes, Refund", danger: true,
    }, async () => {
      try {
        await dbPatch("bookings", { status: "refunded", refund_amount: ra }, b.id);
        setBookings(p => p.map(x => x.id === b.id ? { ...x, status: "refunded", refund_amount: ra } : x));
        showToast(`↩️ ${fmt(ra)} refunded.`);
      } catch (e) { showToast(e.message, true); }
    });
  };

  const statusCfg = { payment_received: { label: "💳 Paid", c: "#f59e0b", bg: "#fffbeb" }, viewing_scheduled: { label: "🗓 Viewing", c: "#3b82f6", bg: "#eff6ff" }, confirmed: { label: "✅ Confirmed", c: "#15803d", bg: "#f0fdf4" }, refund_requested: { label: "↩️ Refund", c: "#ef4444", bg: "#fef2f2" }, refunded: { label: "Refunded", c: "#8b5cf6", bg: "#f5f3ff" }, completed: { label: "Done", c: "#6b7280", bg: "#f9fafb" } };

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 3px" }}>📋 Bookings</h2>
          <p style={{ color: "#6b7280", margin: 0, fontSize: ".82rem" }}>Every payment goes through you. You control when money moves.</p>
        </div>
        <button onClick={reload} style={{ background: "#f0fdf4", color: "#15803d", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>🔄 Refresh</button>
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
        {[["all", "All"], ["payment_received", "💳 Paid"], ["viewing_scheduled", "🗓 Viewing"], ["confirmed", "✅ Confirmed"], ["refund_requested", "↩️ Refund"], ["refunded", "Refunded"]].map(([v, l]) => {
          const cnt = bookings.filter(b => v === "all" ? true : b.status === v).length;
          const urg = (v === "payment_received" || v === "refund_requested") && cnt > 0;
          return <button key={v} onClick={() => setFilter(v)} style={{ background: filter === v ? "#052e16" : "#f3f4f6", color: filter === v ? "#4ade80" : "#374151", border: urg ? "1.5px solid #ef4444" : "none", borderRadius: 30, padding: "7px 14px", fontSize: ".77rem", fontWeight: 700, cursor: "pointer" }}>{l}{cnt > 0 ? ` (${cnt})` : ""}{urg ? " 🔴" : ""}</button>;
        })}
      </div>
      {loading && <Spinner />}
      {!loading && visible.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}><div style={{ fontSize: "3rem" }}>📭</div><p>Nothing here.</p></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {visible.map(b => {
          const sc = statusCfg[b.status] || { label: b.status, c: "#6b7280", bg: "#f9fafb" };
          return (
            <div key={b.id} style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(0,0,0,.07)", borderLeft: `4px solid ${b.status === "payment_received" || b.status === "refund_requested" ? "#ef4444" : "#e5e7eb"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9, flexWrap: "wrap", gap: 7 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: ".96rem" }}>{b.house?.title || "House"}</h3>
                    <span style={{ background: sc.bg, color: sc.c, borderRadius: 20, padding: "3px 10px", fontSize: ".68rem", fontWeight: 700 }}>{sc.label}</span>
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: ".76rem", color: "#374151" }}>👤 <strong>{b.tenant_name || "—"}</strong> 📱 {b.tenant_phone || "—"}</p>
                  <p style={{ margin: 0, fontSize: ".76rem", color: "#374151" }}>🏠 Landlord: <strong>{b.landlord_name || "—"}</strong> 📱 {b.landlord_phone || "—"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#15803d" }}>{fmt(b.total_paid)}</div>
                  <div style={{ fontSize: ".68rem", color: "#9ca3af" }}>Deposit: {fmt(b.deposit_amount)}</div>
                  <div style={{ fontSize: ".68rem", color: "#15803d", fontWeight: 700 }}>Your fee: {fmt(b.service_fee)}</div>
                  {b.refund_amount && <div style={{ fontSize: ".68rem", color: "#8b5cf6", fontWeight: 700 }}>Refunded: {fmt(b.refund_amount)}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                {b.tenant_phone && <button onClick={() => window.open(waMsg(b.tenant_phone, `Hi ${b.tenant_name || ""}! NyumbaFind here regarding your booking.`), "_blank")} style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>💬 Tenant</button>}
                {b.landlord_phone && <button onClick={() => window.open(waMsg(b.landlord_phone, `Hi ${b.landlord_name || ""}! NyumbaFind here regarding your property.`), "_blank")} style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>💬 Landlord</button>}
                {(b.status === "payment_received" || b.status === "viewing_scheduled") && <>
                  <button onClick={() => release(b)} style={{ background: "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>💸 Release Payment</button>
                  <button onClick={() => refund(b)} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>↩️ Refund</button>
                </>}
                {b.status === "refund_requested" && <button onClick={() => refund(b)} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>↩️ Process Refund</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── USERS PAGE ───────────────────────────────────────────────────────────────
function Users({ users, setUsers, showToast, showConfirm, loading, reload }) {
  const [search, setSearch] = useState("");
  const visible = users.filter(u => !search || `${u.first_name} ${u.last_name} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase()));

  const ban = (u) => showConfirm({
    icon: "🚫", title: `Ban ${u.first_name} ${u.last_name}?`,
    msg: "They will be banned and cannot use NyumbaFind.",
    action: "Yes, Ban", danger: true,
  }, async () => {
    try {
      await dbPatch("users", { is_banned: true, ban_reason: "Banned by NyumbaFind admin" }, u.id);
      setUsers(p => p.map(x => x.id === u.id ? { ...x, is_banned: true } : x));
      showToast(`🚫 ${u.first_name} ${u.last_name} banned.`);
    } catch (e) { showToast(e.message, true); }
  });

  const unban = async (u) => {
    try {
      await dbPatch("users", { is_banned: false, ban_reason: null }, u.id);
      setUsers(p => p.map(x => x.id === u.id ? { ...x, is_banned: false } : x));
      showToast(`✅ ${u.first_name} ${u.last_name} unbanned.`);
    } catch (e) { showToast(e.message, true); }
  };

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 3px" }}>👥 Users</h2>
          <p style={{ color: "#6b7280", margin: 0, fontSize: ".82rem" }}>All tenants and landlords.</p>
        </div>
        <button onClick={reload} style={{ background: "#f0fdf4", color: "#15803d", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>🔄 Refresh</button>
      </div>
      <input placeholder="🔍 Search name, email or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "10px 15px", fontSize: ".88rem", marginBottom: 16, outline: "none", fontFamily: "inherit" }} />
      {loading && <Spinner />}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {visible.map(u => (
          <div key={u.id} style={{ background: "#fff", borderRadius: 13, padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 9, opacity: u.is_banned ? .6 : 1, borderLeft: `3px solid ${u.is_banned ? "#ef4444" : u.role === "landlord" ? "#3b82f6" : "#15803d"}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".88rem" }}>{u.first_name} {u.last_name}</div>
              <div style={{ fontSize: ".71rem", color: "#6b7280" }}>{u.email} • {u.phone}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                <span style={{ background: u.role === "landlord" ? "#eff6ff" : "#f0fdf4", color: u.role === "landlord" ? "#3b82f6" : "#15803d", borderRadius: 20, padding: "2px 8px", fontSize: ".65rem", fontWeight: 700 }}>{u.role || "tenant"}</span>
                <span style={{ background: u.is_banned ? "#fef2f2" : "#f0fdf4", color: u.is_banned ? "#ef4444" : "#15803d", borderRadius: 20, padding: "2px 8px", fontSize: ".65rem", fontWeight: 700 }}>{u.is_banned ? "🚫 Banned" : "✅ Active"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {u.phone && <button onClick={() => window.open(waMsg(u.phone, `Hi ${u.first_name || ""}! NyumbaFind here.`), "_blank")} style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>💬</button>}
              {!u.is_banned ? <button onClick={() => ban(u)} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>🚫 Ban</button>
                : <button onClick={() => unban(u)} style={{ background: "#f0fdf4", color: "#15803d", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "6px 12px", fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>✅ Unban</button>}
            </div>
          </div>
        ))}
        {visible.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}><p>No users found.</p></div>}
      </div>
    </div>
  );
}

// ─── REVENUE PAGE ─────────────────────────────────────────────────────────────
function Revenue({ bookings, loading }) {
  const earned = bookings.filter(b => ["confirmed", "completed"].includes(b.status));
  const total = earned.reduce((s, b) => s + (b.service_fee || 0), 0);
  const pending = bookings.filter(b => b.status === "payment_received").reduce((s, b) => s + (b.service_fee || 0), 0);
  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 22px" }}>💰 Revenue</h2>
      {loading && <Spinner />}
      {!loading && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 13, marginBottom: 26 }}>
          {[["Confirmed Revenue", fmt(total), "#15803d"], ["Pending", fmt(pending), "#f59e0b"], ["Bookings", earned.length, "#3b82f6"], ["Refunds", bookings.filter(b => b.status === "refunded").length, "#ef4444"]].map(([l, v, c]) => (
            <div key={l} style={{ background: "#fff", borderRadius: 13, padding: "17px 19px", borderTop: `3px solid ${c}`, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: ".7rem", color: "#9ca3af", fontWeight: 600, marginBottom: 5, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", margin: "0 0 14px", fontSize: "1.05rem" }}>All Transactions</h3>
          {bookings.length === 0 && <p style={{ color: "#9ca3af", textAlign: "center", padding: 30 }}>No bookings yet.</p>}
          {bookings.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: 7 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".84rem" }}>{b.house?.title || "House"}</div>
                <div style={{ color: "#6b7280", fontSize: ".72rem" }}>{b.tenant_name || "—"} • {ago(b.created_at)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: ".76rem", color: "#9ca3af" }}>Total: {fmt(b.total_paid)}</div>
                <div style={{ fontWeight: 800, color: "#15803d", fontSize: ".86rem" }}>Fee: {fmt(b.service_fee)}</div>
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ listings, bookings, users, setPage }) {
  const pendingL = listings.filter(l => l.status === "pending").length;
  const activeL  = listings.filter(l => l.status === "active").length;
  const paidB    = bookings.filter(b => b.status === "payment_received").length;
  const refundB  = bookings.filter(b => b.status === "refund_requested").length;
  const revenue  = bookings.filter(b => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + (b.service_fee || 0), 0);

  const stats = [
    { icon: "💰", label: "Total Revenue",    value: fmt(revenue), color: "#15803d" },
    { icon: "⏳", label: "Pending Listings", value: pendingL,     color: "#f59e0b", page: "listings", urgent: pendingL > 0 },
    { icon: "🏠", label: "Active Listings",  value: activeL,      color: "#3b82f6", page: "listings" },
    { icon: "💳", label: "Payments Waiting", value: paidB,        color: "#f59e0b", page: "bookings", urgent: paidB > 0 },
    { icon: "↩️", label: "Refund Requests", value: refundB,      color: "#ef4444", page: "bookings", urgent: refundB > 0 },
    { icon: "👥", label: "Total Users",      value: users.length, color: "#8b5cf6", page: "users" },
  ];

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.7rem", margin: "0 0 4px" }}>Good day 👑</h2>
      <p style={{ color: "#6b7280", margin: "0 0 22px" }}>Real data from your Supabase database.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 13, marginBottom: 26 }}>
        {stats.map(s => (
          <div key={s.label} onClick={() => s.page && setPage(s.page)}
            style={{ background: "#fff", borderRadius: 14, padding: "17px 19px", borderLeft: `4px solid ${s.color}`, boxShadow: s.urgent ? `0 0 0 2px ${s.color}50,0 4px 16px rgba(0,0,0,.08)` : "0 2px 12px rgba(0,0,0,.06)", cursor: s.page ? "pointer" : "default", transition: "transform .2s", position: "relative" }}
            onMouseEnter={e => s.page && (e.currentTarget.style.transform = "translateY(-3px)")}
            onMouseLeave={e => s.page && (e.currentTarget.style.transform = "translateY(0)")}>
            {s.urgent && <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />}
            <div style={{ fontSize: "1.5rem", marginBottom: 5 }}>{s.icon}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: ".72rem", color: "#6b7280", marginTop: 5, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {(pendingL > 0 || paidB > 0 || refundB > 0) && (
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 14, padding: 18, marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontFamily: "'Playfair Display',serif", fontSize: "1rem" }}>🚨 Needs Attention Now</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pendingL > 0 && <button onClick={() => setPage("listings")} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>⏳ {pendingL} listing{pendingL > 1 ? "s" : ""} waiting</button>}
            {paidB > 0 && <button onClick={() => setPage("bookings")} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>💳 {paidB} payment{paidB > 1 ? "s" : ""} to release</button>}
            {refundB > 0 && <button onClick={() => setPage("bookings")} style={{ background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>↩️ {refundB} refund{refundB > 1 ? "s" : ""} to process</button>}
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <h3 style={{ margin: "0 0 14px", fontFamily: "'Playfair Display',serif", fontSize: "1.05rem" }}>Recent Bookings</h3>
        {bookings.length === 0 && <p style={{ color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No bookings yet.</p>}
        {bookings.slice(0, 5).map(b => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: 7 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".86rem" }}>{b.tenant_name || "Tenant"}</div>
              <div style={{ color: "#6b7280", fontSize: ".74rem" }}>{b.house?.title || "House"} • {ago(b.created_at)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 800, color: "#15803d", fontSize: ".88rem" }}>{fmt(b.total_paid)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ADMIN APP ───────────────────────────────────────────────────────────
export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [page,     setPage]     = useState("dashboard");
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState({ msg: "", isErr: false });
  const [confirm,  setConfirm]  = useState(null);
  const [confirmCb,setConfirmCb]= useState(null);

  const showToast = (msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast({ msg: "", isErr: false }), 4000);
  };

  const showConfirm = (cfg, cb) => {
    setConfirm(cfg);
    setConfirmCb(() => cb);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [L, B, U] = await Promise.all([
        dbGet("listings", "order=created_at.desc"),
        dbGet("bookings", "order=created_at.desc"),
        dbGet("users",    "order=created_at.desc"),
      ]);
      setListings(Array.isArray(L) ? L : []);
      setBookings(Array.isArray(B) ? B : []);
      setUsers(Array.isArray(U)    ? U : []);
    } catch (e) {
      showToast(`Failed to load: ${e.message}`, true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (loggedIn) loadData(); }, [loggedIn, loadData]);

  // Brute force protection
  const [attempts, setAttempts] = useState(0);
  const login = () => {
    if (attempts >= 5) { setLoginErr("Too many attempts. Wait 15 minutes."); return; }
    if (email.toLowerCase().trim() === "admin@nyumbafind.mw" && pass === ADMIN_PASS) {
      setLoggedIn(true); setLoginErr(""); setAttempts(0);
    } else {
      setAttempts(a => a + 1);
      setLoginErr(`Wrong email or password. ${5 - attempts - 1} attempts left.`);
    }
  };

  const pendingBadge = listings.filter(l => l.status === "pending").length;
  const urgentBadge  = bookings.filter(b => b.status === "payment_received" || b.status === "refund_requested").length;

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#052e16,#14532d,#15803d)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700;800&display=swap'); @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
      <div style={{ background: "#fff", borderRadius: 24, maxWidth: 400, width: "100%", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.35)", animation: "fadeUp .5s ease" }}>
        <div style={{ background: "linear-gradient(135deg,#052e16,#15803d)", padding: "30px 26px 26px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🏠</div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#fff", fontSize: "1.4rem", margin: "0 0 5px" }}>NyumbaFind Admin</h1>
          <p style={{ color: "#86efac", margin: 0, fontSize: ".8rem" }}>Private Access Only 👑</p>
        </div>
        <div style={{ padding: "24px" }}>
          <label style={{ display: "block", fontSize: ".8rem", fontWeight: 700, color: "#374151", marginBottom: 5 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@nyumbafind.mw" type="email" onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "11px 13px", fontSize: ".9rem", marginBottom: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#15803d"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
          <label style={{ display: "block", fontSize: ".8rem", fontWeight: 700, color: "#374151", marginBottom: 5 }}>Password</label>
          <input value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "11px 13px", fontSize: ".9rem", marginBottom: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#15803d"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
          {loginErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: ".76rem", color: "#ef4444", marginBottom: 13 }}>{loginErr}</div>}
          <button onClick={login} style={{ width: "100%", background: "linear-gradient(135deg,#15803d,#4ade80)", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}>Login to Admin →</button>
        </div>
      </div>
    </div>
  );

  const nav = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "create",    icon: "➕", label: "Post Listing" },
    { id: "listings",  icon: "🏠", label: "Listings",  badge: pendingBadge },
    { id: "bookings",  icon: "📋", label: "Bookings",  badge: urgentBadge },
    { id: "users",     icon: "👥", label: "Users" },
    { id: "revenue",   icon: "💰", label: "Revenue" },
  ];

  // ── MAIN LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fdf9", fontFamily: "'DM Sans',sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:3px}
        input,select,textarea{font-family:inherit}
        @media(max-width:768px){
          .admin-wrap{flex-direction:column!important}
          .admin-sidebar{width:100%!important;height:auto!important;min-height:unset!important;position:relative!important;flex-direction:row!important;flex-wrap:wrap!important;padding:8px!important;gap:4px!important}
          .admin-sidebar .sidebar-logo{display:none!important}
          .admin-sidebar .sidebar-footer{display:none!important}
          .admin-content{max-height:unset!important}
        }
      `}</style>

      {/* SIDEBAR */}
      <div className="admin-sidebar" style={{ width: 200, background: "#052e16", minHeight: "100vh", padding: "20px 12px", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div className="sidebar-logo" style={{ textAlign: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 3 }}>🏠</div>
          <div style={{ fontFamily: "'Playfair Display',serif", color: "#fff", fontWeight: 900, fontSize: ".95rem" }}>Nyumba<span style={{ color: "#4ade80" }}>Find</span></div>
          <div style={{ color: "#4ade80", fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", marginTop: 2 }}>ADMIN PANEL</div>
        </div>
        <div style={{ flex: 1 }}>
          {nav.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: active ? "rgba(74,222,128,.15)" : "transparent", color: active ? "#4ade80" : "rgba(255,255,255,.55)", border: active ? "1px solid rgba(74,222,128,.2)" : "1px solid transparent", borderRadius: 9, padding: "9px 11px", marginBottom: 3, cursor: "pointer", fontSize: ".8rem", fontWeight: active ? 700 : 500, textAlign: "left", transition: "all .2s" }}>
                <span>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "50%", minWidth: 17, height: 17, fontSize: ".58rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n.badge}</span>}
              </button>
            );
          })}
        </div>
        <div className="sidebar-footer" style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 12 }}>
          <div style={{ color: "rgba(255,255,255,.35)", fontSize: ".65rem", marginBottom: 3 }}>Logged in as</div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: ".8rem", marginBottom: 10 }}>NyumbaFind 👑</div>
          <button onClick={loadData} style={{ width: "100%", background: "rgba(74,222,128,.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,.22)", borderRadius: 7, padding: "7px", fontSize: ".72rem", fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>🔄 Refresh Data</button>
          <button onClick={() => setLoggedIn(false)} style={{ width: "100%", background: "rgba(239,68,68,.12)", color: "#f87171", border: "1px solid rgba(239,68,68,.22)", borderRadius: 7, padding: "7px", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}>🚪 Logout</button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="admin-content" style={{ flex: 1, padding: "24px", overflowY: "auto", maxHeight: "100vh", animation: "fadeUp .3s ease" }}>
        {page === "dashboard" && <Dashboard listings={listings} bookings={bookings} users={users} setPage={setPage} />}
        {page === "create"    && <CreateListing setListings={setListings} showToast={showToast} setPage={setPage} />}
        {page === "listings"  && <Listings listings={listings} setListings={setListings} showToast={showToast} showConfirm={showConfirm} loading={loading} reload={loadData} />}
        {page === "bookings"  && <Bookings bookings={bookings} setBookings={setBookings} setListings={setListings} showToast={showToast} showConfirm={showConfirm} loading={loading} reload={loadData} />}
        {page === "users"     && <Users users={users} setUsers={setUsers} showToast={showToast} showConfirm={showConfirm} loading={loading} reload={loadData} />}
        {page === "revenue"   && <Revenue bookings={bookings} loading={loading} />}
      </div>

      <Toast msg={toast.msg} isErr={toast.isErr} onClose={() => setToast({ msg: "", isErr: false })} />
      <Confirm cfg={confirm} onYes={() => { confirmCb && confirmCb(); setConfirm(null); setConfirmCb(null); }} onNo={() => { setConfirm(null); setConfirmCb(null); }} />
    </div>
  );
}
