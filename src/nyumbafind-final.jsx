import { useState, useEffect } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SB_URL = process.env.REACT_APP_SUPABASE_URL || "https://uhkfesqvkxrajaaztuch.supabase.co";
const SB_KEY = process.env.REACT_APP_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa2Zlc3F2a3hyYWphYXp0dWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODY5NzYsImV4cCI6MjA5NjI2Mjk3Nn0.DZMd6JrFaPY_22rvSWpQ0JkVVC-3tl4emIyW6kOhSqc";
const PC_KEY = process.env.REACT_APP_PAYCHANGU_PUBLIC_KEY || "pub-test-92tzW4324OCNEEl4BwC4zPQ19n3U8ojE";
const NF_WA  = process.env.REACT_APP_DYLAN_WA || "265987596070";

const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

const supabase = {
  get:    async (t, q="")    => { const r=await fetch(`${SB_URL}/rest/v1/${t}?${q}`,{headers:SB_H}); const x=await r.text(); if(!r.ok) throw new Error(x); return JSON.parse(x); },
  insert: async (t, d)       => { const r=await fetch(`${SB_URL}/rest/v1/${t}`,{method:"POST",headers:SB_H,body:JSON.stringify(d)}); const x=await r.text(); if(!r.ok) throw new Error(x); return JSON.parse(x); },
  patch:  async (t, d, id)   => { const r=await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:"PATCH",headers:SB_H,body:JSON.stringify(d)}); const x=await r.text(); if(!r.ok) throw new Error(x); return x?JSON.parse(x):{}; },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SERVICE_FEE_PCT  = 5;      // 5% service fee
const PREMIUM_TENANT   = 2000;   // MWK 2,000/month — direct landlord contact + discounts
const LANDLORD_VERIFY  = 4000;   // MWK 4,000 one-time — get verified badge

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt    = n  => `MWK ${Number(n||0).toLocaleString()}`;
const fee    = n  => Math.round(n * SERVICE_FEE_PCT / 100);
const waLink = (p, m) => `https://wa.me/265${(p||"").replace(/^0/,"")}?text=${encodeURIComponent(m)}`;

const CITY_COORDS = {
  Lilongwe: {lat:-13.9669,lng:33.7873}, Blantyre: {lat:-15.7861,lng:35.0058},
  Mzuzu:    {lat:-11.4656,lng:34.0185}, Zomba:    {lat:-15.3833,lng:35.3167},
};
function distKm(la1,lo1,la2,lo2){const R=6371,dL=(la2-la1)*Math.PI/180,dN=(lo2-lo1)*Math.PI/180,a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

// Sanitize inputs
const clean = s => !s?"":String(s).replace(/['";\\-\\-\\/\\*]/g,"").replace(/<[^>]*>/g,"").trim().slice(0,500);

// PayChangu POST form — the CORRECT integration method
function payChangu(fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://api.paychangu.com/hosted-payment-page";
  form.target = "_self";
  Object.entries(fields).forEach(([k,v])=>{
    const i=document.createElement("input");
    i.type="hidden"; i.name=k; i.value=v;
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────
const validate = {
  name:  v => { v=v.trim(); if(v.length<2) return "Too short"; if(/\d/.test(v)) return "No numbers in name"; if(!/^[a-zA-Z\s\-']+$/.test(v)) return "Letters only"; return null; },
  email: v => { if(!v.trim()) return "Required"; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Invalid email"; return null; },
  phone: v => { let p=v.replace(/[\s\-\+]/g,""); if(p.startsWith("265")) p="0"+p.slice(3); if(!/^0(88|84|99|98|77|78)\d{7}$/.test(p)) return "Enter valid Malawi number (Airtel: 099/098/077/078 or TNM: 088/084)"; return null; },
  natId: v => { const id=v.trim().toUpperCase(); if(!/^\d{8}[A-Z]$/.test(id)&&!/^MW\d{8}$/.test(id)&&!/^\d{9}$/.test(id)) return "Enter valid Malawi National ID (e.g. 12345678A)"; return null; },
  pass:  v => { if(v.length<6) return "Minimum 6 characters"; return null; },
};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#052e16",color:"#fff",borderRadius:14,padding:"12px 22px",fontWeight:600,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"fadeUp .3s ease",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}}><span style={{color:"#4ade80"}}>✅</span> {msg}</div>;
}
function Err({ msg }) {
  if(!msg) return null;
  return <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:"10px 14px",color:"#dc2626",fontSize:".83rem",marginBottom:14}}>❌ {msg}</div>;
}
function Stars({ r }) { return <span style={{color:"#f59e0b",fontSize:".74rem"}}>{"★".repeat(Math.floor(r||0))}{"☆".repeat(5-Math.floor(r||0))} {r||0}</span>; }
function Spinner() { return <div style={{width:44,height:44,border:"4px solid #dcfce7",borderTop:"4px solid #15803d",borderRadius:"50%",margin:"60px auto",animation:"spin .7s linear infinite"}}/>; }

// ─── AUTH MODAL (Sign Up / Login) ─────────────────────────────────────────────
function AuthModal({ onClose, onAuth, defaultMode="signup" }) {
  const [mode,  setMode]  = useState(defaultMode); // signup | login
  const [role,  setRole]  = useState("tenant");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const inp = {width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"11px 13px",fontSize:".9rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:12};

  const signup = async () => {
    const errs = [validate.name(fname),validate.name(lname),validate.email(email),validate.phone(phone),validate.pass(pass)].filter(Boolean);
    if(errs.length){ setErr(errs[0]); return; }
    setBusy(true); setErr("");
    try {
      // Check if email already exists
      const existing = await supabase.get("users", `email=eq.${encodeURIComponent(email.trim())}`);
      if(existing.length>0){ setErr("Email already registered. Please login."); setBusy(false); return; }
      const user = await supabase.insert("users",{
        first_name: clean(fname), last_name: clean(lname),
        email: email.trim().toLowerCase(), phone: clean(phone),
        role, is_banned: false,
      });
      const u = Array.isArray(user)?user[0]:user;
      localStorage.setItem("nf_user", JSON.stringify(u));
      onAuth(u);
      onClose();
    } catch(e){ setErr(e.message); }
    setBusy(false);
  };

  const login = async () => {
    if(!email||!pass){ setErr("Enter email and password"); return; }
    setBusy(true); setErr("");
    try {
      const users = await supabase.get("users", `email=eq.${encodeURIComponent(email.trim().toLowerCase())}`);
      if(!users.length){ setErr("No account found. Please sign up."); setBusy(false); return; }
      const u = users[0];
      if(u.is_banned){ setErr("Your account has been banned. Contact NyumbaFind."); setBusy(false); return; }
      localStorage.setItem("nf_user", JSON.stringify(u));
      onAuth(u);
      onClose();
    } catch(e){ setErr(e.message); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:24,maxWidth:420,width:"100%",overflow:"hidden",animation:"fadeUp .3s ease"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#052e16,#15803d)",padding:"24px 26px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:"1.5rem",marginBottom:4}}>🏠</div>
              <h2 style={{margin:0,color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:"1.2rem"}}>{mode==="signup"?"Create Your Account":"Welcome Back"}</h2>
              <p style={{margin:"3px 0 0",color:"#86efac",fontSize:".78rem"}}>NyumbaFind — Malawi's trusted rental platform</p>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:"1rem"}}>✕</button>
          </div>
          {/* Tab switcher */}
          <div style={{display:"flex",gap:4,marginTop:16,background:"rgba(0,0,0,.2)",borderRadius:10,padding:4}}>
            {[["signup","Sign Up"],["login","Login"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,background:mode===m?"#fff":"transparent",color:mode===m?"#15803d":"rgba(255,255,255,.7)",border:"none",borderRadius:8,padding:"8px",fontWeight:700,cursor:"pointer",fontSize:".84rem",transition:"all .2s"}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{padding:"22px 24px"}}>
          <Err msg={err}/>

          {mode==="signup"&&(
            <>
              {/* Role selector */}
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:".8rem",fontWeight:700,color:"#374151",marginBottom:8}}>I am a:</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["tenant","🏠 Tenant","Looking for a house to rent"],["landlord","🏗️ Landlord","I have a house to rent out"]].map(([r,icon,desc])=>(
                    <div key={r} onClick={()=>setRole(r)} style={{border:`2px solid ${role===r?"#15803d":"#e5e7eb"}`,borderRadius:12,padding:"12px",cursor:"pointer",background:role===r?"#f0fdf4":"#fff",transition:"all .2s",textAlign:"center"}}>
                      <div style={{fontSize:"1.3rem",marginBottom:4}}>{icon}</div>
                      <div style={{fontWeight:700,fontSize:".84rem",color:role===r?"#15803d":"#374151",textTransform:"capitalize"}}>{r}</div>
                      <div style={{fontSize:".7rem",color:"#9ca3af",marginTop:2}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:2}}>
                <div><label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>First Name</label><input style={inp} placeholder="Thoko" value={fname} onChange={e=>setFname(e.target.value)}/></div>
                <div><label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Last Name</label><input style={inp} placeholder="Msiska" value={lname} onChange={e=>setLname(e.target.value)}/></div>
              </div>
              <label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Email</label>
              <input style={inp} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
              <label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Malawi Phone Number</label>
              <input style={inp} placeholder="e.g. 0991234567" value={phone} onChange={e=>setPhone(e.target.value)}/>
              <label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Password</label>
              <input style={inp} type="password" placeholder="Minimum 6 characters" value={pass} onChange={e=>setPass(e.target.value)}/>

              {/* Role benefits */}
              {role==="tenant"&&(
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:10,marginBottom:14,fontSize:".74rem",color:"#15803d",lineHeight:1.8}}>
                  ✅ Browse all verified listings<br/>
                  🔒 Deposit protected until you confirm<br/>
                  🔄 90% refund if you don't like the house<br/>
                  ⭐ Upgrade to Premium for MWK 2,000/mo — talk directly to landlords!
                </div>
              )}
              {role==="landlord"&&(
                <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:10,marginBottom:14,fontSize:".74rem",color:"#1e40af",lineHeight:1.8}}>
                  🏠 List your property for free<br/>
                  💰 Only {SERVICE_FEE_PCT}% fee on successful rentals<br/>
                  👑 Get Verified Badge for MWK 4,000 one-time payment<br/>
                  📱 Tenants contact you directly via WhatsApp
                </div>
              )}

              <button onClick={signup} disabled={busy} style={{width:"100%",background:busy?"#e5e7eb":"linear-gradient(135deg,#15803d,#4ade80)",color:busy?"#9ca3af":"#fff",border:"none",borderRadius:12,padding:14,fontWeight:700,fontSize:"1rem",cursor:busy?"not-allowed":"pointer"}}>
                {busy?"Creating Account...":"Create Account →"}
              </button>
            </>
          )}

          {mode==="login"&&(
            <>
              <label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Email</label>
              <input style={inp} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
              <label style={{display:"block",fontSize:".76rem",fontWeight:600,color:"#374151",marginBottom:3}}>Password</label>
              <input style={inp} type="password" placeholder="Your password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
              <button onClick={login} disabled={busy} style={{width:"100%",background:busy?"#e5e7eb":"linear-gradient(135deg,#15803d,#4ade80)",color:busy?"#9ca3af":"#fff",border:"none",borderRadius:12,padding:14,fontWeight:700,fontSize:"1rem",cursor:busy?"not-allowed":"pointer"}}>
                {busy?"Logging in...":"Login →"}
              </button>
            </>
          )}

          <p style={{textAlign:"center",color:"#9ca3af",fontSize:".76rem",marginTop:14}}>
            {mode==="signup"?"Already have an account? ":"Don't have an account? "}
            <button onClick={()=>{setMode(mode==="signup"?"login":"signup");setErr("");}} style={{background:"none",border:"none",color:"#15803d",fontWeight:700,cursor:"pointer",fontSize:".76rem"}}>
              {mode==="signup"?"Login here":"Sign up free"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── PREMIUM MODAL ────────────────────────────────────────────────────────────
function PremiumModal({ user, onClose, type }) {
  // type: "tenant_premium" | "landlord_verify"
  const isTenant   = type==="tenant_premium";
  const amount     = isTenant ? PREMIUM_TENANT : LANDLORD_VERIFY;
  const title      = isTenant ? "NyumbaFind Premium" : "Landlord Verification";
  const desc       = isTenant ? `NyumbaFind Premium for ${user?.first_name||"Tenant"}` : `Landlord Verification for ${user?.first_name||"Landlord"}`;

  const pay = () => {
    const ref = `NYF-PREM-${Date.now()}`;
    payChangu({
      public_key:   PC_KEY,
      tx_ref:       ref,
      amount:       String(amount),
      currency:     "MWK",
      email:        user?.email||"user@nyumbafind.mw",
      first_name:   user?.first_name||"User",
      last_name:    user?.last_name||"",
      callback_url: "https://nyumbafind.vercel.app",
      return_url:   "https://nyumbafind.vercel.app",
      title,
      description:  desc,
    });
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:24,maxWidth:420,width:"100%",overflow:"hidden",animation:"fadeUp .3s ease"}}>
        <div style={{background:isTenant?"linear-gradient(135deg,#7c3aed,#a78bfa)":"linear-gradient(135deg,#f59e0b,#fbbf24)",padding:"24px 26px 20px",textAlign:"center"}}>
          <div style={{fontSize:"2.5rem",marginBottom:8}}>{isTenant?"⭐":"👑"}</div>
          <h2 style={{margin:"0 0 5px",color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:"1.3rem"}}>{title}</h2>
          <div style={{background:"rgba(255,255,255,.2)",borderRadius:30,padding:"6px 20px",display:"inline-block",color:"#fff",fontWeight:800,fontSize:"1.1rem",marginTop:8}}>{fmt(amount)}{isTenant?"/month":" one-time"}</div>
        </div>
        <div style={{padding:"22px 24px"}}>
          {isTenant?(
            <div style={{marginBottom:18}}>
              <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 12px",fontSize:"1rem"}}>What you get with Premium:</h3>
              {[["💬","Talk directly to landlords on WhatsApp","Skip the waiting — contact any verified landlord directly"],["💰","Get exclusive discounts","Premium members get 10% off service fees"],["⚡","Priority listings","See new listings before anyone else"],["🏆","Premium badge","Stand out as a trusted tenant"]].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:11,marginBottom:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:"1.3rem",flexShrink:0}}>{icon}</div>
                  <div><div style={{fontWeight:700,fontSize:".86rem"}}>{title}</div><div style={{color:"#6b7280",fontSize:".76rem"}}>{desc}</div></div>
                </div>
              ))}
            </div>
          ):(
            <div style={{marginBottom:18}}>
              <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 12px",fontSize:"1rem"}}>What you get when Verified:</h3>
              {[["👑","Verified Badge","Your listing shows a gold verified badge — tenants trust you more"],["📈","Higher ranking","Verified listings appear first in search results"],["💬","Direct contact","Premium tenants can contact you directly"],["🔒","Trust seal","Your ID and Chief's letter confirmed by NyumbaFind"]].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:11,marginBottom:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:"1.3rem",flexShrink:0}}>{icon}</div>
                  <div><div style={{fontWeight:700,fontSize:".86rem"}}>{title}</div><div style={{color:"#6b7280",fontSize:".76rem"}}>{desc}</div></div>
                </div>
              ))}
            </div>
          )}
          <div style={{background:"#f9fafb",borderRadius:12,padding:14,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:600,color:"#374151"}}>{isTenant?"Monthly Premium":"One-time Verification"}</span>
            <span style={{fontWeight:800,fontSize:"1.1rem",color:isTenant?"#7c3aed":"#f59e0b"}}>{fmt(amount)}</span>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,background:"#f3f4f6",border:"none",borderRadius:11,padding:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={pay} style={{flex:2,background:isTenant?"linear-gradient(135deg,#7c3aed,#a78bfa)":"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#fff",border:"none",borderRadius:11,padding:13,fontWeight:700,cursor:"pointer",fontSize:".95rem"}}>
              Pay {fmt(amount)} via PayChangu 🔒
            </button>
          </div>
          <p style={{textAlign:"center",color:"#9ca3af",fontSize:".72rem",marginTop:10}}>Secured by PayChangu • Airtel Money • TNM Mpamba • Card</p>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT MODAL ────────────────────────────────────────────────────────────
function PaymentModal({ house, onClose, user }) {
  const [step,    setStep]    = useState(1);
  const [fname,   setFname]   = useState(user?.first_name||"");
  const [lname,   setLname]   = useState(user?.last_name||"");
  const [email,   setEmail]   = useState(user?.email||"");
  const [phone,   setPhone]   = useState(user?.phone||"");
  const [natId,   setNatId]   = useState("");
  const [txRef,   setTxRef]   = useState("");
  const [err,     setErr]     = useState("");
  const [errors,  setErrors]  = useState({});
  const [touched, setTouched] = useState({});
  const [busy,    setBusy]    = useState(false);

  const isPremium  = user?.is_premium;
  const deposit    = house.price;
  const svcFee     = isPremium ? Math.round(fee(deposit)*0.9) : fee(deposit); // 10% discount for premium
  const total      = deposit + svcFee;
  const refundAmt  = Math.round(deposit*0.9);

  const vField = (f,v) => { const e=validate[f]?.(v); setErrors(p=>({...p,[f]:e})); return e; };
  const touch  = (f,v) => { setTouched(p=>({...p,[f]:true})); vField(f,v); };

  const allValid = () => {
    const fields = {name:fname,email,phone,natId};
    const errs = {};
    let ok = true;
    Object.entries(fields).forEach(([k,v])=>{ const e=validate[k==="name"?"name":k]?.(v); if(e){errs[k]=e;ok=false;} });
    setErrors(errs);
    setTouched({name:true,email:true,phone:true,natId:true});
    return ok;
  };

  const pay = async () => {
    if(!allValid()) return;
    setBusy(true);
    const ref = `NYF-${Date.now()}`;
    setTxRef(ref);
    try {
      await supabase.insert("bookings",{
        listing_id:     house.id,
        tenant_name:    `${fname} ${lname}`,
        tenant_phone:   phone,
        tenant_email:   email,
        landlord_name:  house.landlord_name,
        landlord_phone: house.landlord_phone,
        deposit_amount: deposit,
        service_fee:    svcFee,
        total_paid:     total,
        currency:       "MWK",
        status:         "payment_received",
        tx_ref:         ref,
      });
    } catch(e){ console.warn("Booking:", e.message); }

    setStep(3);
    // POST form to PayChangu — this is the official correct method
    payChangu({
      public_key:   PC_KEY,
      tx_ref:       ref,
      amount:       String(total),
      currency:     "MWK",
      email:        email,
      first_name:   fname,
      last_name:    lname,
      callback_url: "https://nyumbafind.vercel.app",
      return_url:   "https://nyumbafind.vercel.app",
      title:        "NyumbaFind House Deposit",
      description:  `Deposit for ${house.title} - ${house.location}`,
    });
    setBusy(false);
  };

  const inp = {width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"11px 13px",fontSize:".9rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const canGo = fname&&lname&&email&&phone&&natId;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:24,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto",animation:"fadeUp .3s ease"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#052e16,#15803d)",borderRadius:"24px 24px 0 0",padding:"20px 24px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",gap:6,marginBottom:5}}>
                <span style={{background:"rgba(74,222,128,.2)",color:"#4ade80",borderRadius:8,padding:"2px 10px",fontSize:".62rem",fontWeight:800}}>🔒 SECURE</span>
                <span style={{background:"rgba(255,255,255,.12)",color:"#fff",borderRadius:8,padding:"2px 10px",fontSize:".62rem",fontWeight:700}}>via PayChangu</span>
                {isPremium&&<span style={{background:"rgba(124,58,237,.4)",color:"#c4b5fd",borderRadius:8,padding:"2px 10px",fontSize:".62rem",fontWeight:700}}>⭐ PREMIUM</span>}
              </div>
              <h2 style={{margin:0,color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:"1.05rem"}}>{house.title}</h2>
              <p style={{margin:"3px 0 0",color:"#86efac",fontSize:".78rem"}}>📍 {house.location}</p>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:"50%",width:34,height:34,cursor:"pointer"}}>✕</button>
          </div>
          {/* Steps */}
          <div style={{display:"flex",gap:5,marginTop:14}}>
            {["Details","Confirm","Paying"].map((s,i)=>(
              <div key={s} style={{flex:1,textAlign:"center"}}>
                <div style={{height:3,borderRadius:2,background:i+1<=step?"#4ade80":"rgba(255,255,255,.2)",transition:"background .4s"}}/>
                <div style={{color:i+1<=step?"#4ade80":"rgba(255,255,255,.3)",fontSize:".58rem",marginTop:3,fontWeight:600}}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:"20px 24px"}}>
          {/* STEP 1 */}
          {step===1&&(
            <div>
              <h3 style={{margin:"0 0 4px",fontFamily:"'Playfair Display',serif"}}>Your Details</h3>
              <p style={{margin:"0 0 14px",color:"#6b7280",fontSize:".8rem"}}>Must match your National ID. Fake info is blocked.</p>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:2}}>
                <div>
                  <label style={{display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3}}>First Name *</label>
                  <input style={{...inp,borderColor:touched.name&&errors.name?"#ef4444":"#e5e7eb",marginBottom:0}} placeholder="Thoko" value={fname} onChange={e=>{setFname(e.target.value);touch("name",e.target.value);}}/>
                  {touched.name&&errors.name&&<div style={{color:"#ef4444",fontSize:".68rem",marginTop:3}}>⚠️ {errors.name}</div>}
                </div>
                <div>
                  <label style={{display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3}}>Last Name *</label>
                  <input style={{...inp,borderColor:touched.name&&errors.name?"#ef4444":"#e5e7eb",marginBottom:0}} placeholder="Msiska" value={lname} onChange={e=>setLname(e.target.value)}/>
                </div>
              </div>

              <div style={{marginTop:11,marginBottom:2}}>
                <label style={{display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3}}>Email *</label>
                <input style={{...inp,borderColor:touched.email&&errors.email?"#ef4444":"#e5e7eb",marginBottom:0}} type="email" placeholder="your@email.com" value={email} onChange={e=>{setEmail(e.target.value);touch("email",e.target.value);}}/>
                {touched.email&&errors.email&&<div style={{color:"#ef4444",fontSize:".68rem",marginTop:3}}>⚠️ {errors.email}</div>}
              </div>

              <div style={{marginTop:11,marginBottom:2}}>
                <label style={{display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3}}>Malawi Phone *</label>
                <input style={{...inp,borderColor:touched.phone&&errors.phone?"#ef4444":"#e5e7eb",marginBottom:0}} placeholder="0991234567" value={phone} onChange={e=>{setPhone(e.target.value);touch("phone",e.target.value);}}/>
                {touched.phone&&errors.phone?<div style={{color:"#ef4444",fontSize:".68rem",marginTop:3}}>⚠️ {errors.phone}</div>:<div style={{color:"#9ca3af",fontSize:".67rem",marginTop:3}}>Airtel: 099/098/077/078 • TNM: 088/084</div>}
              </div>

              <div style={{marginTop:11,marginBottom:14}}>
                <label style={{display:"block",fontSize:".75rem",fontWeight:600,color:"#374151",marginBottom:3}}>National ID *</label>
                <input style={{...inp,borderColor:touched.natId&&errors.natId?"#ef4444":"#e5e7eb",marginBottom:0}} placeholder="e.g. 12345678A or MW12345678" value={natId} onChange={e=>{setNatId(e.target.value.toUpperCase());touch("natId",e.target.value);}}/>
                {touched.natId&&errors.natId?<div style={{color:"#ef4444",fontSize:".68rem",marginTop:3}}>⚠️ {errors.natId}</div>:<div style={{color:"#9ca3af",fontSize:".67rem",marginTop:3}}>Format: 12345678A or MW12345678</div>}
              </div>

              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:10,fontSize:".72rem",color:"#15803d",marginBottom:14,lineHeight:1.6}}>🔒 Your National ID is stored <strong>privately by NyumbaFind</strong> only — never shared.</div>

              <button onClick={()=>allValid()&&setStep(2)} style={{width:"100%",background:canGo?"linear-gradient(135deg,#15803d,#4ade80)":"#e5e7eb",color:canGo?"#fff":"#9ca3af",border:"none",borderRadius:12,padding:13,fontWeight:700,fontSize:"1rem",cursor:"pointer"}}>Continue →</button>
            </div>
          )}

          {/* STEP 2 */}
          {step===2&&(
            <div>
              <h3 style={{margin:"0 0 13px",fontFamily:"'Playfair Display',serif"}}>Confirm & Pay</h3>
              <div style={{display:"flex",gap:10,background:"#f9fafb",borderRadius:12,padding:12,marginBottom:11}}>
                <img src={(house.photos||[])[0]||"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&q=80"} alt="" style={{width:62,height:62,borderRadius:9,objectFit:"cover",flexShrink:0}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:".86rem",marginBottom:2}}>{house.title}</div>
                  <div style={{color:"#6b7280",fontSize:".74rem",marginBottom:2}}>📍 {house.location}</div>
                  <div style={{fontSize:".71rem",color:"#374151"}}>🛏 {house.bedrooms} Beds • 🚿 {house.bathrooms} Baths</div>
                </div>
              </div>
              <div style={{background:"#f9fafb",borderRadius:12,padding:13,marginBottom:11}}>
                {[["House Deposit (1 month)",fmt(deposit),"#374151"],[`NyumbaFind Service Fee (${SERVICE_FEE_PCT}%)${isPremium?" — 10% Premium Discount":""}`,fmt(svcFee),"#374151"]].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:".82rem",color:c}}><span>{l}</span><span style={{fontWeight:600}}>{v}</span></div>
                ))}
                {isPremium&&<div style={{color:"#7c3aed",fontSize:".74rem",marginBottom:6}}>⭐ Premium member — service fee discounted!</div>}
                <div style={{borderTop:"1.5px solid #e5e7eb",paddingTop:8,display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:".95rem"}}><span>Total</span><span style={{color:"#15803d"}}>{fmt(total)}</span></div>
              </div>
              <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:11,padding:11,marginBottom:11,fontSize:".73rem",color:"#78350f",lineHeight:1.7}}>
                ⚠️ Like it ✅ → deposit to landlord. Don't like it ❌ → <strong>{fmt(refundAmt)}</strong> refunded (90%).
              </div>
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:11,padding:11,marginBottom:15,fontSize:".72rem",color:"#1e40af",lineHeight:1.6}}>
                💳 <strong>PayChangu</strong> — Airtel Money • TNM Mpamba • Card • Bank Transfer
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setStep(1)} style={{flex:1,background:"#f3f4f6",border:"none",borderRadius:11,padding:12,fontWeight:600,cursor:"pointer"}}>← Back</button>
                <button onClick={pay} disabled={busy} style={{flex:2,background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:11,padding:12,fontWeight:700,fontSize:".92rem",cursor:"pointer"}}>
                  {busy?"Processing...":` Pay ${fmt(total)} 🔒`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Redirecting */}
          {step===3&&(
            <div style={{textAlign:"center",padding:"36px 0 24px"}}>
              <div style={{width:50,height:50,border:"5px solid #dcfce7",borderTop:"5px solid #15803d",borderRadius:"50%",margin:"0 auto 16px",animation:"spin .7s linear infinite"}}/>
              <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 7px"}}>Redirecting to PayChangu...</h3>
              <p style={{color:"#6b7280",fontSize:".83rem",marginBottom:16}}>You are being taken to the secure payment page.</p>
              <p style={{color:"#9ca3af",fontSize:".76rem"}}>Ref: {txRef}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOUSE CARD ───────────────────────────────────────────────────────────────
function HouseCard({ house, onPay, onView, saved, onSave, userLoc, user }) {
  const dist   = userLoc&&house.latitude?distKm(userLoc.lat,userLoc.lng,house.latitude,house.longitude):null;
  const photo  = (house.photos||[])[0]||"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80";
  const tc     = house.tier==="premium"?"#f59e0b":house.tier==="standard"?"#60a5fa":"#4ade80";
  const tl     = house.tier==="premium"?"✨ Premium":house.tier==="standard"?"🏠 Standard":"🌿 Basic";
  const isPremTenant = user?.is_premium;

  return (
    <div style={{background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.08)",transition:"transform .25s,box-shadow .25s",cursor:"pointer"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,.15)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,.08)";}}
      onClick={()=>onView(house)}>
      <div style={{position:"relative",height:200,overflow:"hidden"}}>
        <img src={photo} alt={house.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",top:11,left:11,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",color:tc,borderRadius:30,padding:"4px 11px",fontSize:".7rem",fontWeight:700}}>{tl}</div>
        <button onClick={e=>{e.stopPropagation();onSave(house.id);}} style={{position:"absolute",top:11,right:11,background:saved?"#ef4444":"rgba(255,255,255,.85)",border:"none",borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:".95rem"}}>{saved?"❤️":"🤍"}</button>
        {dist!==null&&<div style={{position:"absolute",top:11,right:52,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",color:"#fff",borderRadius:30,padding:"4px 9px",fontSize:".65rem",fontWeight:700}}>📍 {dist.toFixed(1)}km</div>}
        <div style={{position:"absolute",bottom:9,left:9,display:"flex",gap:4}}>
          {house.id_checked    &&<span style={{background:"rgba(21,128,61,.85)",color:"#fff",borderRadius:20,padding:"3px 8px",fontSize:".66rem",fontWeight:700}}>🪪 ID</span>}
          {house.chief_verified&&<span style={{background:"rgba(5,46,22,.85)",color:"#fff",borderRadius:20,padding:"3px 8px",fontSize:".66rem",fontWeight:700}}>👑 Chief</span>}
        </div>
      </div>
      <div style={{padding:"15px 16px 17px"}}>
        <h3 style={{margin:"0 0 3px",fontSize:".95rem",fontWeight:700,color:"#111",fontFamily:"'Playfair Display',serif"}}>{house.title}</h3>
        <p style={{margin:"0 0 5px",color:"#6b7280",fontSize:".78rem"}}>📍 {house.location}</p>
        {dist!==null&&<p style={{margin:"0 0 6px",color:"#15803d",fontSize:".74rem",fontWeight:600}}>🚶 {dist<1?`${(dist*1000).toFixed(0)}m`:`${dist.toFixed(1)}km`} from you</p>}
        <div style={{marginBottom:7}}><Stars r={house.avg_rating}/><span style={{color:"#9ca3af",fontSize:".71rem"}}> ({house.review_count||0})</span></div>
        <div style={{display:"flex",gap:11,marginBottom:12,color:"#374151",fontSize:".78rem"}}>
          <span>🛏 {house.bedrooms} Bed{house.bedrooms>1?"s":""}</span>
          <span>🚿 {house.bathrooms} Bath{house.bathrooms>1?"s":""}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:"1.1rem",fontWeight:800,color:"#15803d"}}>{fmt(house.price)}</span>
            <span style={{color:"#9ca3af",fontSize:".7rem"}}>/mo</span>
            {isPremTenant&&<div style={{color:"#7c3aed",fontSize:".65rem",fontWeight:700}}>⭐ 10% off service fee!</div>}
          </div>
          <button onClick={e=>{e.stopPropagation();onPay(house);}} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"8px 15px",fontSize:".76rem",fontWeight:700,cursor:"pointer"}}>🔒 Secure Now</button>
        </div>
      </div>
    </div>
  );
}

// ─── LANDLORD FORM ────────────────────────────────────────────────────────────
function LandlordForm({ showToast, user }) {
  const [f,        setF]        = useState({title:"",location:"",city:"Lilongwe",price:"",bedrooms:"",bathrooms:"",tier:"basic",description:"",landlord_name:user?`${user.first_name} ${user.last_name}`:"",landlord_phone:user?.phone||"",chief_name:"",national_id:""});
  const [done,     setDone]     = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState("");
  const [photos,   setPhotos]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading,setUploading]= useState(false);

  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const inp={width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 13px",fontSize:".88rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files).slice(0,4);
    if(!files.length) return;
    setUploading(true);
    const newUrls=[], newPreviews=[];
    for(const file of files){
      try{
        const name=`${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
        const r=await fetch(`${SB_URL}/storage/v1/object/house-photos/${name}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":file.type,"x-upsert":"true"},body:file});
        if(r.ok){ const url=`${SB_URL}/storage/v1/object/public/house-photos/${name}`; newUrls.push(url); newPreviews.push(url); }
        else { newPreviews.push(URL.createObjectURL(file)); }
      }catch(e){ newPreviews.push(URL.createObjectURL(file)); }
    }
    setPhotos(p=>[...p,...newUrls].slice(0,4));
    setPreviews(p=>[...p,...newPreviews].slice(0,4));
    setUploading(false);
  };

  const removePhoto = i => { setPhotos(p=>p.filter((_,idx)=>idx!==i)); setPreviews(p=>p.filter((_,idx)=>idx!==i)); };

  const submit = async () => {
    if(!f.title||!f.location||!f.price||!f.landlord_name||!f.landlord_phone){setErr("Please fill all required fields.");return;}
    setBusy(true); setErr("");
    try{
      await supabase.insert("listings",{
        title:clean(f.title),location:clean(f.location),city:f.city,
        price:parseInt(f.price),bedrooms:parseInt(f.bedrooms)||1,bathrooms:parseInt(f.bathrooms)||1,
        tier:f.tier,description:clean(f.description),
        landlord_name:clean(f.landlord_name),landlord_phone:clean(f.landlord_phone),
        photos,status:"pending",id_checked:false,chief_verified:false,
      });
      setDone(true);
      showToast("Listing submitted! NyumbaFind will contact you within 24 hours.");
    }catch(e){setErr(e.message);}
    setBusy(false);
  };

  if(done) return (
    <div style={{maxWidth:500,margin:"60px auto",padding:24,textAlign:"center"}}>
      <div style={{fontSize:"4rem",marginBottom:14}}>🎉</div>
      <h2 style={{fontFamily:"'Playfair Display',serif"}}>Application Received!</h2>
      <p style={{color:"#6b7280",lineHeight:1.7}}>NyumbaFind will contact you on WhatsApp within 24 hours to arrange a visit, verify your ID and Chief's letter.</p>
    </div>
  );

  return (
    <div style={{maxWidth:560,margin:"0 auto",padding:"34px 20px"}}>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.85rem",marginBottom:5}}>List Your Property</h2>
      <p style={{color:"#6b7280",marginBottom:22}}>NyumbaFind personally verifies every listing before it goes live. Zero scams.</p>
      <div style={{background:"#fff",borderRadius:20,padding:24,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <Err msg={err}/>

        {/* Photo Upload */}
        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontWeight:600,marginBottom:6,color:"#374151",fontSize:".83rem"}}>📸 House Photos <span style={{color:"#9ca3af",fontWeight:400,fontSize:".76rem"}}>(up to 4)</span></label>
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,background:"#f0fdf4",border:"2px dashed #86efac",borderRadius:14,padding:"20px 16px",cursor:uploading?"wait":"pointer",textAlign:"center"}}>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotos} disabled={uploading||photos.length>=4} style={{display:"none"}}/>
            <div style={{fontSize:"2rem"}}>{uploading?"⏳":"📷"}</div>
            <div style={{fontWeight:700,color:"#15803d",fontSize:".9rem"}}>{uploading?"Uploading to Supabase...":photos.length>=4?"Max 4 photos reached":"Tap to upload house photos"}</div>
            <div style={{color:"#9ca3af",fontSize:".74rem"}}>JPG or PNG • Uploads directly to Supabase Storage</div>
          </label>
          {previews.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:12}}>
              {previews.map((url,i)=>(
                <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",aspectRatio:"1",border:`2px solid ${i===0?"#15803d":"#bbf7d0"}`}}>
                  <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <button onClick={()=>removePhoto(i)} style={{position:"absolute",top:3,right:3,background:"rgba(220,38,38,.9)",border:"none",color:"#fff",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:".65rem",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
                  {i===0&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(21,128,61,.85)",color:"#fff",fontSize:".55rem",textAlign:"center",padding:"2px 0",fontWeight:700}}>MAIN</div>}
                </div>
              ))}
            </div>
          )}
          {photos.length>0&&<div style={{color:"#15803d",fontSize:".76rem",marginTop:6,fontWeight:600}}>✅ {photos.length} photo{photos.length>1?"s":""} uploaded to Supabase</div>}
        </div>

        {[["Property Title *","title","text","e.g. Modern 3-Bed in Area 47"],["Your Full Name *","landlord_name","text","Your name"],["WhatsApp Number *","landlord_phone","tel","+265 999 000 000"],["Monthly Rent (MWK) *","price","number","e.g. 120000"],["Bedrooms","bedrooms","number","e.g. 3"],["Bathrooms","bathrooms","number","e.g. 2"],["Location *","location","text","e.g. Area 47, Lilongwe"],["Chief / Village Headman Name","chief_name","text","Name of area chief"],["National ID Number","national_id","text","e.g. 12345678A"]].map(([l,k,t,p])=>(
          <div key={k} style={{marginBottom:14}}>
            <label style={{display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem"}}>{l}</label>
            <input type={t} placeholder={p} value={f[k]} onChange={e=>s(k,e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
          </div>
        ))}

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem"}}>City</label>
          <select value={f.city} onChange={e=>s("city",e.target.value)} style={{...inp,background:"#fff"}}>
            {["Lilongwe","Blantyre","Mzuzu","Zomba","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem"}}>Tier</label>
          <select value={f.tier} onChange={e=>s("tier",e.target.value)} style={{...inp,background:"#fff"}}>
            <option value="basic">🌿 Basic (MWK 30k–80k/mo)</option>
            <option value="standard">🏠 Standard (MWK 80k–250k/mo)</option>
            <option value="premium">✨ Premium (MWK 250k+/mo)</option>
          </select>
        </div>

        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontWeight:600,marginBottom:3,color:"#374151",fontSize:".83rem"}}>Description</label>
          <textarea rows={4} placeholder="Describe your property..." value={f.description} onChange={e=>s("description",e.target.value)} style={{...inp,resize:"vertical"}} onFocus={e=>e.target.style.borderColor="#15803d"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
        </div>

        <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:11,padding:12,marginBottom:18,fontSize:".76rem",color:"#92400e",lineHeight:1.7}}>
          ⚠️ Listing goes live only after NyumbaFind verifies your <strong>National ID</strong> + <strong>Chief's letter</strong>.
        </div>

        <button onClick={submit} disabled={busy||uploading} style={{width:"100%",background:busy||uploading?"#e5e7eb":"linear-gradient(135deg,#15803d,#4ade80)",color:busy||uploading?"#9ca3af":"#fff",border:"none",borderRadius:13,padding:14,fontWeight:700,fontSize:"1rem",cursor:busy||uploading?"not-allowed":"pointer"}}>
          {uploading?"📤 Uploading photos...":busy?"Submitting...":"Submit Application →"}
        </button>
      </div>
    </div>
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
  const [showAuth,  setShowAuth]  = useState(false);
  const [authMode,  setAuthMode]  = useState("signup");
  const [user,      setUser]      = useState(null);
  const [showPremium,setShowPremium]=useState(null); // "tenant_premium" | "landlord_verify"

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  // Load user from localStorage
  useEffect(()=>{
    const u = localStorage.getItem("nf_user");
    if(u) try{ setUser(JSON.parse(u)); }catch{}
  },[]);

  // Fetch listings
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr("");
      try{
        const data = await supabase.get("listings","status=eq.active&order=created_at.desc");
        setListings(Array.isArray(data)?data:[]);
      }catch(e){ setErr(e.message); setListings([]); }
      setLoading(false);
    })();
  },[]);

  // Location
  const detectCity=(lat,lng)=>{ let b="Lilongwe",m=Infinity; Object.entries(CITY_COORDS).forEach(([c,co])=>{ const d=distKm(lat,lng,co.lat,co.lng); if(d<m){m=d;b=c;} }); return b; };
  const requestLoc=()=>{ setLocLoad(true); navigator.geolocation?.getCurrentPosition(p=>{ setUserLoc({lat:p.coords.latitude,lng:p.coords.longitude}); setUserCity(detectCity(p.coords.latitude,p.coords.longitude)); setLocLoad(false); },()=>{ setUserLoc({lat:-13.9669,lng:33.7873}); setUserCity("Lilongwe"); setLocLoad(false); }); };

  // Filter
  const filtered = listings.filter(h=>{
    const ms=!search||h.title?.toLowerCase().includes(search.toLowerCase())||h.location?.toLowerCase().includes(search.toLowerCase());
    const mc=city==="All Cities"||h.city===city;
    const mt=tier==="All Homes"||(tier.includes("Basic")&&h.tier==="basic")||(tier.includes("Standard")&&h.tier==="standard")||(tier.includes("Premium")&&h.tier==="premium");
    return ms&&mc&&mt&&h.price<=maxPrice;
  }).sort((a,b)=>{
    if(sort==="Lowest Price") return a.price-b.price;
    if(sort==="Highest Rated") return (b.avg_rating||0)-(a.avg_rating||0);
    if(sort==="Nearest First"&&userLoc&&a.latitude&&b.latitude) return distKm(userLoc.lat,userLoc.lng,a.latitude,a.longitude)-distKm(userLoc.lat,userLoc.lng,b.latitude,b.longitude);
    return new Date(b.created_at)-new Date(a.created_at);
  });

  const toggleSave  = id => setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const savedHouses = listings.filter(h=>saved.includes(h.id));
  const nearby      = userLoc?listings.filter(h=>h.latitude&&distKm(userLoc.lat,userLoc.lng,h.latitude,h.longitude)<20):[];

  const logout = () => { localStorage.removeItem("nf_user"); setUser(null); showToast("Logged out successfully."); };

  const Nav=({label,v,badge})=>(
    <button onClick={()=>setView(v)} style={{background:view===v?"#15803d":"transparent",color:view===v?"#fff":"#374151",border:"none",borderRadius:30,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:".8rem",transition:"all .2s",position:"relative"}}>
      {label}
      {badge>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#ef4444",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:".55rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge}</span>}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f8fdf9",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box} body{overflow-x:hidden}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:3px}
        input,select,textarea,button{font-family:inherit}
        @media(max-width:640px){
          .listings-grid{grid-template-columns:1fr!important}
          .hero-search{flex-direction:column!important}
          .how-grid{grid-template-columns:1fr!important}
          .filters-row{flex-direction:column!important}
          .nav-links button{padding:5px 8px!important;font-size:.7rem!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{background:"rgba(255,255,255,.93)",backdropFilter:"blur(12px)",borderBottom:"1px solid #dcfce7",padding:"0 16px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:500}}>
        <div style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",flexShrink:0}} onClick={()=>setView("home")}>
          <div style={{background:"linear-gradient(135deg,#15803d,#4ade80)",borderRadius:9,width:33,height:33,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.05rem"}}>🏠</div>
          <span style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:"1.1rem"}}>Nyumba<span style={{color:"#15803d"}}>Find</span></span>
        </div>
        <div className="nav-links" style={{display:"flex",gap:2,flexWrap:"nowrap",overflowX:"auto",alignItems:"center"}}>
          <Nav label="Home"         v="home"/>
          <Nav label="Browse"       v="listings"/>
          <Nav label="How It Works" v="how"/>
          <Nav label={`❤️${saved.length||""}`} v="saved"/>
          <Nav label="List Property" v="landlord"/>
          {user?(
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:6}}>
              {user.is_premium&&<span style={{background:"#7c3aed",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:".62rem",fontWeight:700}}>⭐ Premium</span>}
              <button onClick={()=>setView("profile")} style={{background:"linear-gradient(135deg,#052e16,#15803d)",color:"#fff",border:"none",borderRadius:30,padding:"6px 13px",fontWeight:700,fontSize:".76rem",cursor:"pointer"}}>👤 {user.first_name}</button>
            </div>
          ):(
            <button onClick={()=>{setAuthMode("signup");setShowAuth(true);}} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"7px 15px",fontWeight:700,fontSize:".8rem",cursor:"pointer",marginLeft:4}}>Sign Up</button>
          )}
        </div>
      </nav>

      {/* HOME */}
      {view==="home"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#052e16,#14532d,#15803d)",padding:"70px 22px 62px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 50%,rgba(74,222,128,.12) 0%,transparent 50%)"}}/>
            <div style={{position:"relative",maxWidth:680,margin:"0 auto",animation:"fadeUp .7s ease"}}>
              <div style={{display:"inline-block",background:"rgba(74,222,128,.2)",color:"#4ade80",borderRadius:30,padding:"5px 16px",fontSize:".73rem",fontWeight:700,marginBottom:15,letterSpacing:".08em"}}>🇲🇼 MALAWI'S MOST TRUSTED HOME FINDER</div>
              <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(2.1rem,6vw,3.7rem)",color:"#fff",margin:"0 0 13px",lineHeight:1.15}}>Find a Home You'll <span style={{color:"#4ade80",fontStyle:"italic"}}>Love</span> in Malawi</h1>
              <p style={{color:"#bbf7d0",fontSize:"1rem",marginBottom:28,lineHeight:1.7}}>Chief-verified. ID-checked. Deposit protected. Only {SERVICE_FEE_PCT}% service fee.<br/>{userLoc?`📍 Homes near you in ${userCity}`:"Allow location to find closest homes."}</p>
              <div className="hero-search" style={{background:"#fff",borderRadius:15,padding:7,display:"flex",gap:7,maxWidth:520,margin:"0 auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)",width:"100%"}}>
                <input placeholder="🔍 Search city or neighbourhood..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,border:"none",padding:"10px 13px",fontSize:".9rem",borderRadius:9,background:"transparent",color:"#111",outline:"none",minWidth:0}}/>
                <button onClick={()=>setView("listings")} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:9,padding:"10px 18px",fontWeight:700,cursor:"pointer",flexShrink:0}}>Search</button>
              </div>
              {!userLoc&&<button onClick={requestLoc} disabled={locLoad} style={{marginTop:13,background:"rgba(255,255,255,.12)",color:"#fff",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:30,padding:"7px 17px",fontSize:".79rem",fontWeight:600,cursor:"pointer"}}>{locLoad?"⏳ Detecting...":"📍 Use My Location"}</button>}
              {userLoc&&<div style={{marginTop:11,color:"#4ade80",fontSize:".79rem",fontWeight:600}}>📍 {nearby.length} homes found near you in {userCity}</div>}
              <div style={{display:"flex",gap:7,justifyContent:"center",marginTop:15,flexWrap:"wrap"}}>
                {["Lilongwe","Blantyre","Mzuzu","Zomba"].map(c=><button key={c} onClick={()=>{setCity(c);setView("listings");}} style={{background:"rgba(255,255,255,.12)",color:"#fff",border:"1px solid rgba(255,255,255,.2)",borderRadius:30,padding:"5px 13px",fontSize:".77rem",cursor:"pointer"}}>{c}</button>)}
              </div>
            </div>
          </div>

          {/* Trust bar */}
          <div style={{background:"#fff",borderBottom:"1px solid #f0fdf4",padding:"13px 20px"}}>
            <div style={{maxWidth:860,margin:"0 auto",display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:11,textAlign:"center"}}>
              {[["✅","Chief Verified"],["🪪","ID Checked"],["💰","Only 5% Fee"],["🔒","Zero Scams"],["📍","Location-Smart"]].map(([i,l])=>(
                <div key={l}><div style={{fontSize:"1.15rem"}}>{i}</div><div style={{fontSize:".69rem",color:"#6b7280",fontWeight:600}}>{l}</div></div>
              ))}
            </div>
          </div>

          {/* Premium Banner */}
          {!user&&(
            <div style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",padding:"16px 20px",textAlign:"center"}}>
              <p style={{color:"#fff",margin:"0 0 8px",fontWeight:600,fontSize:".9rem"}}>⭐ Unlock Premium — Talk directly to landlords for only {fmt(PREMIUM_TENANT)}/month</p>
              <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                <button onClick={()=>{setAuthMode("signup");setShowAuth(true);}} style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,.4)",borderRadius:30,padding:"7px 18px",fontWeight:700,fontSize:".82rem",cursor:"pointer"}}>Sign Up Free</button>
                {user&&<button onClick={()=>setShowPremium("tenant_premium")} style={{background:"#fff",color:"#7c3aed",border:"none",borderRadius:30,padding:"7px 18px",fontWeight:700,fontSize:".82rem",cursor:"pointer"}}>Get Premium</button>}
              </div>
            </div>
          )}

          {loading&&<Spinner/>}
          {!loading&&err&&(
            <div style={{maxWidth:460,margin:"40px auto",padding:"0 20px",textAlign:"center"}}>
              <div style={{fontSize:"3.5rem",marginBottom:16}}>📶</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 10px",fontSize:"1.3rem"}}>No Internet Connection</h3>
              <p style={{color:"#6b7280",marginBottom:20,lineHeight:1.7,fontSize:".88rem"}}>Please check your WiFi or mobile data and try again.</p>
              <button onClick={()=>window.location.reload()} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"12px 28px",fontWeight:700,fontSize:".95rem",cursor:"pointer",display:"block",width:"100%",marginBottom:10}}>🔄 Try Again</button>
            </div>
          )}

          {!loading&&listings.length>0&&(
            <div style={{padding:"38px 20px",maxWidth:1060,margin:"0 auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:19}}>
                <div><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.6rem",margin:"0 0 3px"}}>Featured Homes</h2><p style={{margin:0,color:"#6b7280",fontSize:".81rem"}}>Personally verified by NyumbaFind</p></div>
                <button onClick={()=>setView("listings")} style={{background:"none",border:"2px solid #15803d",color:"#15803d",borderRadius:30,padding:"7px 15px",cursor:"pointer",fontWeight:700,fontSize:".79rem"}}>See All →</button>
              </div>
              <div className="listings-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19}}>
                {listings.slice(0,6).map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={saved.includes(h.id)} onSave={toggleSave} userLoc={userLoc} user={user}/>)}
              </div>
            </div>
          )}

          {!loading&&listings.length===0&&!err&&(
            <div style={{textAlign:"center",padding:"80px 20px",color:"#9ca3af"}}>
              <div style={{fontSize:"3rem",marginBottom:11}}>🏚</div>
              <p style={{fontSize:"1rem",marginBottom:16}}>No listings yet. Be the first landlord on NyumbaFind!</p>
              <button onClick={()=>setView("landlord")} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"11px 24px",cursor:"pointer",fontWeight:700}}>List Your Property</button>
            </div>
          )}

          {/* Pricing section */}
          <div style={{background:"#f0fdf4",padding:"50px 20px"}}>
            <div style={{maxWidth:860,margin:"0 auto",textAlign:"center"}}>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",marginBottom:8}}>Simple, Honest Pricing</h2>
              <p style={{color:"#6b7280",marginBottom:32}}>No hidden fees. Just real homes for real people.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:18}}>
                {[
                  {icon:"🌿",title:"Free Tenant",price:"Free",desc:"Browse all listings",features:["Browse verified homes","Deposit protected","90% refund policy","Save favourite homes"],color:"#15803d",bg:"#fff"},
                  {icon:"⭐",title:"Premium Tenant",price:fmt(PREMIUM_TENANT)+"/mo",desc:"For serious house hunters",features:["Everything in Free","Talk directly to landlords","10% off service fees","Priority new listings","Premium badge"],color:"#7c3aed",bg:"#f5f3ff",badge:"POPULAR"},
                  {icon:"👑",title:"Verified Landlord",price:fmt(LANDLORD_VERIFY)+" once",desc:"One-time verification fee",features:["Verified badge on listing","Appear first in search","Direct tenant contact","NyumbaFind trust seal","ID & Chief's letter verified"],color:"#f59e0b",bg:"#fffbeb"},
                ].map(p=>(
                  <div key={p.title} style={{background:p.bg,borderRadius:18,padding:22,boxShadow:"0 4px 20px rgba(0,0,0,.07)",border:`1.5px solid ${p.color}20`,position:"relative",textAlign:"left"}}>
                    {p.badge&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:p.color,color:"#fff",borderRadius:20,padding:"3px 14px",fontSize:".65rem",fontWeight:800,whiteSpace:"nowrap"}}>{p.badge}</div>}
                    <div style={{fontSize:"1.8rem",marginBottom:8}}>{p.icon}</div>
                    <h3 style={{margin:"0 0 3px",fontFamily:"'Playfair Display',serif",color:p.color}}>{p.title}</h3>
                    <div style={{fontSize:"1.3rem",fontWeight:800,color:"#111",marginBottom:3}}>{p.price}</div>
                    <div style={{color:"#6b7280",fontSize:".78rem",marginBottom:14}}>{p.desc}</div>
                    {p.features.map(f=><div key={f} style={{display:"flex",gap:7,marginBottom:7,fontSize:".8rem",color:"#374151",alignItems:"flex-start"}}><span style={{color:p.color,fontWeight:700,flexShrink:0}}>✓</span>{f}</div>)}
                    {p.title!=="Free Tenant"&&(
                      <button onClick={()=>{ if(!user){setAuthMode("signup");setShowAuth(true);} else setShowPremium(p.title.includes("Tenant")?"tenant_premium":"landlord_verify"); }} style={{width:"100%",background:`linear-gradient(135deg,${p.color},${p.color}cc)`,color:"#fff",border:"none",borderRadius:12,padding:12,fontWeight:700,cursor:"pointer",marginTop:12,fontSize:".85rem"}}>
                        {p.title.includes("Tenant")?"Get Premium →":"Get Verified →"}
                      </button>
                    )}
                    {p.title==="Free Tenant"&&(
                      <button onClick={()=>{setAuthMode("signup");setShowAuth(true);}} style={{width:"100%",background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:12,padding:12,fontWeight:700,cursor:"pointer",marginTop:12,fontSize:".85rem"}}>Sign Up Free →</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{background:"#052e16",padding:"50px 20px",textAlign:"center"}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",color:"#fff",fontSize:"1.75rem",marginBottom:7}}>Built on Trust. Built for Malawi.</h2>
            <p style={{color:"#86efac",marginBottom:32}}>The only platform where every listing is personally verified.</p>
            <div style={{display:"flex",justifyContent:"center",gap:20,flexWrap:"wrap",maxWidth:800,margin:"0 auto"}}>
              {[["👑","Chief Verified","Every landlord confirmed by village headman"],["🪪","ID Checked","National ID verified before listing goes live"],["💰","Only 5% Fee","The lowest service fee in Malawi"],["🔄","90% Refund","Don't like the house? 90% back."]].map(([icon,title,desc])=>(
                <div key={title} style={{flex:"1",minWidth:155,color:"#fff"}}>
                  <div style={{fontSize:"1.8rem",marginBottom:7}}>{icon}</div>
                  <h3 style={{margin:"0 0 5px",fontFamily:"'Playfair Display',serif",fontSize:".96rem"}}>{title}</h3>
                  <p style={{color:"#86efac",fontSize:".77rem",lineHeight:1.6}}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:"50px 20px",textAlign:"center"}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.75rem",marginBottom:8}}>Have a House to Rent?</h2>
            <p style={{color:"#6b7280",marginBottom:18,maxWidth:430,margin:"0 auto 18px"}}>List with NyumbaFind and reach verified tenants across Malawi.</p>
            <button onClick={()=>setView("landlord")} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:13,padding:"13px 28px",fontSize:"1rem",fontWeight:700,cursor:"pointer",boxShadow:"0 6px 20px rgba(21,128,61,.28)"}}>List Your Property →</button>
          </div>
        </div>
      )}

      {/* BROWSE */}
      {view==="listings"&&(
        <div style={{maxWidth:1060,margin:"0 auto",padding:"24px 20px"}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.65rem",marginBottom:18}}>Browse All Homes</h2>
          {!userLoc?(
            <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:13,padding:"13px 17px",display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
              <div style={{fontSize:"1.7rem"}}>🗺️</div>
              <div style={{flex:1}}><div style={{fontWeight:700,color:"#92400e",fontSize:".84rem"}}>Find homes near you</div><div style={{color:"#78350f",fontSize:".77rem"}}>Allow location to see the closest homes first</div></div>
              <button onClick={requestLoc} disabled={locLoad} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"8px 15px",fontWeight:700,fontSize:".77rem",cursor:"pointer"}}>{locLoad?"Detecting...":"📍 My Location"}</button>
            </div>
          ):(
            <div style={{background:"linear-gradient(135deg,#052e16,#15803d)",borderRadius:13,padding:"12px 17px",display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
              <div style={{fontSize:"1.5rem"}}>📍</div>
              <div><div style={{color:"#4ade80",fontWeight:700,fontSize:".8rem"}}>Location active!</div><div style={{color:"#fff",fontSize:".84rem"}}>Showing homes near <strong>{userCity}</strong></div></div>
            </div>
          )}
          <div className="filters-row" style={{background:"#fff",borderRadius:13,padding:15,marginBottom:18,display:"flex",gap:9,flexWrap:"wrap",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
            <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:2,minWidth:120,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 12px",fontSize:".84rem",outline:"none"}}/>
            <select value={city} onChange={e=>setCity(e.target.value)} style={{flex:1,minWidth:105,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem"}}>
              {["All Cities","Lilongwe","Blantyre","Mzuzu","Zomba"].map(c=><option key={c}>{c}</option>)}
            </select>
            <select value={tier} onChange={e=>setTier(e.target.value)} style={{flex:1,minWidth:105,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem"}}>
              {["All Homes","🌿 Basic","🏠 Standard","✨ Premium"].map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{flex:1,minWidth:115,border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 10px",fontSize:".84rem"}}>
              {["Newest First","Lowest Price","Highest Rated","Nearest First"].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{flex:2,minWidth:125}}>
              <div style={{fontSize:".69rem",color:"#6b7280",marginBottom:2}}>Max: {fmt(maxPrice)}/mo</div>
              <input type="range" min="30000" max="1000000" step="10000" value={maxPrice} onChange={e=>setMaxPrice(+e.target.value)} style={{width:"100%",accentColor:"#15803d"}}/>
            </div>
          </div>
          <p style={{color:"#6b7280",fontSize:".83rem",margin:"0 0 15px"}}>{loading?"Loading...":filtered.length+" home"+(filtered.length!==1?"s":"")+" found"}</p>
          {loading&&<Spinner/>}
          {!loading&&err&&(
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:"3.5rem",marginBottom:12}}>📶</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 8px",fontSize:"1.2rem"}}>No Internet Connection</h3>
              <p style={{fontSize:".86rem",marginBottom:6,color:"#6b7280",lineHeight:1.7}}>Please check your WiFi or mobile data and try again.</p>
              <button onClick={()=>window.location.reload()} style={{background:"linear-gradient(135deg,#15803d,#4ade80)",color:"#fff",border:"none",borderRadius:30,padding:"11px 26px",fontWeight:700,cursor:"pointer",marginTop:16}}>🔄 Try Again</button>
            </div>
          )}
          {!loading&&filtered.length===0&&!err&&<div style={{textAlign:"center",padding:60,color:"#9ca3af"}}><div style={{fontSize:"3rem"}}>🏚</div><p>No homes match your filters.</p></div>}
          {!loading&&(
            <div className="listings-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19}}>
              {filtered.map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={saved.includes(h.id)} onSave={toggleSave} userLoc={userLoc} user={user}/>)}
            </div>
          )}
        </div>
      )}

      {/* HOW IT WORKS */}
      {view==="how"&&(
        <div style={{maxWidth:840,margin:"0 auto",padding:"38px 20px"}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.9rem",textAlign:"center",marginBottom:5}}>How NyumbaFind Works</h2>
          <p style={{textAlign:"center",color:"#6b7280",marginBottom:32}}>Zero scams. Full protection. Only {SERVICE_FEE_PCT}% service fee.</p>
          <div className="how-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            {[["🏘️ For Tenants","#f0fdf4","#15803d",[["🔍","Search","Browse verified homes by city, price and distance."],["👤","Sign Up Free","Create your account in 30 seconds."],["💰","Pay Safely","Deposit goes to NyumbaFind — never directly to landlord."],["🏠","View House","NyumbaFind arranges your viewing within 24 hours."],["✅","Confirm","Happy? Deposit released. Get your keys! 🔑"],["🔄","Not Happy?","Get 90% refunded. NyumbaFind keeps 10% inspection fee."]]],["🏗️ For Landlords","#eff6ff","#3b82f6",[["📱","Sign Up","Create a landlord account."],["👑","Get Verified","Pay MWK 4,000 once to get your verified badge."],["📸","Submit Photos","Upload real photos of your property."],["✅","Go Live","NyumbaFind reviews and approves your listing."],["💸","Get Paid","Tenant confirms → money transferred to you."],["💰","Low Fee","Only "+SERVICE_FEE_PCT+"% on successful rentals — lowest in Malawi."]]]].map(([title,bg,color,steps])=>(
              <div key={title} style={{background:bg,borderRadius:17,padding:19}}>
                <h3 style={{fontFamily:"'Playfair Display',serif",color,margin:"0 0 15px",fontSize:"1.08rem"}}>{title}</h3>
                {steps.map(([icon,label,desc],i)=>(
                  <div key={label} style={{display:"flex",gap:10,marginBottom:13}}>
                    <div style={{background:color,color:"#fff",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".82rem",flexShrink:0}}>{icon}</div>
                    <div><div style={{fontWeight:700,fontSize:".81rem",marginBottom:1}}>Step {i+1}: {label}</div><div style={{color:"#6b7280",fontSize:".74rem",lineHeight:1.6}}>{desc}</div></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{background:"#052e16",borderRadius:17,padding:22,marginTop:24,color:"#fff",textAlign:"center"}}>
            <h3 style={{fontFamily:"'Playfair Display',serif",margin:"0 0 14px",fontSize:"1.15rem"}}>💰 Money Flow</h3>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,flexWrap:"wrap"}}>
              {["Tenant Pays","→","NyumbaFind Holds","→","House Viewed","→","Tenant Confirms","→","Landlord Paid","→","House Removed"].map((s,i)=>(
                <div key={i} style={{background:s==="→"?"transparent":"rgba(74,222,128,.15)",color:s==="→"?"#4ade80":"#fff",borderRadius:s==="→"?0:30,padding:s==="→"?"0 3px":"6px 12px",fontSize:s==="→"?"1rem":".75rem",fontWeight:700}}>{s}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SAVED */}
      {view==="saved"&&(
        <div style={{maxWidth:1060,margin:"0 auto",padding:"24px 20px"}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.65rem",marginBottom:18}}>❤️ Saved Homes</h2>
          {savedHouses.length===0?(
            <div style={{textAlign:"center",padding:80,color:"#9ca3af"}}>
              <div style={{fontSize:"3rem",marginBottom:11}}>🤍</div>
              <p>No saved homes yet. Browse and tap 🤍 to save!</p>
              <button onClick={()=>setView("listings")} style={{marginTop:11,background:"#15803d",color:"#fff",border:"none",borderRadius:30,padding:"10px 20px",cursor:"pointer",fontWeight:700}}>Browse Homes</button>
            </div>
          ):(
            <div className="listings-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:19}}>
              {savedHouses.map(h=><HouseCard key={h.id} house={h} onPay={setPayHouse} onView={setViewHouse} saved={true} onSave={toggleSave} userLoc={userLoc} user={user}/>)}
            </div>
          )}
        </div>
      )}

      {/* PROFILE */}
      {view==="profile"&&user&&(
        <div style={{maxWidth:560,margin:"0 auto",padding:"34px 20px"}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.7rem",marginBottom:22}}>👤 My Account</h2>
          <div style={{background:"#fff",borderRadius:20,padding:24,boxShadow:"0 4px 24px rgba(0,0,0,.08)",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#15803d,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",color:"#fff",fontWeight:700}}>{user.first_name?.[0]||"?"}</div>
              <div>
                <div style={{fontWeight:800,fontSize:"1.1rem"}}>{user.first_name} {user.last_name}</div>
                <div style={{color:"#6b7280",fontSize:".82rem"}}>{user.email}</div>
                <div style={{display:"flex",gap:5,marginTop:4}}>
                  <span style={{background:"#f0fdf4",color:"#15803d",borderRadius:20,padding:"2px 8px",fontSize:".65rem",fontWeight:700,textTransform:"uppercase"}}>{user.role||"tenant"}</span>
                  {user.is_premium&&<span style={{background:"#7c3aed",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:".65rem",fontWeight:700}}>⭐ Premium</span>}
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:16}}>
              {[["📱","Phone",user.phone||"—"],["🌆","City",user.city||"Malawi"]].map(([icon,l,v])=>(
                <div key={l} style={{background:"#f9fafb",borderRadius:10,padding:"9px 12px"}}>
                  <div style={{fontSize:".68rem",color:"#9ca3af",fontWeight:600,marginBottom:2}}>{icon} {l}</div>
                  <div style={{fontWeight:700,fontSize:".84rem"}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Upgrade options */}
            {!user.is_premium&&user.role==="tenant"&&(
              <button onClick={()=>setShowPremium("tenant_premium")} style={{width:"100%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",border:"none",borderRadius:12,padding:13,fontWeight:700,cursor:"pointer",marginBottom:10}}>
                ⭐ Upgrade to Premium — {fmt(PREMIUM_TENANT)}/month
              </button>
            )}
            {user.role==="landlord"&&!user.is_verified_landlord&&(
              <button onClick={()=>setShowPremium("landlord_verify")} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#fff",border:"none",borderRadius:12,padding:13,fontWeight:700,cursor:"pointer",marginBottom:10}}>
                👑 Get Verified — {fmt(LANDLORD_VERIFY)} one-time
              </button>
            )}

            <button onClick={logout} style={{width:"100%",background:"#fef2f2",color:"#ef4444",border:"1.5px solid #fecaca",borderRadius:12,padding:12,fontWeight:700,cursor:"pointer"}}>🚪 Logout</button>
          </div>
        </div>
      )}

      {/* LIST PROPERTY */}
      {view==="landlord"&&<LandlordForm showToast={showToast} user={user}/>}

      {/* MODALS */}
      {payHouse&&<PaymentModal house={payHouse} onClose={()=>setPayHouse(null)} user={user}/>}
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={setUser} defaultMode={authMode}/>}
      {showPremium&&<PremiumModal user={user} type={showPremium} onClose={()=>setShowPremium(null)}/>}

      <footer style={{background:"#052e16",color:"#86efac",textAlign:"center",padding:"18px",fontSize:".77rem",marginTop:40}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",color:"#fff",marginBottom:4}}>🏠 NyumbaFind</div>
        <p style={{margin:"0 0 3px"}}>Every Malawian deserves a home they love.</p>
        <p style={{margin:0,opacity:.5}}>Lilongwe · Blantyre · Mzuzu · Zomba 🇲🇼</p>
      </footer>
      <Toast msg={toast}/>
    </div>
  );
}
// End of file marker
