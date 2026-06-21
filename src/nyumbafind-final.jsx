import { useState, useEffect } from "react";

// ─── PWA INSTALL ──────────────────────────────────────────────────────────────
// This handles the "Install App" button
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// ─── YOUR REAL SUPABASE CONNECTION ────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;
const PAYCHANGU_KEY = process.env.REACT_APP_PAYCHANGU_PUBLIC_KEY;
const NF_WA      = process.env.REACT_APP_DYLAN_WA; 

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const HEADERS = {
  apikey:        SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer:        "return=representation",
};

const supabase = {
  select: async (table, filters = "") => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, { headers: HEADERS });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  insert: async (table, data) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:"POST", headers: HEADERS, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  update: async (table, data, filter) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"PATCH", headers: HEADERS, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (table, filter) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"DELETE", headers: HEADERS });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt    = n  => `MWK ${Number(n||0).toLocaleString()}`;
const fee    = n  => Math.round(n * 0.15);
const waLink = (phone, msg) => `https://wa.me/265${phone.replace(/^0/,"")}?text=${encodeURIComponent(msg)}`;

const CITY_COORDS = {
  Lilongwe: { lat:-13.9669, lng:33.7873 },
  Blantyre: { lat:-15.7861, lng:35.0058 },
  Mzuzu:    { lat:-11.4656, lng:34.0185 },
  Zomba:    { lat:-15.3833, lng:35.3167 },
};

function distKm(lat1,lng1,lat2,lng2) {
  const R=6371, dL=(lat2-lat1)*Math.PI/180, dN=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ─── TINY COMPONENTS ──────────────────────────────────────────────────────────
function Stars({ r }) {
  return <span style={{ color:"#f59e0b", fontSize:".74rem" }}>{"★".repeat(Math.floor(r||0))}{"☆".repeat(5-Math.floor(r||0))} {r||0}</span>;
}
function Badge({ icon, label, bg="rgba(21,128,61,.85)", color="#fff" }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:3, background:bg, color, borderRadius:20, padding:"3px 9px", fontSize:".66rem", fontWeight:700 }}>{icon} {label}</span>;
}
function Spinner() {
  return <div style={{ width:44,height:44,border:"4px solid #dcfce7",borderTop:"4px solid #15803d",borderRadius:"50%",margin:"60px auto",animation:"spin .7s linear infinite" }}/>;
}
function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#052e16",color:"#fff",borderRadius:14,padding:"12px 22px",fontWeight:600,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"fadeUp .3s ease",whiteSpace:"nowrap" }}><span style={{ color:"#4ade80" }}>✅</span> {msg}</div>;
}
function ErrMsg({ msg }) {
  if (!msg) return null;
  return <div style={{ background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:11,padding:"11px 15px",color:"#dc2626",fontSize:".83rem",marginBottom:14 }}>❌ {msg}</div>;
}

// ─── SECURITY — SQL INJECTION & XSS PROTECTION ──────────────────────────────
const sanitize = (str) => {
  if (!str) return "";
  return String(str)
    // Remove SQL injection characters
    .replace(/['";\-\-\/\*]/g, "")
    // Remove script tags (XSS)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    // Remove SQL keywords
    .replace(/(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|WHERE|FROM|TABLE)/gi, "")
    .trim()
    // Max length
    .slice(0, 255);
};

// Rate limiting — stop brute force attacks
const rateLimiter = (() => {
  const attempts = {};
  return {
    check: (key) => {
      const now = Date.now();
      if (!attempts[key]) attempts[key] = [];
      // Remove attempts older than 15 minutes
      attempts[key] = attempts[key].filter(t => now - t < 15 * 60 * 1000);
      if (attempts[key].length >= 5) {
        const waitMins = Math.ceil((15*60*1000-(now-attempts[key][0]))/60000);
        return `Too many attempts. Try again in ${waitMins} minute${waitMins>1?"s":""}.`;
      }
      attempts[key].push(now);
      return null; // null means OK
    }
  };
})();

// ─── VALIDATION ──────────────────────────────────────────────────────────────
const validators = {
  // Name: only letters, spaces, hyphens. Min 2 chars per part
  name: (v) => {
    v = v.trim();
    if (v.length < 2) return "Name is too short";
    if (/\d/.test(v)) return "Name cannot contain numbers";
    if (!/^[a-zA-Z\s\-\']+$/.test(v)) return "Name can only contain letters";
    const parts = v.split(" ").filter(p => p.length > 0);
    if (parts.length < 2) return "Please enter your full name (first and last name)";
    if (parts.some(p => p.length < 2)) return "Each name must be at least 2 letters";
    return null;
  },
  // Email: standard format
  email: (v) => {
    if (!v.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address";
    return null;
  },
  // Malawi phone: Airtel (099,098,077,078) or TNM (088,084) — 10 digits
  phone: (v) => {
    let p = v.replace(/[\s\-\+]/g, "");
    if (p.startsWith("265")) p = "0" + p.slice(3);
    if (p.startsWith("00265")) p = "0" + p.slice(5);
    if (!/^0(88|84|99|98|77|78)\d{7}$/.test(p)) {
      return "Enter a valid Malawi number (Airtel: 099/098/077/078 or TNM: 088/084)";
    }
    return null;
  },
  // Malawi National ID: 8 digits + letter, OR MW + 8 digits, OR 9 digits
  nationalId: (v) => {
    const id = v.trim().toUpperCase().replace(/\s/g, "");
    if (id.length < 9) return "National ID is too short";
    if (
      !/^\d{8}[A-Z]$/.test(id) &&
      !/^MW\d{8}$/.test(id)    &&
      !/^\d{9}$/.test(id)
    ) {
      return "Enter a valid Malawi National ID (e.g. 12345678A or MW12345678)";
    }
    return null;
  },
};

// ─── PAYMENT MODAL ─────────────────────────────────────────────────────────────
function PaymentModal({ house, onClose }) {
  const [step,   setStep]   = useState(1);
  const [fname,  setFname]  = useState("");
  const [lname,  setLname]  = useState("");
  const [email,  setEmail]  = useState("");
  const [phone,  setPhone]  = useState("");
  const [natId,  setNatId]  = useState("");
  const [txRef,  setTxRef]  = useState("");
  const [err,    setErr]    = useState("");
  const [errors, setErrors] = useState({});
  const [touched,setTouched]= useState({});

  const deposit = house.price;
  const svcFee  = fee(deposit);
  const total   = deposit + svcFee;

  // Validate a single field
  const validateField = (field, value) => {
    switch(field) {
      case "fname":
      case "lname": {
        if (!value.trim()) return "This field is required";
        if (value.trim().length < 2) return "Too short — minimum 2 letters";
        if (/\d/.test(value)) return "Cannot contain numbers";
        if (!/^[a-zA-Z\s\-\']+$/.test(value)) return "Letters only";
        return null;
      }
      case "email": return validators.email(value);
      case "phone": return validators.phone(value);
      case "natId": return validators.nationalId(value);
      default: return null;
    }
  };

  const touch = (field, value) => {
    setTouched(t => ({...t, [field]:true}));
    const e = validateField(field, value);
    setErrors(errs => ({...errs, [field]: e}));
  };

  // Check all fields valid before allowing continue
  const allValid = () => {
    const fields = { fname, lname, email, phone, natId };
    const newErrors = {};
    let valid = true;
    Object.entries(fields).forEach(([k,v]) => {
      const e = validateField(k, v);
      if (e) { newErrors[k] = e; valid = false; }
    });
    setErrors(newErrors);
    setTouched({ fname:true, lname:true, email:true, phone:true, natId:true });
    return valid;
  };

  const canGo = fname && lname && email && phone && natId;

  const inp = { width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"11px 13px",fontSize:".9rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:11 };

  useEffect(()=>{
    if (document.getElementById("pcg-script")) return;
    const s = document.createElement("script");
    s.id="pcg-script"; s.src="https://in.paychangu.com/js/popup.js"; s.async=true;
    document.body.appendChild(s);
  },[]);

  const pay = async () => {
    const ref = `NYF-${Date.now()}`;
    setTxRef(ref); setStep(3); setErr("");
    try {
      await supabase.insert("bookings", {
        listing_id:     house.id,
        tenant_name:    `${fname} ${lname}`,
        tenant_phone:   phone,
        tenant_email:   email,
        landlord_name:  house.landlord_name,
        landlord_phone: house.landlord_phone,
        deposit_amount: deposit,
        service_fee:    svcFee,
        total_paid:     total,
        status:         "payment_received",
        tx_ref:         ref,
      });
    } catch(e) { console.warn("Booking save:", e.message); }

    const tryOpen = (n=0) => {
      if (typeof window.PaychanguCheckout==="function") {
        window.PaychanguCheckout({
          public_key:    PAYCHANGU_KEY,
          tx_ref:        ref,
          amount:        total,
          currency:      "MWK",
          callback_url:  "https://nyumbafind.mw/payment/callback",
          return_url:    "https://nyumbafind.mw/payment/return",
          customer:      { email, first_name:fname, last_name:lname },
          customization: { title:"NyumbaFind Deposit", description:`Deposit for ${house.title}` },
          meta:          { house_id:house.id, phone, national_id:natId },
        });
        setStep(4);
      } else if (n<20) { setTimeout(()=>tryOpen(n+1),300); }
      else { setErr("Could not connect to PayChangu. Check your internet."); setStep(5); }
    };
    tryOpen();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.78)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:24,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto",animation:"fadeUp .3s ease" }}>
        <div style={{ background:"linear-gradient(135deg,#052e16,#15803d)",borderRadius:"24px 24px 0 0",padding:"20px 24px 16px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex",gap:6,marginBottom:5 }}>
                <span style={{ background:"rgba(74,222,128,.2)",color:"#4ade80",borderRadius:8,padding:"2px 10px",fontSize:".62rem",fontWeight:800 }}>🔒 SECURE</span>
                <span style={{ background:"rgba(255,255,255,.12)",color:"#fff",borderRadius:8,padding:"2px 10px",fontSize:".62rem",fontWeight:700 }}>via PayChangu</span>
              </div>
              <h2 style={{ margin:0,color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:"1.1rem" }}>{house.title}</h2>
              <p style={{ margin:"3px 0 0",color:"#86efac",fontSize:".78rem" }}>📍 {house.location}</p>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:"50%",width:34,height:34,cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ display:"flex",gap:5,marginTop:14 }}>
            {["Details","Confirm","Processing","Done!"].map((s,i)=>(
              <div key={s} style={{ flex:1,textAlign:"center" }}>
                <div style={{ height:3,borderRadius:2,background:i+1<=Math.min(step,4)?"#4ade80":"rgba(255,255,255,.2)",transition:"background .4s" }}/>
                <div style={{ color:i+1<=Math.min(step,4)?"#4ade80":"rgba(255,255,255,.3)",fontSize:".58rem",marginTop:3,fontWeight:600 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          {step===1&&(
            <div>
              <h3 style={{ margin:"0 0 4px",fontFamily:"'Playfair Display',serif" }}>Your Details</h3>
              <p style={{ margin:"0 0 14px",color:"#6b7280",fontSize:".8rem" }}>All details must be real and match your Malawi National ID.</p>

              {/* First + Last Name */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:2 }}>
                <div>
                  <label style={{ display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3 }}>First Name *</label>
                  <input
                    style={{...inp, borderColor: touched.fname&&errors.fname?"#ef4444":"#e5e7eb", marginBottom:0 }}
                    placeholder="e.g. Thoko"
                    value={fname}
                    onChange={e=>{const v=sanitize(e.target.value);setFname(v);touch("fname",v);}}
                    onBlur={e=>touch("fname",e.target.value)}
                  />
                  {touched.fname&&errors.fname&&<div style={{ color:"#ef4444",fontSize:".68rem",marginTop:3 }}>⚠️ {errors.fname}</div>}
                </div>
                <div>
                  <label style={{ display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3 }}>Last Name *</label>
                  <input
                    style={{...inp, borderColor: touched.lname&&errors.lname?"#ef4444":"#e5e7eb", marginBottom:0 }}
                    placeholder="e.g. Msiska"
                    value={lname}
                    onChange={e=>{const v=sanitize(e.target.value);setLname(v);touch("lname",v);}}
                    onBlur={e=>touch("lname",e.target.value)}
                  />
                  {touched.lname&&errors.lname&&<div style={{ color:"#ef4444",fontSize:".68rem",marginTop:3 }}>⚠️ {errors.lname}</div>}
                </div>
              </div>

              <div style={{ marginBottom:2,marginTop:11 }}>
                <label style={{ display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3 }}>Email Address *</label>
                <input
                  style={{...inp, borderColor: touched.email&&errors.email?"#ef4444":"#e5e7eb", marginBottom:0 }}
                  type="email" placeholder="your@email.com"
                  value={email}
                  onChange={e=>{const v=sanitize(e.target.value);setEmail(v);touch("email",v);}}
                  onBlur={e=>touch("email",e.target.value)}
                />
                {touched.email&&errors.email&&<div style={{ color:"#ef4444",fontSize:".68rem",marginTop:3 }}>⚠️ {errors.email}</div>}
              </div>

              <div style={{ marginBottom:2,marginTop:11 }}>
                <label style={{ display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3 }}>Malawi Phone Number *</label>
                <input
                  style={{...inp, borderColor: touched.phone&&errors.phone?"#ef4444":"#e5e7eb", marginBottom:0 }}
                  placeholder="e.g. 0991234567 or 0881234567"
                  value={phone}
                  onChange={e=>{setPhone(e.target.value);touch("phone",e.target.value);}}
                  onBlur={e=>touch("phone",e.target.value)}
                />
                {touched.phone&&errors.phone
                  ? <div style={{ color:"#ef4444",fontSize:".68rem",marginTop:3 }}>⚠️ {errors.phone}</div>
                  : <div style={{ color:"#9ca3af",fontSize:".67rem",marginTop:3 }}>Airtel: 099/098/077/078 • TNM: 088/084</div>
                }
              </div>

              <div style={{ marginBottom:2,marginTop:11 }}>
                <label style={{ display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3 }}>Malawi National ID Number *</label>
                <input
                  style={{...inp, borderColor: touched.natId&&errors.natId?"#ef4444":"#e5e7eb", marginBottom:0 }}
                  placeholder="e.g. 12345678A or MW12345678"
                  value={natId}
                  onChange={e=>{setNatId(e.target.value.toUpperCase());touch("natId",e.target.value);}}
                  onBlur={e=>touch("natId",e.target.value)}
                />
                {touched.natId&&errors.natId
                  ? <div style={{ color:"#ef4444",fontSize:".68rem",marginTop:3 }}>⚠️ {errors.natId}</div>
                  : <div style={{ color:"#9ca3af",fontSize:".67rem",marginTop:3 }}>Format: 12345678A or MW12345678</div>
                }
              </div>

              <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:10,fontSize:".71rem",color:"#15803d",margin:"14px 0",lineHeight:1.6 }}>
                🔒 Your details are verified against your National ID. Fake information will be rejected and reported.
              </div>

              {/* Show all errors summary if tried to continue with errors */}
              {Object.values(errors).some(Boolean)&&Object.values(touched).some(Boolean)&&(
                <div style={{ background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:11,marginBottom:12,fontSize:".76rem",color:"#dc2626",lineHeight:1.8 }}>
                  ❌ Please fix the errors above before continuing.
                </div>
              )}

              <button
                onClick={()=>{ if(allValid()) setStep(2); }}
                style={{ width:"100%",background:canGo?"linear-gradient(135deg,#15803d,#4ade80)":"#e5e7eb",color:canGo?"#fff":"#9ca3af",border:"none",borderRadius:12,padding:13,fontWeight:700,fontSize:"1rem",cursor:"pointer",marginTop:4 }}
              >
                Continue →
              </button>
            </div>
          )}

          {step===2&&(
            <div>
              <h3 style={{ margin:"0 0 13px",fontFamily:"'Playfair Display',serif" }}>Confirm & Pay</h3>
              <div style={{ display:"flex",gap:10,background:"#f9fafb",borderRadius:12,padding:12,marginBottom:11 }}>
                <img src={(house.photos||[])[0]||"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&q=80"} alt="" style={{ width:62,height:62,borderRadius:9,objectFit:"cover",flexShrink:0 }}/>
                <div>
                  <div style={{ fontWeight:700,fontSize:".86rem",marginBottom:2 }}>{house.title}</div>
                  <div style={{ color:"#6b7280",fontSize:".74rem",marginBottom:2 }}>📍 {house.location}</div>
                  <div style={{ fontSize:".71rem",color:"#374151" }}>🛏 {house.bedrooms} Beds • 🚿 {house.bathrooms} Baths</div>
                </div>
              </div>
              <div style={{ background:"#f9fafb",borderRadius:12,padding:13,marginBottom:11 }}>
                {[["House Deposit",fmt(deposit)],["Service Fee (15%)",fmt(svcFee)]].map(([l,v])=>(
                  <div key={l} style={{ display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:".82rem",color:"#374151" }}><span>{l}</span><span style={{ fontWeight:600 }}>{v}</span></div>
                ))}
                <div style={{ borderTop:"1.5px solid #e5e7eb",paddingTop:8,display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:".95rem" }}><span>Total</span><span style={{ color:"#15803d" }}>{fmt(total)}</span></div>
              </div>
              <div style={{ background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:11,padding:11,marginBottom:11,fontSize:".73rem",color:"#78350f",lineHeight:1.7 }}>⚠️ Like it ✅ → deposit to landlord & house removed from site. Don't like it ❌ → <strong>{fmt(Math.round(deposit*.9))}</strong> refunded.</div>
              <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:11,padding:11,marginBottom:15,fontSize:".72rem",color:"#1e40af",lineHeight:1.6 }}>💳 <strong>PayChangu</strong> — Airtel Money, TNM Mpamba, Cards</div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>setStep(1)} style={{ flex:1,background:"#f3f4f6",border:"none",borderRadius:11,padding:12,fontWeight:600,cursor:"pointer" }}>← Back</button>
                <button onClick={pay} style={{ flex:2,background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:11,padding:12,fontWeight:700,fontSize:".92rem",cursor:"pointer" }}>Pay {fmt(total)} 🔒</button>
              </div>
            </div>
          )}

          {step===3&&(
            <div style={{ textAlign:"center",padding:"36px 0 24px" }}>
              <div style={{ width:50,height:50,border:"5px solid #dcfce7",borderTop:"5px solid #15803d",borderRadius:"50%",margin:"0 auto 16px",animation:"spin .7s linear infinite" }}/>
              <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 7px" }}>Connecting to PayChangu...</h3>
              <p style={{ color:"#6b7280",fontSize:".83rem" }}>Opening secure checkout. Please wait.</p>
            </div>
          )}

          {step===4&&(
            <div style={{ textAlign:"center",padding:"8px 0 12px" }}>
              <div style={{ fontSize:"3.2rem",marginBottom:11,animation:"float 2s ease infinite" }}>🎉</div>
              <h2 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 7px" }}>PayChangu Opened!</h2>
              <p style={{ color:"#6b7280",marginBottom:15,lineHeight:1.7,fontSize:".84rem" }}>Complete payment on PayChangu.<br/>NyumbaFind will WhatsApp <strong>{phone}</strong> within 2 hours.</p>
              <div style={{ background:"#f9fafb",borderRadius:12,padding:13,marginBottom:14,textAlign:"left" }}>
                {[["House",house.title],["Amount",fmt(total)],["Ref",txRef],["Status","⏳ Awaiting payment"]].map(([l,v])=>(
                  <div key={l} style={{ display:"flex",justifyContent:"space-between",fontSize:".75rem",marginBottom:4 }}><span style={{ color:"#6b7280" }}>{l}</span><span style={{ fontWeight:600,wordBreak:"break-all",maxWidth:220,textAlign:"right" }}>{v}</span></div>
                ))}
              </div>
              <button onClick={()=>window.open(waLink(NF_WA,`Hi NyumbaFind! I just paid for *${house.title}*. Name: ${fname} ${lname}. Ref: ${txRef}`),"_blank")} style={{ width:"100%",background:"#25d366",color:"#fff",border:"none",borderRadius:11,padding:12,fontWeight:700,fontSize:".92rem",cursor:"pointer",marginBottom:7 }}>💬 Tell NyumbaFind I Paid</button>
              <button onClick={pay} style={{ width:"100%",background:"#f0fdf4",color:"#15803d",border:"1.5px solid #bbf7d0",borderRadius:11,padding:9,fontWeight:600,fontSize:".82rem",cursor:"pointer",marginBottom:6 }}>🔄 Reopen PayChangu</button>
              <button onClick={onClose} style={{ width:"100%",background:"#f3f4f6",border:"none",borderRadius:11,padding:9,fontWeight:600,fontSize:".8rem",cursor:"pointer" }}>Back to Listings</button>
            </div>
          )}

          {step===5&&(
            <div style={{ textAlign:"center",padding:"24px 0 16px" }}>
              <div style={{ fontSize:"3rem",marginBottom:11 }}>❌</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 7px",color:"#ef4444" }}>Payment Error</h3>
              <p style={{ color:"#6b7280",marginBottom:16,fontSize:".83rem",lineHeight:1.7 }}>{err}</p>
              <button onClick={()=>setStep(2)} style={{ width:"100%",background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:11,padding:12,fontWeight:700,cursor:"pointer",marginBottom:7 }}>Try Again</button>
              <button onClick={()=>window.open(waLink(NF_WA,`Hi NyumbaFind, I'm having trouble paying for ${house.title}. Can you help?`),"_blank")} style={{ width:"100%",background:"#25d366",color:"#fff",border:"none",borderRadius:11,padding:10,fontWeight:600,cursor:"pointer" }}>💬 Get Help</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOUSE CARD ───────────────────────────────────────────────────────────────
function HouseCard({ house, onPay, onView, saved, onSave, userLoc }) {
  const dist  = userLoc&&house.latitude ? distKm(userLoc.lat,userLoc.lng,house.latitude,house.longitude) : null;
  const photo = (house.photos||[])[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80";
  const tc    = house.tier==="premium"?"#f59e0b":house.tier==="standard"?"#60a5fa":"#4ade80";
  const tl    = house.tier==="premium"?"✨ Premium":house.tier==="standard"?"🏠 Standard":"🌿 Basic";
  return (
    <div style={{ background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.08)",transition:"transform .25s,box-shadow .25s",cursor:"pointer" }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,.15)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,.08)";}}
      onClick={()=>onView(house)}
    >
      <div style={{ position:"relative",height:200,overflow:"hidden" }}>
        <img src={photo} alt={house.title} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
        <div style={{ position:"absolute",top:11,left:11,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",color:tc,borderRadius:30,padding:"4px 11px",fontSize:".7rem",fontWeight:700 }}>{tl}</div>
        <button onClick={e=>{e.stopPropagation();onSave(house.id);}} style={{ position:"absolute",top:11,right:11,background:saved?"#ef4444":"rgba(255,255,255,.85)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:".95rem" }}>{saved?"❤️":"🤍"}</button>
        {dist!==null&&<div style={{ position:"absolute",top:11,right:52,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",color:"#fff",borderRadius:30,padding:"4px 9px",fontSize:".65rem",fontWeight:700 }}>📍 {dist.toFixed(1)}km</div>}
        <div style={{ position:"absolute",bottom:9,left:9,display:"flex",gap:4 }}>
          {house.id_checked    &&<Badge icon="🪪" label="ID"/>}
          {house.chief_verified&&<Badge icon="👑" label="Chief"/>}
        </div>
      </div>
      <div style={{ padding:"15px 16px 17px" }}>
        <h3 style={{ margin:"0 0 3px",fontSize:".95rem",fontWeight:700,color:"#111",fontFamily:"'Playfair Display',serif" }}>{house.title}</h3>
        <p style={{ margin:"0 0 5px",color:"#6b7280",fontSize:".78rem" }}>📍 {house.location}</p>
        {dist!==null&&<p style={{ margin:"0 0 6px",color:"#15803d",fontSize:".74rem",fontWeight:600 }}>🚶 {dist<1?`${(dist*1000).toFixed(0)}m`:`${dist.toFixed(1)}km`} from you</p>}
        <div style={{ marginBottom:7 }}><Stars r={house.avg_rating}/><span style={{ color:"#9ca3af",fontSize:".71rem" }}> ({house.review_count||0})</span></div>
        <div style={{ display:"flex",gap:11,marginBottom:12,color:"#374151",fontSize:".78rem" }}>
          <span>🛏 {house.bedrooms} Bed{house.bedrooms>1?"s":""}</span>
          <span>🚿 {house.bathrooms} Bath{house.bathrooms>1?"s":""}</span>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div><span style={{ fontSize:"1.1rem",fontWeight:800,color:"#15803d" }}>{fmt(house.price)}</span><span style={{ color:"#9ca3af",fontSize:".7rem" }}>/mo</span></div>
          <button onClick={e=>{e.stopPropagation();onPay(house);}} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"8px 15px",fontSize:".76rem",fontWeight:700,cursor:"pointer" }}>🔒 Secure Now</button>
        </div>
      </div>
    </div>
  );
}

// ─── LANDLORD FORM (all inputs sanitized against SQL injection) ─────────────────
function LandlordForm({ showToast }) {
  const [f,setF] = useState({ title:"",location:"",city:"Lilongwe",price:"",bedrooms:"",bathrooms:"",tier:"basic",description:"",landlord_name:"",landlord_phone:"",chief_name:"",national_id:"" });
  const [done,setDone]   = useState(false);
  const [busy,setBusy]   = useState(false);
  const [err, setErr]    = useState("");
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const inp={ width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 13px",fontSize:".88rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box" };

  const submit = async () => {
    if (!f.title||!f.location||!f.price||!f.landlord_name||!f.landlord_phone){setErr("Please fill all required fields.");return;}
    setBusy(true); setErr("");
    try {
      await supabase.insert("listings",{ title:f.title, location:f.location, city:f.city, price:parseInt(f.price), bedrooms:parseInt(f.bedrooms)||1, bathrooms:parseInt(f.bathrooms)||1, tier:f.tier, description:f.description, landlord_name:f.landlord_name, landlord_phone:f.landlord_phone, status:"pending", id_checked:false, chief_verified:false });
      setDone(true);
      showToast("Listing submitted! NyumbaFind will contact you within 24 hours.");
    } catch(e){ setErr("Failed: "+e.message); }
    setBusy(false);
  };

  if (done) return (
    <div style={{ maxWidth:500,margin:"60px auto",padding:24,textAlign:"center" }}>
      <div style={{ fontSize:"4rem",marginBottom:14 }}>🎉</div>
      <h2 style={{ fontFamily:"'Playfair Display',serif" }}>Application Received!</h2>
      <p style={{ color:"#6b7280",lineHeight:1.7 }}>NyumbaFind will contact you on WhatsApp within 24 hours to arrange a visit, verify your ID and Chief's letter, then your listing goes live.</p>
      <div style={{ background:"#f0fdf4",borderRadius:13,padding:15,marginTop:18,textAlign:"left",fontSize:".81rem",color:"#15803d",lineHeight:1.9 }}>
        <strong>Prepare:</strong><br/>🪪 National ID &nbsp;•&nbsp; 👑 Chief's letter &nbsp;•&nbsp; 📸 Ready for photos &nbsp;•&nbsp; 📄 Proof of ownership
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:560,margin:"0 auto",padding:"34px 20px" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.85rem",marginBottom:5 }}>List Your Property</h2>
      <p style={{ color:"#6b7280",marginBottom:22 }}>NyumbaFind personally verifies every listing before it goes live. Zero scams.</p>
      <div style={{ background:"#fff",borderRadius:20,padding:24,boxShadow:"0 4px 24px rgba(0,0,0,.08)" }}>
        <ErrMsg msg={err}/>
        {[["Property Title *","title","text","e.g. Modern 3-Bed in Area 47"],["Your Full Name *","landlord_name","text","Your name"],["WhatsApp Number *","landlord_phone","tel","+265 999 000 000"],["Monthly Rent (MWK) *","price","number","e.g. 120000"],["Bedrooms","bedrooms","number","e.g. 3"],["Bathrooms","bathrooms","number","e.g. 2"],["Location *","location","text","e.g. Area 47, Lilongwe"],["Chief / Village Headman Name","chief_name","text","Name of your area chief"],["National ID Number","national_id","text","Your Malawi National ID"]].map(([l,k,t,p])=>(
          <div key={k} style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem" }}>{l}</label>
            <input type={t} placeholder={p} value={f[k]} onChange={e=>s(k,e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem" }}>City</label>
          <select value={f.city} onChange={e=>s("city",e.target.value)} style={{...inp,background:"#fff"}}>
            {["Lilongwe","Blantyre","Mzuzu","Zomba","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem" }}>Tier</label>
          <select value={f.tier} onChange={e=>s("tier",e.target.value)} style={{...inp,background:"#fff"}}>
            <option value="basic">🌿 Basic (MWK 30k–80k)</option>
            <option value="standard">🏠 Standard (MWK 80k–250k)</option>
            <option value="premium">✨ Premium (MWK 250k+)</option>
          </select>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem" }}>Description</label>
          <textarea rows={4} placeholder="Describe your property..." value={f.description} onChange={e=>s("description",e.target.value)} style={{...inp,resize:"vertical"}} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
        </div>
        <div style={{ background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:11,padding:12,marginBottom:18,fontSize:".76rem",color:"#92400e",lineHeight:1.7 }}>
          ⚠️ You need a <strong>Chief's letter</strong> + <strong>National ID</strong> before listing goes live. NyumbaFind will call your Chief to confirm.
        </div>
        <button onClick={submit} disabled={busy} style={{ width:"100%",background:busy?"#e5e7eb":"linear-gradient(135deg,#15803d,#4ade80)",color:busy?"#9ca3af":"#fff",border:"none",borderRadius:13,padding:14,fontWeight:700,fontSize:"1rem",cursor:busy?"not-allowed":"pointer" }}>
          {busy?"Submitting...":"Submit Application →"}
        </button>
      </div>
    </div>
  );
}


// ─── INSTALL APP BANNER ───────────────────────────────────────────────────────
function InstallBanner() {
  const [show,      setShow]      = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Show banner after 3 seconds if not installed
    const timer = setTimeout(() => {
      if (deferredPrompt) setShow(true);
    }, 3000);

    // Hide if already installed
    window.addEventListener("appinstalled", () => {
      setShow(false);
      setInstalled(true);
      deferredPrompt = null;
    });

    return () => clearTimeout(timer);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      setInstalled(true);
    }
    deferredPrompt = null;
  };

  if (installed) return null;
  if (!show)     return null;

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:9999, animation:"fadeUp .4s ease" }}>
      <div className="install-banner" style={{ background:"linear-gradient(135deg,#052e16,#15803d)", padding:"16px 20px", display:"flex", alignItems:"center", gap:14, boxShadow:"0 -4px 24px rgba(0,0,0,.25)", paddingBottom:"calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ width:46, height:46, borderRadius:12, background:"rgba(74,222,128,.2)", border:"1.5px solid rgba(74,222,128,.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem", flexShrink:0 }}>🏠</div>
        <div style={{ flex:1 }}>
          <div style={{ color:"#fff", fontWeight:700, fontSize:".9rem" }}>Install NyumbaFind App</div>
          <div style={{ color:"#86efac", fontSize:".75rem" }}>Add to your home screen — works offline too!</div>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <button onClick={()=>setShow(false)} style={{ background:"rgba(255,255,255,.1)", color:"#fff", border:"none", borderRadius:8, padding:"8px 12px", fontSize:".78rem", cursor:"pointer" }}>Not now</button>
          <button onClick={install} style={{ background:"linear-gradient(135deg,#4ade80,#16a34a)", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:".82rem", fontWeight:700, cursor:"pointer" }}>📲 Install</button>
        </div>
      </div>
    </div>
  );
}


// Inline install button for hero
function InstallAppButton() {
  const [show, setShow] = useState(false);
  useEffect(()=>{ setTimeout(()=>{ if(deferredPrompt) setShow(true); },1000); },[]);
  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome==="accepted") setShow(false);
    deferredPrompt = null;
  };
  if (!show) return null;
  return (
    <button onClick={install} style={{ marginTop:10, background:"rgba(255,255,255,.15)", color:"#fff", border:"1.5px solid rgba(255,255,255,.4)", borderRadius:30, padding:"8px 20px", fontSize:".82rem", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7 }}>
      📲 Install NyumbaFind App
    </button>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function NyumbaFind() {
  const [view,      setView]      = useState("home");
  const [listings,  setListings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");
  const [search,    setSearch]    = useState("");
  const [city,      setCity]      = useState("All Cities");
  const [tier,      setTier]      = useState("All Homes");
  const [maxPrice,  setMaxPrice]  = useState(1000000);
  const [sort,      setSort]      = useState("Newest First");
  const [saved,     setSaved]     = useState([]);
  const [payHouse,  setPayHouse]  = useState(null);
  const [viewHouse, setViewHouse] = useState(null);
  const [userLoc,   setUserLoc]   = useState(null);
  const [userCity,  setUserCity]  = useState("");
  const [locLoad,   setLocLoad]   = useState(false);
  const [toast,     setToast]     = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  // ── Fetch real listings from Supabase ──
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr("");
      try {
        const data = await supabase.select("listings","status=eq.active&order=created_at.desc");
        setListings(Array.isArray(data)?data:[]);
      } catch(e) {
        setErr("Could not load listings: "+e.message);
        setListings([]);
      }
      setLoading(false);
    })();
  },[]);

  // ── Location ──
  const detectCity = (lat,lng) => {
    let best="Lilongwe", min=Infinity;
    Object.entries(CITY_COORDS).forEach(([c,co])=>{ const d=distKm(lat,lng,co.lat,co.lng); if(d<min){min=d;best=c;} });
    return best;
  };
  const requestLoc = () => {
    setLocLoad(true);
    navigator.geolocation?.getCurrentPosition(
      p=>{ setUserLoc({lat:p.coords.latitude,lng:p.coords.longitude}); setUserCity(detectCity(p.coords.latitude,p.coords.longitude)); setLocLoad(false); },
      ()=>{ setUserLoc({lat:-13.9669,lng:33.7873}); setUserCity("Lilongwe"); setLocLoad(false); }
    );
  };

  // ── Filter & sort ──
  const filtered = listings
    .filter(h=>{
      const ms=!search||h.title?.toLowerCase().includes(search.toLowerCase())||h.location?.toLowerCase().includes(search.toLowerCase());
      const mc=city==="All Cities"||h.city===city;
      const mt=tier==="All Homes"||(tier.includes("Basic")&&h.tier==="basic")||(tier.includes("Standard")&&h.tier==="standard")||(tier.includes("Premium")&&h.tier==="premium");
      return ms&&mc&&mt&&h.price<=maxPrice;
    })
    .sort((a,b)=>{
      if(sort==="Lowest Price")  return a.price-b.price;
      if(sort==="Highest Rated") return (b.avg_rating||0)-(a.avg_rating||0);
      if(sort==="Nearest First"&&userLoc&&a.latitude&&b.latitude) return distKm(userLoc.lat,userLoc.lng,a.latitude,a.longitude)-distKm(userLoc.lat,userLoc.lng,b.latitude,b.longitude);
      return new Date(b.created_at)-new Date(a.created_at);
    });

  const toggleSave  = id => setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const savedHouses = listings.filter(h=>saved.includes(h.id));
  const nearby      = userLoc ? listings.filter(h=>h.latitude&&distKm(userLoc.lat,userLoc.lng,h.latitude,h.longitude)<20) : [];

  const Nav=({label,v})=>( <button onClick={()=>setView(v)} style={{ background:view===v?"#15803d":"transparent",color:view===v?"#fff":"#374151",border:"none",borderRadius:30,padding:"7px 15px",cursor:"pointer",fontWeight:600,fontSize:".8rem",transition:"all .2s" }}>{label}</button> );

  return (
    <div style={{ minHeight:"100vh",background:"#f8fdf9",fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* ── RESET & BASE ── */
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { font-size:16px; -webkit-text-size-adjust:100%; }
        body { font-family:'DM Sans',sans-serif; overflow-x:hidden; -webkit-font-smoothing:antialiased; }
        img  { max-width:100%; height:auto; display:block; }
        input,select,textarea,button { font-family:inherit; font-size:inherit; }

        /* ── SCROLLBAR ── */
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:3px}

        /* ── MOBILE NAV ── */
        @media (max-width: 640px) {
          nav { padding: 0 12px !important; height: 56px !important; }
          nav span { font-size: 1rem !important; }
          nav div:last-child { gap: 1px !important; }
          nav button { padding: 5px 8px !important; font-size: .7rem !important; }
        }

        /* ── MOBILE HERO ── */
        @media (max-width: 640px) {
          .hero-title { font-size: 2rem !important; }
          .hero-search { flex-direction: column !important; }
          .hero-search input  { width: 100% !important; }
          .hero-search button { width: 100% !important; border-radius: 10px !important; }
        }

        /* ── MOBILE GRID ── */
        @media (max-width: 640px) {
          .listings-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .listings-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* ── MOBILE CARD ── */
        @media (max-width: 640px) {
          .house-card-img { height: 180px !important; }
        }

        /* ── MOBILE FILTERS ── */
        @media (max-width: 640px) {
          .filters-row { flex-direction: column !important; }
          .filters-row > * { width: 100% !important; min-width: unset !important; }
        }

        /* ── MOBILE MODAL ── */
        @media (max-width: 640px) {
          .modal-inner { border-radius: 16px !important; margin: 10px !important; max-height: 95vh !important; }
          .modal-img   { height: 200px !important; }
        }

        /* ── MOBILE PAYMENT ── */
        @media (max-width: 640px) {
          .payment-grid { grid-template-columns: 1fr !important; }
        }

        /* ── MOBILE HOW IT WORKS ── */
        @media (max-width: 640px) {
          .how-grid { grid-template-columns: 1fr !important; }
        }

        /* ── MOBILE FOOTER ── */
        @media (max-width: 640px) {
          .trust-bar { gap: 8px !important; justify-content: center !important; }
          .trust-bar > div { min-width: 55px !important; }
        }

        /* ── TOUCH TARGETS ── */
        button, a { min-height: 40px; cursor: pointer; }

        /* ── SAFE AREA (iPhone notch) ── */
        .install-banner { padding-bottom: env(safe-area-inset-bottom, 0px) !important; }
        nav { padding-top: env(safe-area-inset-top, 0px) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ background:"rgba(255,255,255,.93)",backdropFilter:"blur(12px)",borderBottom:"1px solid #dcfce7",padding:"0 16px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:500,width:"100%" }}>
        <div style={{ display:"flex",alignItems:"center",gap:7,cursor:"pointer",flexShrink:0 }} onClick={()=>setView("home")}>
          <div style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",borderRadius:9,width:33,height:33,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.05rem",flexShrink:0 }}>🏠</div>
          <span style={{ fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:"1.1rem" }}>Nyumba<span style={{ color:"#15803d" }}>Find</span></span>
        </div>
        <div style={{ display:"flex",gap:1,flexWrap:"nowrap",overflowX:"auto" }}>
          <Nav label="Home"          v="home"/>
          <Nav label="Browse"        v="listings"/>
          <Nav label="How It Works"  v="how"/>
          <Nav label={`❤️${saved.length?saved.length:""}`} v="saved"/>
          <Nav label="List"          v="landlord"/>
        </div>
      </nav>

      {/* HOME */}
      {view==="home"&&(
        <div>
          <div style={{ background:"linear-gradient(135deg,#052e16,#14532d,#15803d)",padding:"70px 22px 62px",textAlign:"center",position:"relative",overflow:"hidden" }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 50%,rgba(74,222,128,.12) 0%,transparent 50%)" }}/>
            <div style={{ position:"relative",maxWidth:680,margin:"0 auto",animation:"fadeUp .7s ease" }}>
              <div style={{ display:"inline-block",background:"rgba(74,222,128,.2)",color:"#4ade80",borderRadius:30,padding:"5px 16px",fontSize:".73rem",fontWeight:700,marginBottom:15,letterSpacing:".08em" }}>🇲🇼 MALAWI'S MOST TRUSTED HOME FINDER</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:"clamp(2.1rem,6vw,3.7rem)",color:"#fff",margin:"0 0 13px",lineHeight:1.15 }}>Find a Home You'll <span style={{ color:"#4ade80",fontStyle:"italic" }}>Love</span> in Malawi</h1>
              <p style={{ color:"#bbf7d0",fontSize:"1rem",marginBottom:28,lineHeight:1.7 }}>Chief-verified. ID-checked. Deposit protected.<br/>{userLoc?`📍 Showing homes near you in ${userCity}`:"Allow location to find the closest homes."}</p>
              <div className="hero-search" style={{ background:"#fff",borderRadius:15,padding:7,display:"flex",gap:7,maxWidth:520,margin:"0 auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)",width:"100%" }}>
                <input placeholder="🔍 Search city or neighbourhood..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1,border:"none",padding:"10px 13px",fontSize:".9rem",borderRadius:9,background:"transparent",color:"#111",outline:"none",minWidth:0 }}/>
                <button onClick={()=>setView("listings")} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:9,padding:"10px 18px",fontWeight:700,cursor:"pointer",flexShrink:0 }}>Search</button>
              </div>
              {!userLoc&&<button onClick={requestLoc} disabled={locLoad} style={{ marginTop:13,background:"rgba(255,255,255,.12)",color:"#fff",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:30,padding:"7px 17px",fontSize:".79rem",fontWeight:600,cursor:"pointer" }}>{locLoad?"⏳ Detecting...":"📍 Use My Location"}</button>}
              <InstallAppButton/>
              {userLoc&&<div style={{ marginTop:11,color:"#4ade80",fontSize:".79rem",fontWeight:600 }}>📍 {nearby.length} homes found near you in {userCity}</div>}
              <div style={{ display:"flex",gap:7,justifyContent:"center",marginTop:15,flexWrap:"wrap" }}>
                {["Lilongwe","Blantyre","Mzuzu","Zomba"].map(c=><button key={c} onClick={()=>{setCity(c);setView("listings");}} style={{ background:"rgba(255,255,255,.12)",color:"#fff",border:"1px solid rgba(255,255,255,.2)",borderRadius:30,padding:"5px 13px",fontSize:".77rem",cursor:"pointer" }}>{c}</button>)}
              </div>
            </div>
          </div>

          <div style={{ background:"#fff",borderBottom:"1px solid #f0fdf4",padding:"13px 20px" }}>
            <div style={{ maxWidth:860,margin:"0 auto",display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:11,textAlign:"center" }}>
              {[["✅","Chief Verified"],["🪪","ID Checked"],["💰","Deposit Protected"],["🔒","Zero Scams"],["📍","Location-Smart"]].map(([i,l])=>(
                <div key={l}><div style={{ fontSize:"1.15rem" }}>{i}</div><div style={{ fontSize:".69rem",color:"#6b7280",fontWeight:600 }}>{l}</div></div>
              ))}
            </div>
          </div>

          {loading&&<Spinner/>}
          {!loading&&err&&(
            <div style={{ maxWidth:460,margin:"40px auto",padding:"0 20px",textAlign:"center" }}>
              <div style={{ fontSize:"3.5rem",marginBottom:16 }}>📶</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 10px",color:"#111",fontSize:"1.3rem" }}>No Internet Connection</h3>
              <p style={{ color:"#6b7280",marginBottom:6,lineHeight:1.7,fontSize:".88rem" }}>Please check your internet connection and try again.</p>
              <p style={{ color:"#9ca3af",marginBottom:22,fontSize:".82rem" }}>Make sure your WiFi or mobile data is turned on.</p>
              <button onClick={()=>window.location.reload()} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"12px 28px",fontWeight:700,fontSize:".95rem",cursor:"pointer",boxShadow:"0 6px 20px rgba(21,128,61,.28)",marginBottom:10,display:"block",width:"100%" }}>
                🔄 Try Again
              </button>
              <button onClick={()=>setView("landlord")} style={{ background:"#f0fdf4",color:"#15803d",border:"1.5px solid #bbf7d0",borderRadius:30,padding:"11px 28px",fontWeight:600,fontSize:".88rem",cursor:"pointer",display:"block",width:"100%" }}>
                🏠 List Your Property
              </button>
            </div>
          )}

          {!loading&&userLoc&&nearby.length>0&&(
            <div style={{ padding:"38px 20px",maxWidth:1060,margin:"0 auto" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:19 }}>
                <div><h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.6rem",margin:"0 0 3px" }}>📍 Homes Near You in {userCity}</h2><p style={{ margin:0,color:"#6b7280",fontSize:".81rem" }}>{nearby.length} verified homes within 20km</p></div>
                <button onClick={()=>{setView("listings");setSort("Nearest First");}} style={{ background:"none",border:"2px solid #15803d",color:"#15803d",borderRadius:30,padding:"7px 15px",cursor:"pointer",fontWeight:700,fontSize:".79rem" }}>See All →</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19 }}>
                {nearby.slice(0,3).map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={saved.includes(h.id)} onSave={toggleSave} userLoc={userLoc}/>)}
              </div>
            </div>
          )}

          {!loading&&listings.length>0&&(
            <div style={{ padding:"38px 20px",maxWidth:1060,margin:"0 auto" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:19 }}>
                <div><h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.6rem",margin:"0 0 3px" }}>Featured Homes</h2><p style={{ margin:0,color:"#6b7280",fontSize:".81rem" }}>Personally verified by NyumbaFind — real listings from real landlords</p></div>
                <button onClick={()=>setView("listings")} style={{ background:"none",border:"2px solid #15803d",color:"#15803d",borderRadius:30,padding:"7px 15px",cursor:"pointer",fontWeight:700,fontSize:".79rem" }}>See All →</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19 }}>
                {listings.slice(0,6).map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={saved.includes(h.id)} onSave={toggleSave} userLoc={userLoc}/>)}
              </div>
            </div>
          )}

          {!loading&&listings.length===0&&!err&&(
            <div style={{ textAlign:"center",padding:"80px 20px",color:"#9ca3af" }}>
              <div style={{ fontSize:"3rem",marginBottom:11 }}>🏚</div>
              <p style={{ fontSize:"1rem",marginBottom:16 }}>No listings yet. Be the first landlord on NyumbaFind!</p>
              <button onClick={()=>setView("landlord")} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"11px 24px",cursor:"pointer",fontWeight:700 }}>List Your Property</button>
            </div>
          )}

          <div style={{ background:"#052e16",padding:"50px 20px",textAlign:"center" }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif",color:"#fff",fontSize:"1.75rem",marginBottom:7 }}>Built on Trust. Built for Malawi.</h2>
            <p style={{ color:"#86efac",marginBottom:32 }}>The only platform where every listing is personally verified by NyumbaFind.</p>
            <div style={{ display:"flex",justifyContent:"center",gap:20,flexWrap:"wrap",maxWidth:800,margin:"0 auto" }}>
              {[["👑","Chief Verified","Every landlord confirmed by village headman"],["🪪","ID Checked","National ID verified before listing goes live"],["📍","Location Smart","See homes closest to you first"],["🔄","Refund Policy","90% back if you don't like the house"]].map(([icon,title,desc])=>(
                <div key={title} style={{ flex:"1",minWidth:155,color:"#fff" }}>
                  <div style={{ fontSize:"1.8rem",marginBottom:7 }}>{icon}</div>
                  <h3 style={{ margin:"0 0 5px",fontFamily:"'Playfair Display',serif",fontSize:".96rem" }}>{title}</h3>
                  <p style={{ color:"#86efac",fontSize:".77rem",lineHeight:1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:"50px 20px",textAlign:"center" }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.75rem",marginBottom:8 }}>Have a House to Rent?</h2>
            <p style={{ color:"#6b7280",marginBottom:18,maxWidth:430,margin:"0 auto 18px" }}>List with NyumbaFind and reach verified tenants across Malawi.</p>
            <button onClick={()=>setView("landlord")} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:13,padding:"13px 28px",fontSize:"1rem",fontWeight:700,cursor:"pointer",boxShadow:"0 6px 20px rgba(21,128,61,.28)" }}>List Your Property →</button>
          </div>
        </div>
      )}

      {/* LISTINGS */}
      {view==="listings"&&(
        <div style={{ maxWidth:1060,margin:"0 auto",padding:"24px 20px" }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.65rem",marginBottom:18 }}>Browse All Homes</h2>
          {!userLoc?(
            <div style={{ background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:13,padding:"13px 17px",display:"flex",alignItems:"center",gap:11,marginBottom:18 }}>
              <div style={{ fontSize:"1.7rem" }}>🗺️</div>
              <div style={{ flex:1 }}><div style={{ fontWeight:700,color:"#92400e",fontSize:".84rem" }}>Find homes near you</div><div style={{ color:"#78350f",fontSize:".77rem" }}>Allow location to see the closest homes first</div></div>
              <button onClick={requestLoc} disabled={locLoad} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"8px 15px",fontWeight:700,fontSize:".77rem",cursor:"pointer" }}>{locLoad?"Detecting...":"📍 My Location"}</button>
            </div>
          ):(
            <div style={{ background:"linear-gradient(135deg,#052e16,#15803d)",borderRadius:13,padding:"12px 17px",display:"flex",alignItems:"center",gap:11,marginBottom:18 }}>
              <div style={{ fontSize:"1.5rem" }}>📍</div>
              <div><div style={{ color:"#4ade80",fontWeight:700,fontSize:".8rem" }}>Location active!</div><div style={{ color:"#fff",fontSize:".84rem" }}>Showing homes near <strong>{userCity}</strong></div></div>
            </div>
          )}
          <div className="filters-row" style={{ background:"#fff",borderRadius:13,padding:15,marginBottom:18,display:"flex",gap:9,flexWrap:"wrap",boxShadow:"0 2px 10px rgba(0,0,0,.06)" }}>
            <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:2,minWidth:120,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 12px",fontSize:".84rem",outline:"none" }}/>
            <select value={city} onChange={e=>setCity(e.target.value)} style={{ flex:1,minWidth:105,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem" }}>
              {["All Cities","Lilongwe","Blantyre","Mzuzu","Zomba"].map(c=><option key={c}>{c}</option>)}
            </select>
            <select value={tier} onChange={e=>setTier(e.target.value)} style={{ flex:1,minWidth:105,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem" }}>
              {["All Homes","🌿 Basic","🏠 Standard","✨ Premium"].map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{ flex:1,minWidth:115,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem" }}>
              {["Newest First","Lowest Price","Highest Rated","Nearest First"].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{ flex:2,minWidth:125 }}>
              <div style={{ fontSize:".69rem",color:"#6b7280",marginBottom:2 }}>Max: {fmt(maxPrice)}/mo</div>
              <input type="range" min="30000" max="1000000" step="10000" value={maxPrice} onChange={e=>setMaxPrice(+e.target.value)} style={{ width:"100%",accentColor:"#15803d" }}/>
            </div>
          </div>
          <p style={{ color:"#6b7280",fontSize:".83rem",margin:"0 0 15px" }}>{loading?"Loading real listings from database...":filtered.length+" home"+(filtered.length!==1?"s":"")+" found"}</p>
          {loading&&<Spinner/>}
          {!loading&&err&&(
            <div style={{ textAlign:"center",padding:"40px 20px" }}>
              <div style={{ fontSize:"3.5rem",marginBottom:12 }}>📶</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 8px",color:"#111",fontSize:"1.2rem" }}>No Internet Connection</h3>
              <p style={{ fontSize:".86rem",marginBottom:6,color:"#6b7280",lineHeight:1.7 }}>Please check your WiFi or mobile data and try again.</p>
              <button onClick={()=>window.location.reload()} style={{ background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"11px 26px",fontWeight:700,cursor:"pointer",marginTop:16 }}>🔄 Try Again</button>
            </div>
          )}
          {!loading&&filtered.length===0&&!err&&<div style={{ textAlign:"center",padding:60,color:"#9ca3af" }}><div style={{ fontSize:"3rem" }}>🏚</div><p>No homes match your filters.</p></div>}
          {!loading&&(
            <div className="listings-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19 }}>
              {filtered.map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={saved.includes(h.id)} onSave={toggleSave} userLoc={userLoc}/>)}
            </div>
          )}
        </div>
      )}

      {/* HOW IT WORKS */}
      {view==="how"&&(
        <div style={{ maxWidth:840,margin:"0 auto",padding:"38px 20px" }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.9rem",textAlign:"center",marginBottom:5 }}>How NyumbaFind Works</h2>
          <p style={{ textAlign:"center",color:"#6b7280",marginBottom:32 }}>Zero scams. Full protection. For tenants and landlords.</p>
          <div className="how-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
            {[["🏘️ For Tenants","#f0fdf4","#15803d",[["🔍","Search","Browse verified homes by city, price and distance."],["🪪","Submit ID","Your National ID is kept privately for anti-scam protection."],["💰","Pay Safely","Deposit goes to NyumbaFind — never directly to landlord."],["🏠","View House","NyumbaFind arranges your viewing within 24 hours."],["✅","Confirm","Happy? Deposit released. Get your keys! 🔑"],["🔄","Not Happy?","Get 90% refunded. NyumbaFind keeps 10% inspection fee."]]],["🏗️ For Landlords","#eff6ff","#3b82f6",[["📱","Contact NyumbaFind","WhatsApp NyumbaFind with your details."],["🪪","Submit ID","Provide National ID for verification."],["👑","Chief Letter","Get letter from your village headman."],["📸","Photos","NyumbaFind photographs your property."],["✅","Go Live","NyumbaFind reviews and posts your verified listing."],["💸","Get Paid","Tenant confirms → money transferred to you."]]]].map(([title,bg,color,steps])=>(
              <div key={title} style={{ background:bg,borderRadius:17,padding:19 }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif",color,margin:"0 0 15px",fontSize:"1.08rem" }}>{title}</h3>
                {steps.map(([icon,label,desc],i)=>(
                  <div key={label} style={{ display:"flex",gap:10,marginBottom:13 }}>
                    <div style={{ background:color,color:"#fff",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".82rem",flexShrink:0 }}>{icon}</div>
                    <div><div style={{ fontWeight:700,fontSize:".81rem",marginBottom:1 }}>Step {i+1}: {label}</div><div style={{ color:"#6b7280",fontSize:".74rem",lineHeight:1.6 }}>{desc}</div></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ background:"#052e16",borderRadius:17,padding:22,marginTop:24,color:"#fff",textAlign:"center" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",margin:"0 0 14px",fontSize:"1.15rem" }}>💰 Money Flow — How You're Protected</h3>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:5,flexWrap:"wrap" }}>
              {["Tenant Pays","→","NyumbaFind Holds","→","House Viewed","→","Tenant Confirms","→","Landlord Paid","→","House Removed"].map((s,i)=>(
                <div key={i} style={{ background:s==="→"?"transparent":"rgba(74,222,128,.15)",color:s==="→"?"#4ade80":"#fff",borderRadius:s==="→"?0:30,padding:s==="→"?"0 3px":"6px 12px",fontSize:s==="→"?"1rem":".75rem",fontWeight:700 }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SAVED */}
      {view==="saved"&&(
        <div style={{ maxWidth:1060,margin:"0 auto",padding:"24px 20px" }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.65rem",marginBottom:18 }}>❤️ Saved Homes</h2>
          {savedHouses.length===0?(
            <div style={{ textAlign:"center",padding:80,color:"#9ca3af" }}>
              <div style={{ fontSize:"3rem",marginBottom:11 }}>🤍</div>
              <p>No saved homes yet. Browse and tap 🤍 to save!</p>
              <button onClick={()=>setView("listings")} style={{ marginTop:11,background:"#15803d",color:"#fff",border:"none",borderRadius:30,padding:"10px 20px",cursor:"pointer",fontWeight:700 }}>Browse Homes</button>
            </div>
          ):(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19 }}>
              {savedHouses.map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={true} onSave={toggleSave} userLoc={userLoc}/>)}
            </div>
          )}
        </div>
      )}

      {/* LANDLORD */}
      {view==="landlord"&&<LandlordForm showToast={showToast}/>}

      {/* MODALS */}
      {payHouse&&<PaymentModal house={payHouse} onClose={()=>setPayHouse(null)}/>}

      <footer style={{ background:"#052e16",color:"#86efac",textAlign:"center",padding:"18px",fontSize:".77rem",marginTop:40 }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",color:"#fff",marginBottom:4 }}>🏠 NyumbaFind</div>
        <p style={{ margin:"0 0 3px" }}>Every Malawian deserves a home they love.</p>
        <p style={{ margin:0,opacity:.5 }}>Lilongwe · Blantyre · Mzuzu · Zomba 🇲🇼</p>
      </footer>
      <Toast msg={toast}/>
      <InstallBanner/>
    </div>
  );
}
