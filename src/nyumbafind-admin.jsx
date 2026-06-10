import { useState, useEffect, useCallback } from "react";

// ─── REAL SUPABASE CONNECTION ─────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;
const DYLAN_WA     = process.env.REACT_APP_DYLAN_WA;

const H = {
  apikey:         SUPABASE_KEY,
  Authorization:  `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer:         "return=representation",
};

const db = {
  get: async (table, query="") => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: H });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  patch: async (table, data, filter) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"PATCH", headers: H, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  post: async (table, data) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:"POST", headers: H, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  del: async (table, filter) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"DELETE", headers: H });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt    = n => `MWK ${Number(n||0).toLocaleString()}`;
const waLink = (phone, msg) => `https://wa.me/265${(phone||"").replace(/^0/,"")}?text=${encodeURIComponent(msg)}`;
const ago    = d => { if(!d) return ""; const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60) return "just now"; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };

const STATUS = {
  pending:           { label:"Pending Review",      color:"#f59e0b", bg:"#fffbeb" },
  active:            { label:"Live ✅",              color:"#15803d", bg:"#f0fdf4" },
  rejected:          { label:"Rejected",            color:"#ef4444", bg:"#fef2f2" },
  removed:           { label:"Rented Out",          color:"#6b7280", bg:"#f9fafb" },
  payment_received:  { label:"💳 Paid",              color:"#f59e0b", bg:"#fffbeb" },
  viewing_scheduled: { label:"🗓 Viewing",           color:"#3b82f6", bg:"#eff6ff" },
  confirmed:         { label:"✅ Confirmed",         color:"#15803d", bg:"#f0fdf4" },
  refund_requested:  { label:"↩️ Refund Requested",  color:"#ef4444", bg:"#fef2f2" },
  refunded:          { label:"↩️ Refunded",           color:"#8b5cf6", bg:"#f5f3ff" },
  completed:         { label:"Done",                color:"#6b7280", bg:"#f9fafb" },
  active_user:       { label:"✅ Active",            color:"#15803d", bg:"#f0fdf4" },
  banned:            { label:"🚫 Banned",            color:"#ef4444", bg:"#fef2f2" },
};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const Chip = ({ s }) => { const c=STATUS[s]||STATUS.pending; return <span style={{ background:c.bg,color:c.color,borderRadius:20,padding:"3px 10px",fontSize:".68rem",fontWeight:700,whiteSpace:"nowrap" }}>{c.label}</span>; };

const Btn = ({ children, onClick, col="green", sm, disabled }) => {
  const C = { green:{bg:"linear-gradient(135deg,#15803d,#4ade80)",c:"#fff",b:"none"}, red:{bg:"#fef2f2",c:"#ef4444",b:"1.5px solid #fecaca"}, gray:{bg:"#f3f4f6",c:"#374151",b:"none"}, wa:{bg:"#25d366",c:"#fff",b:"none"}, blue:{bg:"#eff6ff",c:"#3b82f6",b:"1.5px solid #bfdbfe"}, orange:{bg:"#fffbeb",c:"#f59e0b",b:"1.5px solid #fde68a"} };
  const s=C[col]||C.green;
  return <button onClick={onClick} disabled={disabled} style={{ background:s.bg,color:s.c,border:s.b,borderRadius:sm?8:10,padding:sm?"6px 11px":"9px 16px",fontSize:sm?".72rem":".8rem",fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,whiteSpace:"nowrap",transition:"opacity .2s" }}>{children}</button>;
};

function Toast({ msg, err }) {
  if (!msg&&!err) return null;
  return <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:err?"#dc2626":"#052e16",color:"#fff",borderRadius:14,padding:"12px 22px",fontWeight:600,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"fadeUp .3s ease",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center" }}>{err?"❌":"✅"} {msg||err}</div>;
}

function Confirm({ cfg, onDone }) {
  if (!cfg) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(4px)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:"#fff",borderRadius:20,maxWidth:400,width:"100%",padding:28,textAlign:"center",animation:"fadeUp .3s ease" }}>
        <div style={{ fontSize:"2.5rem",marginBottom:10 }}>{cfg.icon||"⚠️"}</div>
        <h3 style={{ margin:"0 0 8px",fontFamily:"'Playfair Display',serif" }}>{cfg.title}</h3>
        <p style={{ color:"#6b7280",marginBottom:22,lineHeight:1.6,fontSize:".86rem" }}>{cfg.msg}</p>
        <div style={{ display:"flex",gap:10 }}>
          <Btn col="gray" onClick={()=>onDone(false)}>Cancel</Btn>
          <button onClick={()=>onDone(true)} style={{ flex:1,background:cfg.danger?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:10,padding:13,fontWeight:700,cursor:"pointer" }}>{cfg.action}</button>
        </div>
      </div>
    </div>
  );
}

function Spinner({ small }) {
  return <div style={{ width:small?24:44,height:small?24:44,border:`${small?3:4}px solid #dcfce7`,borderTop:`${small?3:4}px solid #15803d`,borderRadius:"50%",margin:small?"0":"60px auto",animation:"spin .7s linear infinite",flexShrink:0 }}/>;
}

function ErrBox({ msg, onRetry }) {
  if (!msg) return null;
  return (
    <div style={{ background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,padding:"14px 18px",color:"#dc2626",fontSize:".84rem",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
      <span>❌ {msg}</span>
      {onRetry&&<button onClick={onRetry} style={{ background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:".76rem",fontWeight:700,cursor:"pointer" }}>Retry</button>}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ setPage, listings, bookings, users }) {
  const pending  = listings.filter(l=>l.status==="pending").length;
  const active   = listings.filter(l=>l.status==="active").length;
  const paidB    = bookings.filter(b=>b.status==="payment_received").length;
  const refundB  = bookings.filter(b=>b.status==="refund_requested").length;
  const doneB    = bookings.filter(b=>["confirmed","completed"].includes(b.status)).length;
  const revenue  = bookings.filter(b=>["confirmed","completed"].includes(b.status)).reduce((s,b)=>s+(b.service_fee||0),0);
  const banned   = users.filter(u=>u.is_banned).length;

  const stats = [
    { icon:"💰", label:"Total Revenue",      value:fmt(revenue),  color:"#15803d", page:null },
    { icon:"⏳", label:"Pending Listings",   value:pending,       color:"#f59e0b", page:"listings", urgent:pending>0 },
    { icon:"🏠", label:"Active Listings",    value:active,        color:"#3b82f6", page:"listings" },
    { icon:"💳", label:"Payments Waiting",   value:paidB,         color:"#f59e0b", page:"bookings", urgent:paidB>0 },
    { icon:"↩️", label:"Refund Requests",   value:refundB,       color:"#ef4444", page:"bookings", urgent:refundB>0 },
    { icon:"✅", label:"Confirmed Bookings", value:doneB,         color:"#15803d", page:"bookings" },
    { icon:"👥", label:"Total Users",        value:users.length,  color:"#8b5cf6", page:"users" },
    { icon:"🚫", label:"Banned",             value:banned,        color:"#ef4444", page:"users" },
  ];

  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",margin:"0 0 4px" }}>Good day 👑</h2>
      <p style={{ color:"#6b7280",margin:"0 0 22px" }}>Real-time data from your Supabase database.</p>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:26 }}>
        {stats.map(s=>(
          <div key={s.label} onClick={()=>s.page&&setPage(s.page)}
            style={{ background:"#fff",borderRadius:14,padding:"17px 19px",borderLeft:`4px solid ${s.color}`,boxShadow:s.urgent?`0 0 0 2px ${s.color}50,0 4px 16px rgba(0,0,0,.08)`:"0 2px 12px rgba(0,0,0,.06)",cursor:s.page?"pointer":"default",transition:"transform .2s",position:"relative" }}
            onMouseEnter={e=>s.page&&(e.currentTarget.style.transform="translateY(-3px)")}
            onMouseLeave={e=>s.page&&(e.currentTarget.style.transform="translateY(0)")}>
            {s.urgent&&<div style={{ position:"absolute",top:10,right:10,width:8,height:8,borderRadius:"50%",background:"#ef4444" }}/>}
            <div style={{ fontSize:"1.5rem",marginBottom:5 }}>{s.icon}</div>
            <div style={{ fontSize:"1.75rem",fontWeight:800,color:"#111",lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:".72rem",color:"#6b7280",marginTop:5,fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {(pending>0||paidB>0||refundB>0)&&(
        <div style={{ background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:14,padding:18,marginBottom:22 }}>
          <h3 style={{ margin:"0 0 10px",color:"#dc2626",fontFamily:"'Playfair Display',serif",fontSize:"1rem" }}>🚨 Needs Attention Now</h3>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {pending>0&&<Btn col="red" onClick={()=>setPage("listings")}>⏳ {pending} listing{pending>1?"s":""} waiting</Btn>}
            {paidB>0&&<Btn col="red" onClick={()=>setPage("bookings")}>💳 {paidB} payment{paidB>1?"s":""} to release</Btn>}
            {refundB>0&&<Btn col="red" onClick={()=>setPage("bookings")}>↩️ {refundB} refund{refundB>1?"s":""} to process</Btn>}
          </div>
        </div>
      )}

      <div style={{ background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <h3 style={{ margin:0,fontFamily:"'Playfair Display',serif",fontSize:"1.05rem" }}>Recent Bookings</h3>
          <Btn sm col="blue" onClick={()=>setPage("bookings")}>See All →</Btn>
        </div>
        {bookings.length===0&&<p style={{ color:"#9ca3af",textAlign:"center",padding:"20px 0" }}>No bookings yet.</p>}
        {bookings.slice(0,5).map(b=>(
          <div key={b.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6",flexWrap:"wrap",gap:7 }}>
            <div>
              <div style={{ fontWeight:700,fontSize:".86rem" }}>{b.tenant_name||"Unknown"}</div>
              <div style={{ color:"#6b7280",fontSize:".74rem" }}>{b.house?.title||"House"} • {ago(b.created_at)}</div>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ fontWeight:800,color:"#15803d",fontSize:".88rem" }}>{fmt(b.total_paid)}</span>
              <Chip s={b.status}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LISTINGS PAGE ────────────────────────────────────────────────────────────
function Listings({ listings, setListings, showToast, showConfirm, loading, err, reload }) {
  const [filter, setFilter] = useState("pending");
  const [sel,    setSel]    = useState(null);

  const visible = listings.filter(l => filter==="all" ? true : l.status===filter);

  const approve = (l) => showConfirm({
    icon:"✅", title:"Approve & Go Live?",
    msg:`"${l.title}" will be LIVE on NyumbaFind immediately. Make sure ID and Chief's letter are verified.`,
    action:"Yes, Approve & Go Live",
  }, async ok => {
    if (!ok) return;
    try {
      await db.patch("listings", { status:"active", id_checked:true, chief_verified:true }, `id=eq.${l.id}`);
      setListings(p => p.map(x => x.id===l.id ? {...x, status:"active", id_checked:true, chief_verified:true} : x));
      setSel(null);
      showToast(`✅ "${l.title}" is now LIVE on NyumbaFind!`);
    } catch(e) { showToast(null, e.message); }
  });

  const reject = (l) => showConfirm({
    icon:"❌", title:"Reject This Listing?",
    msg:`"${l.title}" will be rejected. WhatsApp the landlord to explain why.`,
    action:"Yes, Reject", danger:true,
  }, async ok => {
    if (!ok) return;
    try {
      await db.patch("listings", { status:"rejected" }, `id=eq.${l.id}`);
      setListings(p => p.map(x => x.id===l.id ? {...x, status:"rejected"} : x));
      setSel(null);
      showToast(`Listing rejected.`);
    } catch(e) { showToast(null, e.message); }
  });

  const remove = (l) => showConfirm({
    icon:"🏠", title:"Remove Listing?",
    msg:`Remove "${l.title}" from the site? Only do this when the house is rented.`,
    action:"Yes, Remove", danger:true,
  }, async ok => {
    if (!ok) return;
    try {
      await db.patch("listings", { status:"removed" }, `id=eq.${l.id}`);
      setListings(p => p.map(x => x.id===l.id ? {...x, status:"removed"} : x));
      showToast(`House removed from site.`);
    } catch(e) { showToast(null, e.message); }
  });

  const photo = l => (l.photos||[])[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=80";

  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",margin:"0 0 3px" }}>🏠 Listings</h2>
          <p style={{ color:"#6b7280",margin:0,fontSize:".82rem" }}>Every listing must be approved before going live.</p>
        </div>
        <Btn sm col="blue" onClick={reload}>🔄 Refresh</Btn>
      </div>

      <ErrBox msg={err} onRetry={reload}/>

      <div style={{ display:"flex",gap:7,marginBottom:18,flexWrap:"wrap" }}>
        {[["pending","⏳ Pending"],["active","✅ Live"],["rejected","❌ Rejected"],["removed","Removed"],["all","All"]].map(([v,l])=>{
          const cnt = listings.filter(x=>v==="all"?true:x.status===v).length;
          return <button key={v} onClick={()=>setFilter(v)} style={{ background:filter===v?"#052e16":"#f3f4f6",color:filter===v?"#4ade80":"#374151",border:"none",borderRadius:30,padding:"7px 15px",fontSize:".78rem",fontWeight:700,cursor:"pointer" }}>{l} ({cnt})</button>;
        })}
      </div>

      {loading&&<Spinner/>}
      {!loading&&visible.length===0&&<div style={{ textAlign:"center",padding:60,color:"#9ca3af" }}><div style={{ fontSize:"3rem" }}>🎉</div><p>Nothing here.</p></div>}

      <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
        {visible.map(l=>(
          <div key={l.id} style={{ background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.07)",display:"flex" }}>
            <img src={photo(l)} alt="" style={{ width:120,objectFit:"cover",flexShrink:0 }}/>
            <div style={{ padding:"14px 16px",flex:1 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5,flexWrap:"wrap",gap:6 }}>
                <div>
                  <h3 style={{ margin:"0 0 2px",fontFamily:"'Playfair Display',serif",fontSize:".96rem" }}>{l.title}</h3>
                  <p style={{ margin:"0 0 3px",color:"#6b7280",fontSize:".76rem" }}>📍 {l.location} • {fmt(l.price)}/mo • 🛏 {l.bedrooms} beds</p>
                  <p style={{ margin:0,color:"#9ca3af",fontSize:".71rem" }}>👤 {l.landlord_name||"Unknown"} • 📱 {l.landlord_phone||"—"} • ⏰ {ago(l.created_at)}</p>
                </div>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap",alignItems:"flex-start" }}>
                  <Chip s={l.status}/>
                  <span style={{ background:l.id_checked?"#f0fdf4":"#fef2f2",color:l.id_checked?"#15803d":"#ef4444",borderRadius:20,padding:"3px 8px",fontSize:".66rem",fontWeight:700 }}>{l.id_checked?"🪪 ID ✓":"🪪 ID ✗"}</span>
                  <span style={{ background:l.chief_verified?"#f0fdf4":"#fef2f2",color:l.chief_verified?"#15803d":"#ef4444",borderRadius:20,padding:"3px 8px",fontSize:".66rem",fontWeight:700 }}>{l.chief_verified?"👑 Chief ✓":"👑 Chief ✗"}</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:7,marginTop:9,flexWrap:"wrap" }}>
                <Btn sm onClick={()=>setSel(l)}>👁 Review</Btn>
                {l.status==="pending"&&<><Btn sm col="green" onClick={()=>approve(l)}>✅ Approve</Btn><Btn sm col="red" onClick={()=>reject(l)}>❌ Reject</Btn></>}
                {l.status==="active"&&<Btn sm col="orange" onClick={()=>remove(l)}>🏠 Mark Rented</Btn>}
                {l.landlord_phone&&<Btn sm col="wa" onClick={()=>window.open(waLink(l.landlord_phone,`Hi ${l.landlord_name||""}! This is NyumbaFind regarding your listing for ${l.title}.`),"_blank")}>💬 WhatsApp</Btn>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {sel&&(
        <div onClick={()=>setSel(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:24,maxWidth:540,width:"100%",maxHeight:"90vh",overflowY:"auto",animation:"fadeUp .3s ease" }}>
            <img src={photo(sel)} alt="" style={{ width:"100%",height:200,objectFit:"cover",borderRadius:"24px 24px 0 0" }}/>
            <div style={{ padding:22 }}>
              <h2 style={{ margin:"0 0 4px",fontFamily:"'Playfair Display',serif" }}>{sel.title}</h2>
              <p style={{ margin:"0 0 14px",color:"#6b7280",fontSize:".84rem" }}>📍 {sel.location} • {fmt(sel.price)}/mo</p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:16 }}>
                {[["Landlord",sel.landlord_name||"—"],["Phone",sel.landlord_phone||"—"],["Price",fmt(sel.price)+"/mo"],["Beds",`${sel.bedrooms} beds / ${sel.bathrooms} baths`],["Tier",sel.tier||"—"],["Submitted",ago(sel.created_at)]].map(([l,v])=>(
                  <div key={l} style={{ background:"#f9fafb",borderRadius:10,padding:"9px 12px" }}>
                    <div style={{ fontSize:".68rem",color:"#9ca3af",fontWeight:600,marginBottom:2 }}>{l}</div>
                    <div style={{ fontWeight:700,fontSize:".84rem" }}>{v}</div>
                  </div>
                ))}
              </div>
              {sel.description&&<p style={{ color:"#374151",lineHeight:1.7,marginBottom:14,fontSize:".86rem" }}>{sel.description}</p>}
              {(sel.amenities||[]).length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:".72rem",fontWeight:700,color:"#374151",marginBottom:7,textTransform:"uppercase" }}>Amenities</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>{(sel.amenities||[]).map(a=><span key={a} style={{ background:"#f0fdf4",color:"#15803d",padding:"3px 10px",borderRadius:20,fontSize:".73rem",fontWeight:600 }}>{a}</span>)}</div>
                </div>
              )}
              <div style={{ background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:13,marginBottom:16,fontSize:".78rem",color:"#92400e",lineHeight:2 }}>
                <strong>NyumbaFind Checklist:</strong><br/>
                {sel.id_checked?"✅":"☐"} National ID verified<br/>
                {sel.chief_verified?"✅":"☐"} Chief's letter confirmed + called Chief directly<br/>
                ☐ Video call — landlord inside house, holding ID<br/>
                ☐ Photos taken by NyumbaFind agent
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                <Btn col="gray" onClick={()=>setSel(null)}>Close</Btn>
                {sel.landlord_phone&&<Btn col="wa" onClick={()=>window.open(waLink(sel.landlord_phone,`Hi ${sel.landlord_name||""}! This is NyumbaFind. We are reviewing your listing for ${sel.title}.`),"_blank")}>💬 WhatsApp</Btn>}
                {sel.status==="pending"&&<><Btn col="green" onClick={()=>approve(sel)}>✅ Approve & Go Live</Btn><Btn col="red" onClick={()=>reject(sel)}>❌ Reject</Btn></>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOOKINGS PAGE ────────────────────────────────────────────────────────────
function Bookings({ bookings, setBookings, setListings, showToast, showConfirm, loading, err, reload }) {
  const [filter, setFilter] = useState("all");
  const visible = bookings.filter(b=>filter==="all"?true:b.status===filter);

  const scheduleViewing = async (b) => {
    try {
      await db.patch("bookings", { status:"viewing_scheduled" }, `id=eq.${b.id}`);
      setBookings(p=>p.map(x=>x.id===b.id?{...x,status:"viewing_scheduled"}:x));
      showToast(`🗓 Viewing scheduled for ${b.house?.title||"house"}. WhatsApp both parties!`);
    } catch(e) { showToast(null, e.message); }
  };

  const releasePayment = (b) => showConfirm({
    icon:"💸", title:"Release Payment to Landlord?",
    msg:`Tenant confirmed the house. Release ${fmt(b.deposit_amount)} to ${b.landlord_name||"landlord"}? NyumbaFind keeps ${fmt(b.service_fee)} service fee.`,
    action:"Yes, Release Payment",
  }, async ok => {
    if (!ok) return;
    try {
      await db.patch("bookings", { status:"confirmed" }, `id=eq.${b.id}`);
      // Remove house from site immediately
      if (b.listing_id) await db.patch("listings", { status:"removed" }, `id=eq.${b.listing_id}`);
      setBookings(p=>p.map(x=>x.id===b.id?{...x,status:"confirmed"}:x));
      setListings(p=>p.map(l=>l.id===b.listing_id?{...l,status:"removed"}:l));
      showToast(`💸 ${fmt(b.deposit_amount)} released! House removed from site. NyumbaFind earned ${fmt(b.service_fee)}.`);
    } catch(e) { showToast(null, e.message); }
  });

  const issueRefund = (b) => {
    const refAmt = Math.round((b.deposit_amount||0)*0.9);
    const keepAmt = Math.round((b.deposit_amount||0)*0.1);
    showConfirm({
      icon:"↩️", title:"Issue Refund?",
      msg:`Refund ${fmt(refAmt)} (90%) to ${b.tenant_name||"tenant"}? NyumbaFind keeps ${fmt(keepAmt)} inspection fee.`,
      action:"Yes, Issue Refund", danger:true,
    }, async ok => {
      if (!ok) return;
      try {
        await db.patch("bookings", { status:"refunded", refund_amount:refAmt }, `id=eq.${b.id}`);
        setBookings(p=>p.map(x=>x.id===b.id?{...x,status:"refunded",refund_amount:refAmt}:x));
        showToast(`↩️ ${fmt(refAmt)} refunded to ${b.tenant_name||"tenant"}. NyumbaFind kept ${fmt(keepAmt)}.`);
      } catch(e) { showToast(null, e.message); }
    });
  };

  const tabs=[["all","All"],["payment_received","💳 Paid"],["viewing_scheduled","🗓 Viewing"],["confirmed","✅ Confirmed"],["refund_requested","↩️ Refund"],["refunded","Refunded"]];

  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",margin:"0 0 3px" }}>📋 Bookings</h2>
          <p style={{ color:"#6b7280",margin:0,fontSize:".82rem" }}>Every payment goes through you. You decide when money moves.</p>
        </div>
        <Btn sm col="blue" onClick={reload}>🔄 Refresh</Btn>
      </div>

      <ErrBox msg={err} onRetry={reload}/>

      <div style={{ display:"flex",gap:7,marginBottom:18,flexWrap:"wrap" }}>
        {tabs.map(([v,l])=>{
          const cnt=bookings.filter(b=>v==="all"?true:b.status===v).length;
          const urg=(v==="payment_received"||v==="refund_requested")&&cnt>0;
          return <button key={v} onClick={()=>setFilter(v)} style={{ background:filter===v?"#052e16":"#f3f4f6",color:filter===v?"#4ade80":"#374151",border:urg?"1.5px solid #ef4444":"none",borderRadius:30,padding:"7px 14px",fontSize:".77rem",fontWeight:700,cursor:"pointer" }}>{l}{cnt>0?` (${cnt})`:""}{urg?" 🔴":""}</button>;
        })}
      </div>

      {loading&&<Spinner/>}
      {!loading&&visible.length===0&&<div style={{ textAlign:"center",padding:60,color:"#9ca3af" }}><div style={{ fontSize:"3rem" }}>📭</div><p>Nothing here.</p></div>}

      <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
        {visible.map(b=>(
          <div key={b.id} style={{ background:"#fff",borderRadius:16,padding:"17px 19px",boxShadow:"0 2px 12px rgba(0,0,0,.07)",borderLeft:`4px solid ${b.status==="payment_received"||b.status==="refund_requested"?"#ef4444":"#e5e7eb"}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9,flexWrap:"wrap",gap:7 }}>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap" }}>
                  <h3 style={{ margin:0,fontFamily:"'Playfair Display',serif",fontSize:".96rem" }}>{b.house?.title||"House"}</h3>
                  <Chip s={b.status}/>
                </div>
                <p style={{ margin:"0 0 3px",color:"#6b7280",fontSize:".76rem" }}>📍 {b.house?.location||"—"} • {ago(b.created_at)} • {b.pay_method||"—"}</p>
                <p style={{ margin:"0 0 2px",fontSize:".76rem",color:"#374151" }}>👤 Tenant: <strong>{b.tenant_name||"—"}</strong> 📱 {b.tenant_phone||"—"}</p>
                <p style={{ margin:0,fontSize:".76rem",color:"#374151" }}>🏠 Landlord: <strong>{b.landlord_name||"—"}</strong> 📱 {b.landlord_phone||"—"}</p>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontSize:"1.2rem",fontWeight:800,color:"#15803d" }}>{fmt(b.total_paid)}</div>
                <div style={{ fontSize:".68rem",color:"#9ca3af" }}>Deposit: {fmt(b.deposit_amount)}</div>
                <div style={{ fontSize:".68rem",color:"#15803d",fontWeight:700 }}>Your fee: {fmt(b.service_fee)}</div>
                {b.refund_amount&&<div style={{ fontSize:".68rem",color:"#8b5cf6",fontWeight:700 }}>Refunded: {fmt(b.refund_amount)}</div>}
              </div>
            </div>
            <div style={{ display:"flex",gap:7,flexWrap:"wrap",borderTop:"1px solid #f3f4f6",paddingTop:10 }}>
              {b.tenant_phone&&<Btn sm col="wa" onClick={()=>window.open(waLink(b.tenant_phone,`Hi ${b.tenant_name||""}! NyumbaFind here — regarding your booking.`),"_blank")}>💬 Tenant</Btn>}
              {b.landlord_phone&&<Btn sm col="wa" onClick={()=>window.open(waLink(b.landlord_phone,`Hi ${b.landlord_name||""}! NyumbaFind here — regarding your property.`),"_blank")}>💬 Landlord</Btn>}
              {b.status==="payment_received"&&<>
                <Btn sm col="blue"  onClick={()=>scheduleViewing(b)}>🗓 Schedule Viewing</Btn>
                <Btn sm col="green" onClick={()=>releasePayment(b)}>💸 Release to Landlord</Btn>
                <Btn sm col="red"   onClick={()=>issueRefund(b)}>↩️ Refund</Btn>
              </>}
              {b.status==="viewing_scheduled"&&<>
                <Btn sm col="green" onClick={()=>releasePayment(b)}>✅ Tenant Happy — Release</Btn>
                <Btn sm col="red"   onClick={()=>issueRefund(b)}>↩️ Refund</Btn>
              </>}
              {b.status==="refund_requested"&&<Btn sm col="red" onClick={()=>issueRefund(b)}>↩️ Process Refund Now</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── USERS PAGE ───────────────────────────────────────────────────────────────
function Users({ users, setUsers, showToast, showConfirm, loading, err, reload }) {
  const [search, setSearch] = useState("");
  const visible = users.filter(u=>!search||u.first_name?.toLowerCase().includes(search.toLowerCase())||u.last_name?.toLowerCase().includes(search.toLowerCase())||u.phone?.includes(search)||u.email?.includes(search));

  const ban = (u) => showConfirm({
    icon:"🚫", title:`Ban ${u.first_name} ${u.last_name}?`,
    msg:"They will be permanently banned and cannot re-register.",
    action:"Yes, Ban & Blacklist", danger:true,
  }, async ok => {
    if (!ok) return;
    try {
      await db.patch("users", { is_banned:true, ban_reason:"Banned by NyumbaFind admin" }, `id=eq.${u.id}`);
      setUsers(p=>p.map(x=>x.id===u.id?{...x,is_banned:true}:x));
      showToast(`🚫 ${u.first_name} ${u.last_name} has been banned.`);
    } catch(e) { showToast(null, e.message); }
  });

  const unban = async (u) => {
    try {
      await db.patch("users", { is_banned:false, ban_reason:null }, `id=eq.${u.id}`);
      setUsers(p=>p.map(x=>x.id===u.id?{...x,is_banned:false}:x));
      showToast(`✅ ${u.first_name} ${u.last_name} has been unbanned.`);
    } catch(e) { showToast(null, e.message); }
  };

  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",margin:"0 0 3px" }}>👥 Users</h2>
          <p style={{ color:"#6b7280",margin:0,fontSize:".82rem" }}>All tenants and landlords on NyumbaFind.</p>
        </div>
        <Btn sm col="blue" onClick={reload}>🔄 Refresh</Btn>
      </div>
      <ErrBox msg={err} onRetry={reload}/>
      <input placeholder="🔍 Search name, email or phone..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 15px",fontSize:".88rem",marginBottom:16,outline:"none",fontFamily:"inherit" }}/>
      <div style={{ display:"flex",gap:9,marginBottom:15 }}>
        {[["All",users.length,"#374151"],["Active",users.filter(u=>!u.is_banned).length,"#15803d"],["Banned",users.filter(u=>u.is_banned).length,"#ef4444"]].map(([l,c,col])=>(
          <div key={l} style={{ background:"#fff",borderRadius:10,padding:"7px 15px",fontSize:".78rem",fontWeight:700,color:col,boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>{l}: {c}</div>
        ))}
      </div>
      {loading&&<Spinner/>}
      {!loading&&visible.length===0&&<div style={{ textAlign:"center",padding:60,color:"#9ca3af" }}><div style={{ fontSize:"3rem" }}>👥</div><p>No users found.</p></div>}
      <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
        {visible.map(u=>(
          <div key={u.id} style={{ background:"#fff",borderRadius:13,padding:"14px 18px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:9,opacity:u.is_banned?.6:1,borderLeft:`3px solid ${u.is_banned?"#ef4444":u.role==="landlord"?"#3b82f6":"#15803d"}` }}>
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                <div style={{ width:32,height:32,borderRadius:"50%",background:u.role==="landlord"?"#eff6ff":"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".95rem" }}>{u.role==="landlord"?"🏠":"👤"}</div>
                <div>
                  <div style={{ fontWeight:700,fontSize:".88rem" }}>{u.first_name} {u.last_name}</div>
                  <div style={{ fontSize:".71rem",color:"#6b7280" }}>{u.email} • {u.phone}</div>
                </div>
              </div>
              <div style={{ display:"flex",gap:5,flexWrap:"wrap",paddingLeft:40 }}>
                <span style={{ background:u.role==="landlord"?"#eff6ff":"#f0fdf4",color:u.role==="landlord"?"#3b82f6":"#15803d",borderRadius:20,padding:"2px 8px",fontSize:".65rem",fontWeight:700,textTransform:"uppercase" }}>{u.role||"tenant"}</span>
                <span style={{ background:u.is_banned?"#fef2f2":"#f0fdf4",color:u.is_banned?"#ef4444":"#15803d",borderRadius:20,padding:"2px 8px",fontSize:".65rem",fontWeight:700 }}>{u.is_banned?"🚫 Banned":"✅ Active"}</span>
                <span style={{ color:"#9ca3af",fontSize:".68rem" }}>Joined {ago(u.created_at)}</span>
                {u.ban_reason&&<span style={{ color:"#ef4444",fontSize:".65rem" }}>{u.ban_reason}</span>}
              </div>
            </div>
            <div style={{ display:"flex",gap:7 }}>
              {u.phone&&<Btn sm col="wa" onClick={()=>window.open(waLink(u.phone,`Hi ${u.first_name||""}! This is NyumbaFind.`),"_blank")}>💬</Btn>}
              {!u.is_banned?<Btn sm col="red" onClick={()=>ban(u)}>🚫 Ban</Btn>:<Btn sm col="blue" onClick={()=>unban(u)}>✅ Unban</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── CREATE LISTING PAGE ──────────────────────────────────────────────────────
function CreateListing({ setListings, showToast, setPage }) {
  const [form, setForm] = useState({
    title:"", location:"", city:"Lilongwe", price:"",
    bedrooms:"", bathrooms:"", tier:"basic",
    description:"", landlord_name:"", landlord_phone:"",
    chief_name:"", national_id:"", amenities:"",
  });
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const s = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 13px", fontSize:".88rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  const submit = async (status) => {
    if (!form.title||!form.location||!form.price||!form.landlord_name||!form.landlord_phone) {
      setErr("Please fill in all required fields marked with *"); return;
    }
    setLoading(true); setErr("");
    try {
      const data = {
        title:          form.title,
        location:       form.location,
        city:           form.city,
        price:          parseInt(form.price),
        bedrooms:       parseInt(form.bedrooms)||1,
        bathrooms:      parseInt(form.bathrooms)||1,
        tier:           form.tier,
        description:    form.description,
        landlord_name:  form.landlord_name,
        landlord_phone: form.landlord_phone,
        amenities:      form.amenities ? form.amenities.split(",").map(a=>a.trim()).filter(Boolean) : [],
        status:         status,
        id_checked:     status==="active",
        chief_verified: status==="active",
      };
      const result = await db.post("listings", data);
      setListings(p => [...p, ...(Array.isArray(result)?result:[result])]);
      showToast(status==="active" ? `✅ "${form.title}" is LIVE on NyumbaFind!` : `⏳ "${form.title}" saved as pending.`);
      setPage("listings");
    } catch(e) { setErr("Failed to save: " + e.message); }
    setLoading(false);
  };

  const fields = [
    ["Property Title *",        "title",          "text",   "e.g. Modern 3-Bed in Area 47"],
    ["Location / Neighbourhood *","location",      "text",   "e.g. Area 47, Lilongwe"],
    ["Landlord Full Name *",    "landlord_name",  "text",   "e.g. James Phiri"],
    ["Landlord WhatsApp *",     "landlord_phone", "tel",    "e.g. 0991234567"],
    ["Monthly Rent (MWK) *",    "price",          "number", "e.g. 120000"],
    ["Bedrooms",                "bedrooms",       "number", "e.g. 3"],
    ["Bathrooms",               "bathrooms",      "number", "e.g. 2"],
    ["Chief / Headman Name",    "chief_name",     "text",   "Name of area chief"],
    ["Landlord National ID",    "national_id",    "text",   "e.g. 12345678A"],
    ["Amenities (comma separated)","amenities",   "text",   "e.g. Borehole, Parking, Generator"],
  ];

  return (
    <div style={{ animation:"fadeUp .4s ease", maxWidth:620 }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.7rem", margin:"0 0 4px" }}>➕ Post New Listing</h2>
      <p style={{ color:"#6b7280", margin:"0 0 22px", fontSize:".84rem" }}>Fill in the landlord's details. You can post directly as LIVE or save as pending first.</p>

      <div style={{ background:"#fff", borderRadius:18, padding:24, boxShadow:"0 4px 24px rgba(0,0,0,.08)" }}>
        {err&&<div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:10, padding:"10px 14px", color:"#dc2626", fontSize:".82rem", marginBottom:16 }}>❌ {err}</div>}

        {fields.map(([label,key,type,placeholder])=>(
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontWeight:600, marginBottom:4, color:"#374151", fontSize:".83rem" }}>{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]} onChange={e=>s(key,e.target.value)}
              style={inp} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
          </div>
        ))}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontWeight:600, marginBottom:4, color:"#374151", fontSize:".83rem" }}>City</label>
          <select value={form.city} onChange={e=>s("city",e.target.value)} style={{...inp, background:"#fff"}}>
            {["Lilongwe","Blantyre","Mzuzu","Zomba","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontWeight:600, marginBottom:4, color:"#374151", fontSize:".83rem" }}>Tier</label>
          <select value={form.tier} onChange={e=>s("tier",e.target.value)} style={{...inp, background:"#fff"}}>
            <option value="basic">🌿 Basic (MWK 30k–80k/mo)</option>
            <option value="standard">🏠 Standard (MWK 80k–250k/mo)</option>
            <option value="premium">✨ Premium (MWK 250k+/mo)</option>
          </select>
        </div>

        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontWeight:600, marginBottom:4, color:"#374151", fontSize:".83rem" }}>Description</label>
          <textarea rows={4} placeholder="Describe the property — water supply, security, nearby landmarks..." value={form.description} onChange={e=>s("description",e.target.value)}
            style={{...inp, resize:"vertical"}} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
        </div>

        <div style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:12, padding:14, marginBottom:20, fontSize:".78rem", color:"#15803d", lineHeight:1.8 }}>
          ✅ <strong>Before posting as LIVE make sure:</strong><br/>
          🪪 You have seen the landlord's National ID<br/>
          👑 You have the Chief's verification letter<br/>
          📸 You have real photos of the property<br/>
          📞 You have called the Chief to confirm
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>setPage("listings")} style={{ flex:1, background:"#f3f4f6", border:"none", borderRadius:12, padding:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>submit("pending")} disabled={loading} style={{ flex:1, background:"#fffbeb", color:"#f59e0b", border:"1.5px solid #fde68a", borderRadius:12, padding:13, fontWeight:700, cursor:"pointer" }}>
            {loading?"Saving...":"⏳ Save as Pending"}
          </button>
          <button onClick={()=>submit("active")} disabled={loading} style={{ flex:2, background:"linear-gradient(135deg,#15803d,#4ade80)", color:"#fff", border:"none", borderRadius:12, padding:13, fontWeight:700, cursor:"pointer", boxShadow:"0 6px 20px rgba(21,128,61,.28)" }}>
            {loading?"Posting...":"✅ Post Live Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── REVENUE PAGE ─────────────────────────────────────────────────────────────
function Revenue({ bookings, loading }) {
  const earned  = bookings.filter(b=>["confirmed","completed"].includes(b.status));
  const total   = earned.reduce((s,b)=>s+(b.service_fee||0),0);
  const pending = bookings.filter(b=>b.status==="payment_received").reduce((s,b)=>s+(b.service_fee||0),0);
  const refunded= bookings.filter(b=>b.status==="refunded").length;

  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",margin:"0 0 4px" }}>💰 Revenue</h2>
      <p style={{ color:"#6b7280",margin:"0 0 22px" }}>Your NyumbaFind earnings — every kwacha from real Supabase data.</p>
      {loading&&<Spinner/>}
      {!loading&&(
        <>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:13,marginBottom:26 }}>
            {[["Confirmed Revenue",fmt(total),"#15803d","Collected"],["Pending Release",fmt(pending),"#f59e0b","Not yet released"],["Bookings Earned",earned.length,"#3b82f6","Completed"],["Refunds Issued",refunded,"#ef4444","Returned"]].map(([l,v,c,sub])=>(
              <div key={l} style={{ background:"#fff",borderRadius:13,padding:"17px 19px",borderTop:`3px solid ${c}`,boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize:".7rem",color:"#9ca3af",fontWeight:600,marginBottom:5,textTransform:"uppercase" }}>{l}</div>
                <div style={{ fontSize:"1.4rem",fontWeight:800,color:"#111" }}>{v}</div>
                <div style={{ fontSize:".7rem",color:"#9ca3af",marginTop:3 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 14px",fontSize:"1.05rem" }}>Every Transaction</h3>
            {bookings.length===0&&<p style={{ color:"#9ca3af",textAlign:"center",padding:30 }}>No bookings yet.</p>}
            {bookings.map(b=>(
              <div key={b.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:"1px solid #f3f4f6",flexWrap:"wrap",gap:7 }}>
                <div>
                  <div style={{ fontWeight:700,fontSize:".84rem" }}>{b.house?.title||"House"}</div>
                  <div style={{ color:"#6b7280",fontSize:".72rem" }}>{b.tenant_name||"—"} • {ago(b.created_at)} • {b.pay_method||"—"}</div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:".76rem",color:"#9ca3af" }}>Total: {fmt(b.total_paid)}</div>
                    <div style={{ fontWeight:800,color:"#15803d",fontSize:".86rem" }}>Fee: {fmt(b.service_fee)}</div>
                    {b.refund_amount&&<div style={{ fontWeight:700,color:"#8b5cf6",fontSize:".76rem" }}>Refunded: {fmt(b.refund_amount)}</div>}
                  </div>
                  <Chip s={b.status}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [page,     setPage]     = useState("dashboard");

  // Real Supabase data
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [dataErr,  setDataErr]  = useState("");

  // UI state
  const [toast,   setToast]   = useState({ msg:"", err:"" });
  const [confirm, setConfirm] = useState(null);

  const showToast = (msg, err="") => {
    setToast({ msg, err });
    setTimeout(() => setToast({ msg:"", err:"" }), 3500);
  };
  const showConfirm = (cfg, cb) => setConfirm({ ...cfg, cb });

  // ── Load data from Supabase ──
  const loadData = useCallback(async () => {
    setLoading(true); setDataErr("");
    try {
      const [L, B, U] = await Promise.all([
        db.get("listings", "order=created_at.desc"),
        db.get("bookings", "order=created_at.desc"),
        db.get("users",    "order=created_at.desc"),
      ]);
      setListings(Array.isArray(L) ? L : []);
      setBookings(Array.isArray(B) ? B : []);
      setUsers(Array.isArray(U)    ? U : []);
    } catch(e) {
      setDataErr("Could not load data from Supabase: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (loggedIn) loadData(); }, [loggedIn, loadData]);

  // ── Login ──
  const login = () => {
    if (email==="admin@nyumbafind.mw" && pass==="Nyumba@2025") {
      setLoggedIn(true); setLoginErr("");
    } else {
      setLoginErr("Wrong email or password.");
    }
  };

  const pendingBadge = listings.filter(l=>l.status==="pending").length;
  const urgentBadge  = bookings.filter(b=>b.status==="payment_received"||b.status==="refund_requested").length;

  // ── LOGIN SCREEN ──
  if (!loggedIn) return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(135deg,#052e16,#14532d,#15803d)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700;800&display=swap'); @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
      <div style={{ background:"#fff",borderRadius:24,maxWidth:400,width:"100%",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.35)",animation:"fadeUp .5s ease" }}>
        <div style={{ background:"linear-gradient(135deg,#052e16,#15803d)",padding:"30px 26px 26px",textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem",marginBottom:8 }}>🏠</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif",color:"#fff",fontSize:"1.4rem",margin:"0 0 5px" }}>NyumbaFind Admin</h1>
          <p style={{ color:"#86efac",margin:0,fontSize:".8rem" }}>Private Access Only 👑</p>
          <div style={{ display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginTop:10 }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:"#4ade80",animation:"pulse 1.5s infinite" }}/>
            <span style={{ color:"#4ade80",fontSize:".72rem",fontWeight:700 }}>Connected to Supabase</span>
          </div>
        </div>
        <div style={{ padding:"24px" }}>
          <label style={{ display:"block",fontSize:".8rem",fontWeight:700,color:"#374151",marginBottom:5 }}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@nyumbafind.mw" type="email" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"11px 13px",fontSize:".9rem",marginBottom:13,fontFamily:"inherit",outline:"none" }}
            onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
          <label style={{ display:"block",fontSize:".8rem",fontWeight:700,color:"#374151",marginBottom:5 }}>Password</label>
          <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"11px 13px",fontSize:".9rem",marginBottom:13,fontFamily:"inherit",outline:"none" }}
            onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
          {loginErr&&<div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",fontSize:".76rem",color:"#ef4444",marginBottom:13 }}>{loginErr}</div>}
          <button onClick={login} style={{ width:"100%",background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:12,padding:14,fontWeight:700,fontSize:"1rem",cursor:"pointer" }}>Login to Admin →</button>
          <div style={{ background:"#f0fdf4",borderRadius:10,padding:10,marginTop:13,fontSize:".72rem",color:"#15803d",textAlign:"center",lineHeight:1.7 }}>🔑 admin@nyumbafind.mw &nbsp;/&nbsp; admin123</div>
        </div>
      </div>
    </div>
  );

  const nav=[
    { id:"dashboard", icon:"📊", label:"Dashboard" },
    { id:"create",    icon:"➕", label:"Post Listing" },
    { id:"listings",  icon:"🏠", label:"Listings",  badge:pendingBadge },
    { id:"bookings",  icon:"📋", label:"Bookings",  badge:urgentBadge },
    { id:"users",     icon:"👥", label:"Users" },
    { id:"revenue",   icon:"💰", label:"Revenue" },
  ];

  return (
    <div style={{ minHeight:"100vh",background:"#f8fdf9",fontFamily:"'DM Sans',sans-serif",display:"flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:3px}
        input,select,textarea{font-family:inherit}
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width:200,background:"#052e16",minHeight:"100vh",padding:"20px 12px",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto" }}>
        <div style={{ textAlign:"center",marginBottom:20,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontSize:"1.6rem",marginBottom:3 }}>🏠</div>
          <div style={{ fontFamily:"'Playfair Display',serif",color:"#fff",fontWeight:900,fontSize:".95rem" }}>Nyumba<span style={{ color:"#4ade80" }}>Find</span></div>
          <div style={{ color:"#4ade80",fontSize:".58rem",fontWeight:700,letterSpacing:".1em",marginTop:2 }}>ADMIN PANEL</div>
          {/* Live Supabase indicator */}
          <div style={{ display:"flex",alignItems:"center",gap:5,justifyContent:"center",marginTop:8 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s infinite" }}/>
            <span style={{ color:"#4ade80",fontSize:".62rem",fontWeight:600 }}>Live Database</span>
          </div>
        </div>

        <div style={{ flex:1 }}>
          {nav.map(n=>{ const active=page===n.id; return (
            <button key={n.id} onClick={()=>setPage(n.id)} style={{ width:"100%",display:"flex",alignItems:"center",gap:8,background:active?"rgba(74,222,128,.15)":"transparent",color:active?"#4ade80":"rgba(255,255,255,.55)",border:active?"1px solid rgba(74,222,128,.2)":"1px solid transparent",borderRadius:9,padding:"9px 11px",marginBottom:3,cursor:"pointer",fontSize:".8rem",fontWeight:active?700:500,textAlign:"left",transition:"all .2s" }}>
              <span>{n.icon}</span><span style={{ flex:1 }}>{n.label}</span>
              {n.badge>0&&<span style={{ background:"#ef4444",color:"#fff",borderRadius:"50%",minWidth:17,height:17,fontSize:".58rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center" }}>{n.badge}</span>}
            </button>
          );})}
        </div>

        <div style={{ borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:12 }}>
          <div style={{ color:"rgba(255,255,255,.35)",fontSize:".65rem",marginBottom:3 }}>Logged in as</div>
          <div style={{ color:"#fff",fontWeight:700,fontSize:".8rem",marginBottom:10 }}>NyumbaFind 👑</div>
          <button onClick={()=>loadData()} style={{ width:"100%",background:"rgba(74,222,128,.12)",color:"#4ade80",border:"1px solid rgba(74,222,128,.22)",borderRadius:7,padding:"7px",fontSize:".72rem",fontWeight:600,cursor:"pointer",marginBottom:6 }}>🔄 Refresh Data</button>
          <button onClick={()=>setLoggedIn(false)} style={{ width:"100%",background:"rgba(239,68,68,.12)",color:"#f87171",border:"1px solid rgba(239,68,68,.22)",borderRadius:7,padding:"7px",fontSize:".72rem",fontWeight:600,cursor:"pointer" }}>🚪 Logout</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex:1,padding:"24px",overflowY:"auto",maxHeight:"100vh" }}>
        {dataErr&&!loading&&(
          <div style={{ background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,padding:"14px 18px",color:"#dc2626",fontSize:".84rem",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span>❌ {dataErr}</span>
            <button onClick={loadData} style={{ background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:".78rem",fontWeight:700,cursor:"pointer" }}>Retry</button>
          </div>
        )}
        {page==="create"   &&<CreateListing setListings={setListings} showToast={showToast} setPage={setPage}/>}
        {page==="dashboard"&&<Dashboard setPage={setPage} listings={listings} bookings={bookings} users={users}/>}
        {page==="create"   &&<CreateListing setListings={setListings} showToast={showToast} setPage={setPage}/>}
        {page==="listings" &&<Listings  listings={listings} setListings={setListings} showToast={showToast} showConfirm={showConfirm} loading={loading} err={dataErr} reload={loadData}/>}
        {page==="bookings" &&<Bookings  bookings={bookings} setBookings={setBookings} setListings={setListings} showToast={showToast} showConfirm={showConfirm} loading={loading} err={dataErr} reload={loadData}/>}
        {page==="users"    &&<Users     users={users} setUsers={setUsers} showToast={showToast} showConfirm={showConfirm} loading={loading} err={dataErr} reload={loadData}/>}
        {page==="revenue"  &&<Revenue   bookings={bookings} loading={loading}/>}
      </div>

      <Toast msg={toast.msg} err={toast.err}/>
      <Confirm cfg={confirm} onDone={ok=>{ if(ok) confirm.cb(); setConfirm(null); }}/>
    </div>
  );
}
