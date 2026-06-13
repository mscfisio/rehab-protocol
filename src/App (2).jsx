import { useState, useRef, useEffect } from "react";

// ─── CONFIG ────────────────────────────────────────────────
// Token salvato in localStorage dopo login
const TOKEN_KEY = "rp_auth_token";

const SYSTEM_PROMPT = `Sei un assistente specializzato in fisioterapia evidence-based rivolto a fisioterapisti professionisti.
Rispondi ESCLUSIVAMENTE basandoti su fonti cliniche validate:
- APTA Clinical Practice Guidelines
- JOSPT (Journal of Orthopaedic & Sports Physical Therapy)
- PubMed / PubMed Central (PMC) — studi peer-reviewed
- Cochrane Systematic Reviews
- Kisner & Colby — Therapeutic Exercise: Foundations and Techniques
- Magee — Orthopedic Physical Assessment
- Dutton — Orthopaedic Examination, Evaluation and Intervention
- Cyriax — Textbook of Orthopaedic Medicine
- Maitland — Vertebral Manipulation
- Neumann — Kinesiology of the Musculoskeletal System
- Protocolli HSS (Hospital for Special Surgery)
- MOON Knee Group protocols

Se viene allegato un PDF, integralo come fonte aggiuntiva citandolo esplicitamente.

Rispondi SOLO con un oggetto JSON valido, nessun testo prima o dopo, nessun markdown, nessun backtick.
Struttura JSON obbligatoria:
{
  "valutazione": { "titolo": "string", "riepilogo": "string" },
  "batteria_test": [{ "nome": "string", "obiettivo": "string", "procedura": "string", "scoring": "string", "fonte": "string" }],
  "fasi_riabilitazione": [{ "numero": 1, "nome": "string", "timeline": "string", "obiettivi": ["string"], "criteri_avanzamento": ["string"], "precauzioni": ["string"] }],
  "esercizi_per_fase": [{ "fase": 1, "esercizi": [{ "nome": "string", "tipo": "string", "parametri": "string", "progressione": "string", "controindicazioni": "string" }] }],
  "fonti_principali": ["string"],
  "disclaimer": "string"
}
Lingua: italiano per descrizioni, inglese per terminologia tecnica clinica standard.
Se le informazioni su una patologia sono insufficienti nelle fonti disponibili, dichiara esplicitamente il limite nel campo riepilogo.`;

const FASI = ["Acuta (0-2 settimane)", "Subacuta (2-6 settimane)", "Rimodellamento (6-12 settimane)", "Funzionale/Return to Activity", "Post-operatoria precoce", "Post-operatoria tardiva", "Cronica"];

// ─── STYLES ────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0F1829; } ::-webkit-scrollbar-thumb { background: #14B8A6; border-radius: 2px; }
  input, select, textarea { outline: none; }
  input:focus, select:focus, textarea:focus { border-color: #14B8A6 !important; box-shadow: 0 0 0 2px rgba(20,184,166,0.15) !important; }
  .btn-primary { background: linear-gradient(135deg, #14B8A6, #0D9488); border: none; color: white; cursor: pointer; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 0.95rem; padding: 14px 28px; border-radius: 12px; width: 100%; transition: all 0.2s; letter-spacing: 0.02em; }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(20,184,166,0.35); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-ghost { background: transparent; border: 1px solid #1E3A5F; color: #94A3B8; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 0.85rem; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
  .btn-ghost:hover { border-color: #14B8A6; color: #14B8A6; }
  .field-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #64748B; margin-bottom: 6px; display: block; }
  .field-input { width: 100%; background: #0F1829; border: 1px solid #1E2D4A; border-radius: 10px; color: #E2E8F0; font-family: 'Sora', sans-serif; font-size: 0.9rem; padding: 11px 14px; transition: border-color 0.2s, box-shadow 0.2s; }
  select.field-input option { background: #0F1829; }
  .card { background: #0D1B2E; border: 1px solid #1A2D4A; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
  .tag { display: inline-block; background: rgba(20,184,166,0.12); color: #14B8A6; border: 1px solid rgba(20,184,166,0.25); border-radius: 20px; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; letter-spacing: 0.04em; }
  .badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(148,163,184,0.08); color: #94A3B8; border-radius: 6px; font-size: 0.78rem; padding: 3px 8px; font-family: 'DM Mono', monospace; }
  .tab-btn { background: transparent; border: none; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 0.8rem; font-weight: 500; padding: 10px 14px; border-radius: 10px; transition: all 0.2s; display: flex; align-items: center; gap: 6px; color: #475569; white-space: nowrap; }
  .tab-btn.active { background: rgba(20,184,166,0.15); color: #14B8A6; }
  .tab-btn:hover:not(.active) { color: #94A3B8; background: rgba(255,255,255,0.04); }
  .pill { display: inline-block; background: rgba(20,184,166,0.08); border-left: 2px solid #14B8A6; padding: 6px 12px; border-radius: 0 6px 6px 0; font-size: 0.83rem; color: #CBD5E1; margin: 4px 0; }
  .warn-pill { display: inline-block; background: rgba(251,146,60,0.08); border-left: 2px solid #FB923C; padding: 6px 12px; border-radius: 0 6px 6px 0; font-size: 0.83rem; color: #CBD5E1; margin: 4px 0; }
  .fase-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 14px 16px; border-radius: 10px; transition: background 0.2s; }
  .fase-header:hover { background: rgba(255,255,255,0.03); }
  .esercizio-card { background: rgba(255,255,255,0.02); border: 1px solid #1A2D4A; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
  .spinner { width: 36px; height: 36px; border: 3px solid rgba(20,184,166,0.2); border-top-color: #14B8A6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .dot-pulse::after { content: ''; animation: dots 1.5s infinite; }
  @keyframes dots { 0% { content: ''; } 33% { content: '.'; } 66% { content: '..'; } 100% { content: '...'; } }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .grid-2 { grid-template-columns: 1fr; } }
  .fonte-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #1A2D4A; }
  .fonte-item:last-child { border-bottom: none; }
  .fonte-dot { width: 6px; height: 6px; background: #14B8A6; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
  .section-title { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #14B8A6; margin-bottom: 12px; }
  .test-card { background: rgba(255,255,255,0.02); border: 1px solid #1A2D4A; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .test-card-title { font-size: 0.95rem; font-weight: 600; color: #E2E8F0; margin-bottom: 8px; }
  .info-row { display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; align-items: baseline; }
  .info-key { font-size: 0.73rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; min-width: 90px; }
  .info-val { font-size: 0.83rem; color: #94A3B8; flex: 1; }
  /* Landing */
  .landing-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 70%); }
  .landing-headline { font-size: clamp(2rem, 6vw, 3.5rem); font-weight: 700; color: #F1F5F9; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 20px; }
  .landing-sub { font-size: clamp(0.95rem, 2.5vw, 1.15rem); color: #64748B; max-width: 520px; line-height: 1.7; margin-bottom: 40px; }
  .landing-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: 700px; width: 100%; margin-bottom: 48px; }
  .feature-card { background: rgba(255,255,255,0.03); border: 1px solid #1A2D4A; border-radius: 14px; padding: 20px; text-align: left; }
  .feature-icon { width: 36px; height: 36px; background: rgba(20,184,166,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .feature-title { font-size: 0.9rem; font-weight: 600; color: #E2E8F0; margin-bottom: 6px; }
  .feature-desc { font-size: 0.8rem; color: #475569; line-height: 1.5; }
  .landing-cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .btn-cta { background: linear-gradient(135deg, #14B8A6, #0D9488); border: none; color: white; cursor: pointer; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 1rem; padding: 16px 36px; border-radius: 14px; transition: all 0.2s; letter-spacing: 0.02em; }
  .btn-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(20,184,166,0.4); }
  /* Login */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .login-box { background: #0D1B2E; border: 1px solid #1A2D4A; border-radius: 20px; padding: 36px 32px; width: 100%; max-width: 400px; }
  .login-title { font-size: 1.4rem; font-weight: 700; color: #F1F5F9; margin-bottom: 6px; }
  .login-sub { font-size: 0.83rem; color: #475569; margin-bottom: 28px; }
  .login-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; color: #FCA5A5; margin-bottom: 16px; }
`;

// ─── HEADER ────────────────────────────────────────────────
function Header({ onLogout, showLogout }) {
  return (
    <div style={{ background: "linear-gradient(180deg, #0D1B2E 0%, #070D1A 100%)", borderBottom: "1px solid #1A2D4A", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #14B8A6, #0891B2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.01em" }}>RehabProtocol</div>
            <div style={{ fontSize: "0.7rem", color: "#475569", letterSpacing: "0.04em" }}>Evidence-Based Physiotherapy</div>
          </div>
        </div>
        {showLogout && (
          <button className="btn-ghost" onClick={onLogout} style={{ fontSize: "0.78rem" }}>Esci</button>
        )}
      </div>
    </div>
  );
}

// ─── LANDING PAGE ──────────────────────────────────────────
function Landing({ onLogin }) {
  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: "#070D1A", minHeight: "100vh", color: "#E2E8F0" }}>
      <Header showLogout={false} />
      <div className="landing-hero">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: 20, padding: "6px 14px", fontSize: "0.75rem", color: "#14B8A6", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 28 }}>
          ✦ EVIDENCE-BASED · FISIOTERAPIA PROFESSIONALE
        </div>
        <h1 className="landing-headline">
          Protocolli riabilitativi<br />
          <span style={{ color: "#14B8A6" }}>in 30 secondi</span>
        </h1>
        <p className="landing-sub">
          Inserisci i dati clinici del paziente. RehabProtocol genera un protocollo evidence-based completo — test, fasi, esercizi, fonti — basato su Kisner, APTA, JOSPT e Cochrane.
        </p>
        <div className="landing-features">
          {[
            { icon: "📋", title: "Batteria test validata", desc: "Test clinici selezionati per diagnosi e fase, con procedura e scoring." },
            { icon: "📈", title: "Fasi con criteri", desc: "Progressione per fasi con criteri di avanzamento e precauzioni specifiche." },
            { icon: "💪", title: "Esercizi per fase", desc: "Parametri, progressione e controindicazioni per ogni esercizio." },
            { icon: "📚", title: "Fonti citate", desc: "Ogni protocollo riporta le fonti bibliografiche utilizzate." },
          ].map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon"><span style={{ fontSize: "1.1rem" }}>{f.icon}</span></div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
        <div className="landing-cta">
          <button className="btn-cta" onClick={onLogin}>Accedi alla piattaforma →</button>
        </div>
        <div style={{ marginTop: 48, fontSize: "0.75rem", color: "#334155", maxWidth: 480, lineHeight: 1.6 }}>
          Strumento di supporto clinico professionale. I protocolli generati non sostituiscono il ragionamento clinico del fisioterapista.
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ────────────────────────────────────────────
function Login({ onSuccess, onBack }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!token.trim()) { setError("Inserisci il token di accesso."); return; }
    setLoading(true); setError("");
    try {
      // Verifica token facendo una chiamata test al proxy
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token.trim()}` },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if (res.status === 401) { setError("Token non valido."); return; }
      // Token valido — salva e procedi
      localStorage.setItem(TOKEN_KEY, token.trim());
      onSuccess(token.trim());
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: "#070D1A", minHeight: "100vh", color: "#E2E8F0" }}>
      <Header showLogout={false} />
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-title">Accedi</div>
          <div className="login-sub">Inserisci il tuo token di accesso per continuare.</div>
          {error && <div className="login-error">{error}</div>}
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Token di accesso</label>
            <input
              className="field-input"
              type="password"
              placeholder="rp_••••••••••••"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? "Verifica in corso..." : "Accedi"}
          </button>
          <button className="btn-ghost" onClick={onBack} style={{ width: "100%", marginTop: 10 }}>
            ← Torna alla home
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB ICON ──────────────────────────────────────────────
const TabIcon = ({ tab }) => {
  const icons = {
    test: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    fasi: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
    esercizi: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>,
    fonti: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z"/></svg>,
  };
  return icons[tab] || null;
};

// ─── APP PRINCIPALE ────────────────────────────────────────
function AppMain({ token, onLogout }) {
  const [form, setForm] = useState({ eta: "", sesso: "", diagnosi: "", intervento: "", comorbidita: "", fase: "", settimane: "" });
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("test");
  const [expandedFase, setExpandedFase] = useState(null);
  const fileRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePdf = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    setPdfFile(file);
    const reader = new FileReader();
    reader.onload = () => setPdfBase64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const buildPrompt = () => `DATI PAZIENTE:
- Età: ${form.eta} anni
- Sesso: ${form.sesso}
- Diagnosi: ${form.diagnosi}
- Intervento chirurgico: ${form.intervento || "Conservativo / Non chirurgico"}
- Comorbidità: ${form.comorbidita || "Nessuna rilevante"}
- Fase clinica attuale: ${form.fase}${form.settimane ? `\n- Settimane post-operatorie: ${form.settimane}` : ""}${pdfBase64 ? "\n- PDF allegato: integra i protocolli presenti nel documento come fonte aggiuntiva." : ""}

Genera il protocollo riabilitativo completo in JSON.`;

  const handleSubmit = async () => {
    if (!form.eta || !form.sesso || !form.diagnosi || !form.fase) {
      setError("Campi obbligatori mancanti: età, sesso, diagnosi, fase clinica.");
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const content = pdfBase64
        ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } }, { type: "text", text: buildPrompt() }]
        : buildPrompt();

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content.map(i => i.text || "").join("").replace(/```json|```/g, "").trim();
      setResult(JSON.parse(text));
      setActiveTab("test");
      setExpandedFase(null);
    } catch (err) {
      setError("Errore: " + err.message + ". Verifica che i dati siano corretti e riprova.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({ eta: "", sesso: "", diagnosi: "", intervento: "", comorbidita: "", fase: "", settimane: "" });
    setResult(null); setError(null); setPdfFile(null); setPdfBase64(null);
  };

  const tabs = [
    { id: "test", label: "Batteria Test" },
    { id: "fasi", label: "Fasi Riab." },
    { id: "esercizi", label: "Esercizi" },
    { id: "fonti", label: "Fonti" },
  ];

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: "#070D1A", minHeight: "100vh", color: "#E2E8F0" }}>
      <Header showLogout onLogout={onLogout} />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 40px" }}>

        {!result && !loading && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Scheda Paziente</div>
              <div style={{ fontSize: "0.83rem", color: "#475569" }}>Compila i dati per generare il protocollo riabilitativo</div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-title">Dati anagrafici</div>
              <div className="grid-2">
                <div>
                  <label className="field-label">Età *</label>
                  <input className="field-input" name="eta" type="number" min="1" max="110" placeholder="es. 45" value={form.eta} onChange={handleChange} />
                </div>
                <div>
                  <label className="field-label">Sesso *</label>
                  <select className="field-input" name="sesso" value={form.sesso} onChange={handleChange}>
                    <option value="">Seleziona</option>
                    <option>Maschile</option>
                    <option>Femminile</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-title">Dati clinici</div>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Diagnosi *</label>
                <textarea className="field-input" name="diagnosi" rows={2} placeholder="es. Rottura del LCA, Coxartrosi grado III..." value={form.diagnosi} onChange={handleChange} style={{ resize: "vertical", minHeight: 60 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Intervento chirurgico</label>
                <input className="field-input" name="intervento" placeholder="es. Ricostruzione LCA — lascia vuoto se conservativo" value={form.intervento} onChange={handleChange} />
              </div>
              <div>
                <label className="field-label">Comorbidità</label>
                <input className="field-input" name="comorbidita" placeholder="es. Diabete tipo 2, Ipertensione..." value={form.comorbidita} onChange={handleChange} />
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="section-title">Fase clinica</div>
              <div className="grid-2">
                <div>
                  <label className="field-label">Fase attuale *</label>
                  <select className="field-input" name="fase" value={form.fase} onChange={handleChange}>
                    <option value="">Seleziona fase</option>
                    {FASI.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Settimane post-op</label>
                  <input className="field-input" name="settimane" type="number" min="0" placeholder="es. 6" value={form.settimane} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Protocollo aggiuntivo (opzionale)</div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "1px dashed #1E3A5F", borderRadius: 10, padding: "16px", cursor: "pointer", textAlign: "center", transition: "border-color 0.2s", background: pdfFile ? "rgba(20,184,166,0.05)" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#14B8A6"}
                onMouseLeave={e => e.currentTarget.style.borderColor = pdfFile ? "#14B8A6" : "#1E3A5F"}
              >
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdf} />
                {pdfFile ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: "0.85rem", color: "#14B8A6", fontWeight: 500 }}>{pdfFile.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "#475569" }}>({(pdfFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ margin: "0 auto 6px" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <div style={{ fontSize: "0.83rem", color: "#475569" }}>Carica libro di testo o protocollo PDF</div>
                    <div style={{ fontSize: "0.73rem", color: "#334155", marginTop: 2 }}>Verrà integrato come fonte aggiuntiva</div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.83rem", color: "#FCA5A5" }}>
                {error}
              </div>
            )}

            <button className="btn-primary" onClick={handleSubmit}>
              Genera Protocollo Riabilitativo
            </button>

            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 8, fontSize: "0.75rem", color: "#94A3B8", lineHeight: 1.5 }}>
              <strong style={{ color: "#FB923C" }}>⚠ Uso professionale</strong> — I protocolli generati sono strumenti di supporto clinico basati su letteratura evidence-based. Non sostituiscono il ragionamento clinico del fisioterapista.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="spinner" style={{ marginBottom: 20 }} />
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#E2E8F0", marginBottom: 6 }}>Generazione protocollo<span className="dot-pulse" /></div>
            <div style={{ fontSize: "0.83rem", color: "#475569" }}>Consultazione fonti evidence-based in corso</div>
          </div>
        )}

        {result && !loading && (
          <div>
            <div style={{ marginBottom: 20, padding: "14px 16px", background: "linear-gradient(135deg, rgba(20,184,166,0.08), rgba(8,145,178,0.06))", border: "1px solid rgba(20,184,166,0.2)", borderRadius: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>{result.valutazione?.titolo}</div>
                <div style={{ fontSize: "0.82rem", color: "#94A3B8", lineHeight: 1.6 }}>{result.valutazione?.riepilogo}</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span className="badge">{form.eta}a · {form.sesso}</span>
                {form.fase && <span className="badge">{form.fase}</span>}
                {form.settimane && <span className="badge">Sett. {form.settimane}</span>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
              {tabs.map(t => (
                <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                  <TabIcon tab={t.id} />
                  {t.label}
                  {t.id === "test" && result.batteria_test?.length && <span className="tag" style={{ marginLeft: 2, fontSize: "0.65rem", padding: "1px 6px" }}>{result.batteria_test.length}</span>}
                  {t.id === "fasi" && result.fasi_riabilitazione?.length && <span className="tag" style={{ marginLeft: 2, fontSize: "0.65rem", padding: "1px 6px" }}>{result.fasi_riabilitazione.length}</span>}
                </button>
              ))}
            </div>

            {activeTab === "test" && (
              <div>
                <div className="section-title" style={{ marginBottom: 16 }}>Batteria di Test Raccomandati</div>
                {result.batteria_test?.map((test, i) => (
                  <div key={i} className="test-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div className="test-card-title">{test.nome}</div>
                      <span className="badge" style={{ marginLeft: 8, flexShrink: 0 }}>#{i + 1}</span>
                    </div>
                    <div className="info-row"><span className="info-key">Obiettivo</span><span className="info-val">{test.obiettivo}</span></div>
                    <div className="info-row"><span className="info-key">Procedura</span><span className="info-val">{test.procedura}</span></div>
                    <div className="info-row"><span className="info-key">Scoring</span><span className="info-val">{test.scoring}</span></div>
                    <div style={{ marginTop: 8 }}><span className="tag" style={{ fontSize: "0.7rem" }}>📖 {test.fonte}</span></div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "fasi" && (
              <div>
                <div className="section-title" style={{ marginBottom: 16 }}>Fasi di Riabilitazione</div>
                {result.fasi_riabilitazione?.map((fase, i) => (
                  <div key={i} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
                    <div className="fase-header" onClick={() => setExpandedFase(expandedFase === i ? null : i)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #14B8A6, #0891B2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "white", flexShrink: 0 }}>{fase.numero}</div>
                        <div>
                          <div style={{ fontSize: "0.93rem", fontWeight: 600, color: "#E2E8F0" }}>{fase.nome}</div>
                          <div style={{ fontSize: "0.75rem", color: "#475569" }}>{fase.timeline}</div>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ transform: expandedFase === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                    {expandedFase === i && (
                      <div style={{ padding: "0 16px 16px" }}>
                        {fase.obiettivi?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#14B8A6", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Obiettivi</div>
                            {fase.obiettivi.map((o, j) => <div key={j} className="pill" style={{ display: "block" }}>{o}</div>)}
                          </div>
                        )}
                        {fase.criteri_avanzamento?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#0891B2", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Criteri di avanzamento</div>
                            {fase.criteri_avanzamento.map((c, j) => <div key={j} className="pill" style={{ borderLeftColor: "#0891B2", display: "block" }}>{c}</div>)}
                          </div>
                        )}
                        {fase.precauzioni?.length > 0 && (
                          <div>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#FB923C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>⚠ Precauzioni</div>
                            {fase.precauzioni.map((p, j) => <div key={j} className="warn-pill" style={{ display: "block" }}>{p}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "esercizi" && (
              <div>
                <div className="section-title" style={{ marginBottom: 16 }}>Esercizi e Tecniche per Fase</div>
                {result.esercizi_per_fase?.map((ef, i) => {
                  const faseInfo = result.fasi_riabilitazione?.find(f => f.numero === ef.fase);
                  return (
                    <div key={i} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 24, height: 24, background: "linear-gradient(135deg, #14B8A6, #0891B2)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "white", flexShrink: 0 }}>{ef.fase}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94A3B8" }}>{faseInfo?.nome || `Fase ${ef.fase}`}</div>
                        <div style={{ flex: 1, height: 1, background: "#1A2D4A" }} />
                      </div>
                      {ef.esercizi?.map((es, j) => (
                        <div key={j} className="esercizio-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#E2E8F0", flex: 1 }}>{es.nome}</div>
                            {es.tipo && <span className="tag" style={{ marginLeft: 8, flexShrink: 0, fontSize: "0.68rem" }}>{es.tipo}</span>}
                          </div>
                          {es.parametri && <div className="info-row"><span className="info-key">Parametri</span><span className="info-val">{es.parametri}</span></div>}
                          {es.progressione && <div className="info-row"><span className="info-key">Progressione</span><span className="info-val">{es.progressione}</span></div>}
                          {es.controindicazioni && (
                            <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(251,146,60,0.06)", borderRadius: 6, fontSize: "0.78rem", color: "#94A3B8" }}>
                              <strong style={{ color: "#FB923C" }}>⚠</strong> {es.controindicazioni}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "fonti" && (
              <div>
                <div className="section-title" style={{ marginBottom: 16 }}>Fonti Bibliografiche</div>
                <div className="card">
                  {result.fonti_principali?.map((fonte, i) => (
                    <div key={i} className="fonte-item">
                      <div className="fonte-dot" />
                      <div style={{ fontSize: "0.83rem", color: "#94A3B8", lineHeight: 1.5 }}>{fonte}</div>
                    </div>
                  ))}
                </div>
                {result.disclaimer && (
                  <div style={{ padding: "12px 16px", background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 10, fontSize: "0.78rem", color: "#94A3B8", lineHeight: 1.6 }}>
                    <strong style={{ color: "#FB923C" }}>⚠ Disclaimer</strong><br />{result.disclaimer}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={reset} style={{ width: "100%" }}>← Nuovo protocollo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT — ROUTER ─────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("landing"); // landing | login | app
  const [token, setToken] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) { setToken(saved); setPage("app"); }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPage("landing");
  };

  if (page === "app" && token) return <><style>{GLOBAL_CSS}</style><AppMain token={token} onLogout={handleLogout} /></>;
  if (page === "login") return <><style>{GLOBAL_CSS}</style><Login onSuccess={(t) => { setToken(t); setPage("app"); }} onBack={() => setPage("landing")} /></>;
  return <><style>{GLOBAL_CSS}</style><Landing onLogin={() => setPage("login")} /></>;
}
