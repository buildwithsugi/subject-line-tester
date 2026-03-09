import { useState, useEffect, useRef } from "react";

const SPAM_WORDS = [
  "free","click here","urgent","act now","limited time","guaranteed","winner",
  "congratulations","cash","prize","offer","discount","buy now","order now",
  "!!!","$$$","100%","no cost","no fees","risk free","earn money","make money",
  "extra income","work from home","lose weight","miracle","amazing","incredible",
  "unbelievable","don't miss","last chance","exclusive deal","special promotion",
  "you've been selected","dear friend","this is not spam","as seen on"
];

function analyseSubject(text) {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  const words = text.trim().split(/\s+/);
  const chars = text.length;
  const issues = [];
  const positives = [];

  let lengthScore = 0;
  if (chars >= 30 && chars <= 50) { lengthScore = 20; positives.push("Ideal length (30–50 chars)"); }
  else if (chars >= 20 && chars < 30) { lengthScore = 14; issues.push("A bit short — try 30–50 characters"); }
  else if (chars > 50 && chars <= 65) { lengthScore = 14; issues.push("Slightly long — may truncate on mobile"); }
  else if (chars < 20) { lengthScore = 6; issues.push("Too short — add more context"); }
  else { lengthScore = 6; issues.push("Too long — will truncate on most clients"); }

  const foundSpam = SPAM_WORDS.filter(w => lower.includes(w));
  let spamScore = 20;
  if (foundSpam.length > 0) {
    spamScore = Math.max(0, 20 - foundSpam.length * 7);
    issues.push(`Spam trigger words: "${foundSpam.slice(0,3).join('", "')}"`);
  } else { positives.push("No spam trigger words"); }

  let personScore = 0;
  const hasPersonToken = /\{[^}]+\}|\[[^\]]+\]|{{[^}]+}}/.test(text);
  if (hasPersonToken) { personScore = 15; positives.push("Personalisation token detected"); }
  else { personScore = 5; }

  let questionScore = 0;
  if (text.includes("?")) { questionScore = 15; positives.push("Uses a question — boosts curiosity"); }
  else { questionScore = 8; }

  let numberScore = 0;
  if (/\d/.test(text)) { numberScore = 10; positives.push("Contains a number — increases specificity"); }
  else { numberScore = 6; }

  const allCapsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  let capsScore = 10;
  if (allCapsWords.length > 0) { capsScore = 4; issues.push("Avoid ALL CAPS words — looks spammy"); }
  else { positives.push("Good casing"); }

  const powerWords = ["you","your","new","now","today","exclusive","insider","secret","proven","results","tips","how","why","what","discover","boost","grow","save","increase"];
  const foundPower = powerWords.filter(w => lower.split(/\s+/).includes(w));
  let powerScore = 0;
  if (foundPower.length >= 2) { powerScore = 10; positives.push(`Strong power words: "${foundPower.slice(0,2).join('", "')}"`); }
  else if (foundPower.length === 1) { powerScore = 7; }
  else { powerScore = 3; issues.push("Add a power word (e.g. you, discover, boost, proven)"); }

  const total = lengthScore + spamScore + personScore + questionScore + numberScore + capsScore + powerScore;
  const normalised = Math.min(100, Math.round(total));

  let grade, gradeColor;
  if (normalised >= 80) { grade = "Excellent"; gradeColor = "#00E5A0"; }
  else if (normalised >= 65) { grade = "Good"; gradeColor = "#4FC3F7"; }
  else if (normalised >= 45) { grade = "Needs Work"; gradeColor = "#FFB74D"; }
  else { grade = "Poor"; gradeColor = "#FF5252"; }

  return {
    score: normalised, grade, gradeColor,
    chars, wordCount: words.length,
    issues, positives, foundSpam,
    breakdown: {
      length: lengthScore, spam: spamScore, personalisation: personScore,
      question: questionScore, numbers: numberScore, casing: capsScore, power: powerScore
    }
  };
}

async function getAISuggestions(subject, emailType, analysis) {
  const prompt = `You are an expert email marketing copywriter specialising in ${emailType} emails.

Analyse this email subject line and provide 3 improved rewrites:
"${subject}"

Current issues: ${analysis.issues.join("; ") || "none"}
Current score: ${analysis.score}/100 (${analysis.grade})

Respond ONLY with valid JSON in this exact format, no markdown, no extra text:
{
  "rewrites": [
    {"subject": "rewrite 1 here", "why": "one sentence reason"},
    {"subject": "rewrite 2 here", "why": "one sentence reason"},
    {"subject": "rewrite 3 here", "why": "one sentence reason"}
  ],
  "topTip": "one key piece of advice for this specific subject line"
}`;
const res = await fetch("https://subject-line-tester.onrender.com/api/suggest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const raw = data.content?.map(b => b.text || "").join("").replace(/```json|```/g,"").trim();
  return JSON.parse(raw);
}

function ScoreRing({ score, color }) {
  const r = 54, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={130} height={130} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={65} cy={65} r={r} fill="none" stroke="#1E2030" strokeWidth={10} />
      <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

function BreakdownBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#8892A4", fontFamily:"monospace" }}>{label}</span>
        <span style={{ fontSize:12, color, fontFamily:"monospace" }}>{value}/{max}</span>
      </div>
      <div style={{ height:6, background:"#1E2030", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3,
          transition:"width 0.6s ease", boxShadow:`0 0 8px ${color}60` }} />
      </div>
    </div>
  );
}

export default function SubjectLineTester() {
  const [input, setInput] = useState("");
  const [emailType, setEmailType] = useState("Marketing Campaign");
  const [analysis, setAnalysis] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [copied, setCopied] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", jobRole: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setAiResult(null); setAiError("");
    debounceRef.current = setTimeout(() => {
      setAnalysis(input.trim() ? analyseSubject(input) : null);
    }, 300);
  }, [input]);

  const handleGetSuggestions = async () => {
    if (!analysis) return;
    setAiLoading(true); setAiError(""); setAiResult(null);
    try {
      const r = await getAISuggestions(input, emailType, analysis);
      setAiResult(r);
    } catch(e) {
      setAiError("Couldn't fetch suggestions. Check your API key in the .env file.");
    }
    setAiLoading(false);
  };

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 1800);
  };
  const handleFormSubmit = async () => {
  if (!formData.name || !formData.email) return;
  setFormLoading(true);
  try {
    await fetch("https://script.google.com/macros/s/AKfycbzpj__kSWdx4esZDxcFdKEj_wkUSO8WslG9EL8Dr_mQpIC4cMykB_Dh3A98udCxYho2/exec", {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        jobRole: formData.jobRole,
        subjectLine: input,
        score: analysis?.score
      })
    });
    setFormSubmitted(true);
    setShowForm(false);
    handleGetSuggestions();
  } catch(e) {
    console.error(e);
  }
  setFormLoading(false);
};
  return (
    <div style={{
      minHeight:"100vh", background:"#0C0E1A",
      fontFamily:"system-ui, sans-serif",
      padding:"40px 20px",
      backgroundImage:"radial-gradient(ellipse at 20% 20%, #1a1f3a 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, #0f1829 0%, transparent 60%)"
    }}>
      <div style={{ maxWidth:820, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#131525", border:"1px solid #252840", borderRadius:20, padding:"6px 16px", marginBottom:20 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#00E5A0", boxShadow:"0 0 8px #00E5A0" }} />
            <span style={{ fontSize:12, color:"#6B7A99", fontFamily:"monospace", letterSpacing:2 }}>MARKETING TOOL</span>
          </div>
          <h1 style={{ margin:"0 0 12px", fontSize:38, fontWeight:800,
            background:"linear-gradient(135deg, #FFFFFF 0%, #8892C8 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Subject Line Tester
          </h1>
          <p style={{ margin:0, color:"#4A5575", fontSize:15 }}>
            Score, analyse & rewrite your email subject lines with AI
          </p>
        </div>

        <div style={{ background:"#10131F", border:"1px solid #1E2235", borderRadius:16, padding:24, marginBottom:24 }}>
          <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
            {["Marketing Campaign","Newsletter"].map(t => (
              <button key={t} onClick={() => setEmailType(t)}
                style={{ padding:"7px 18px", borderRadius:20, border:`1px solid ${emailType===t?"#4F6EF7":"#1E2235"}`,
                  background: emailType===t ? "#1A2456" : "transparent",
                  color: emailType===t ? "#7B97FF" : "#4A5575",
                  fontSize:13, cursor:"pointer", fontFamily:"system-ui, sans-serif" }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ position:"relative" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your subject line here…"
              rows={2}
              style={{
                width:"100%", background:"#080A14", border:`1px solid ${input ? "#2A3060" : "#1A1D2E"}`,
                borderRadius:12, padding:"16px 56px 16px 18px",
                color:"#E8ECF8", fontSize:18, fontWeight:500, lineHeight:1.5,
                resize:"none", fontFamily:"system-ui, sans-serif", outline:"none",
                boxSizing:"border-box"
              }} />
            <div style={{ position:"absolute", right:16, bottom:14,
              fontSize:12, color: input.length > 60 ? "#FF5252" : input.length > 45 ? "#FFB74D" : "#3A4060",
              fontFamily:"monospace" }}>
              {input.length}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:12, color:"#2E3450", fontFamily:"monospace" }}>
            <span>Ideal: 30–50 characters · 6–10 words</span>
            <span>{input.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>

        {analysis && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
              <div style={{ background:"#10131F", border:"1px solid #1E2235", borderRadius:16, padding:24, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <div style={{ position:"relative", marginBottom:12 }}>
                  <ScoreRing score={analysis.score} color={analysis.gradeColor} />
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:30, fontWeight:800, color:analysis.gradeColor, lineHeight:1 }}>{analysis.score}</span>
                    <span style={{ fontSize:11, color:"#4A5575", fontFamily:"monospace" }}>/100</span>
                  </div>
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:analysis.gradeColor }}>{analysis.grade}</div>
                <div style={{ fontSize:12, color:"#3A4060", marginTop:4, fontFamily:"monospace" }}>
                  {analysis.chars} chars · {analysis.wordCount} words
                </div>
              </div>
              <div style={{ background:"#10131F", border:"1px solid #1E2235", borderRadius:16, padding:24 }}>
                <div style={{ fontSize:11, color:"#3A4060", fontFamily:"monospace", letterSpacing:2, marginBottom:16 }}>SCORE BREAKDOWN</div>
                <BreakdownBar label="Length" value={analysis.breakdown.length} max={20} color="#4F6EF7" />
                <BreakdownBar label="Spam safety" value={analysis.breakdown.spam} max={20} color="#00E5A0" />
                <BreakdownBar label="Personalisation" value={analysis.breakdown.personalisation} max={15} color="#A78BFA" />
                <BreakdownBar label="Question hook" value={analysis.breakdown.question} max={15} color="#4FC3F7" />
                <BreakdownBar label="Numbers" value={analysis.breakdown.numbers} max={10} color="#FFB74D" />
                <BreakdownBar label="Power words" value={analysis.breakdown.power} max={10} color="#FF7043" />
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
              <div style={{ background:"#10131F", border:"1px solid #1E2235", borderRadius:16, padding:20 }}>
                <div style={{ fontSize:11, color:"#FF5252", fontFamily:"monospace", letterSpacing:2, marginBottom:14 }}>⚠ ISSUES</div>
                {analysis.issues.length === 0
                  ? <div style={{ fontSize:13, color:"#3A4060" }}>No issues detected</div>
                  : analysis.issues.map((iss, i) => (
                    <div key={i} style={{ display:"flex", gap:10, marginBottom:10 }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:"#2A0E0E", border:"1px solid #FF525240", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:10, color:"#FF5252" }}>✕</div>
                      <span style={{ fontSize:13, color:"#8892A4", lineHeight:1.5 }}>{iss}</span>
                    </div>
                  ))
                }
              </div>
              <div style={{ background:"#10131F", border:"1px solid #1E2235", borderRadius:16, padding:20 }}>
                <div style={{ fontSize:11, color:"#00E5A0", fontFamily:"monospace", letterSpacing:2, marginBottom:14 }}>✓ POSITIVES</div>
                {analysis.positives.length === 0
                  ? <div style={{ fontSize:13, color:"#3A4060" }}>Keep improving!</div>
                  : analysis.positives.map((p, i) => (
                    <div key={i} style={{ display:"flex", gap:10, marginBottom:10 }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:"#001A11", border:"1px solid #00E5A040", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:10, color:"#00E5A0" }}>✓</div>
                      <span style={{ fontSize:13, color:"#8892A4", lineHeight:1.5 }}>{p}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {analysis.foundSpam.length > 0 && (
              <div style={{ background:"#1A0A0A", border:"1px solid #FF525230", borderRadius:12, padding:16, marginBottom:24, display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:22 }}>🚨</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#FF5252", marginBottom:4 }}>Spam trigger words detected</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {analysis.foundSpam.map((w,i) => (
                      <span key={i} style={{ padding:"2px 10px", background:"#FF525220", border:"1px solid #FF525240", borderRadius:4, fontSize:12, color:"#FF8A80", fontFamily:"monospace" }}>{w}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!aiResult && (
              <button onClick={() => !formSubmitted ? setShowForm(true) : handleGetSuggestions()}
                style={{
                  width:"100%", padding:"16px", borderRadius:12,
                  background: aiLoading ? "#131525" : "linear-gradient(135deg, #2A3F8F, #4F6EF7)",
                  border: aiLoading ? "1px solid #1E2235" : "none",
                  color: aiLoading ? "#4A5575" : "#fff",
                  fontSize:15, fontWeight:600, cursor: aiLoading ? "default" : "pointer",
                  marginBottom:24,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10
                }}>
                {aiLoading ? "⟳ Generating AI rewrites…" : "✦ Get AI-Powered Rewrites"}
              </button>
            )}
            {aiError && <div style={{ color:"#FF5252", fontSize:13, marginBottom:16, textAlign:"center" }}>{aiError}</div>}

            {aiResult && (
              <div style={{ background:"#10131F", border:"1px solid #2A3060", borderRadius:16, padding:24, marginBottom:24 }}>
                <div style={{ fontSize:11, color:"#4F6EF7", fontFamily:"monospace", letterSpacing:2, marginBottom:6 }}>✦ AI REWRITES</div>
                <div style={{ fontSize:13, color:"#4A5575", marginBottom:20 }}>Claude-generated alternatives for your {emailType.toLowerCase()}</div>
                {aiResult.rewrites?.map((r, i) => (
                  <div key={i} style={{ background:"#0C0E1A", border:"1px solid #1E2235", borderRadius:12, padding:16, marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:600, color:"#D8E0F8", marginBottom:6, lineHeight:1.4 }}>"{r.subject}"</div>
                        <div style={{ fontSize:12, color:"#4A5575" }}>{r.why}</div>
                        <div style={{ fontSize:11, color: r.subject.length > 60 ? "#FF5252" : r.subject.length > 45 ? "#FFB74D" : "#00E5A0", marginTop:6, fontFamily:"monospace" }}>
                          {r.subject.length} chars
                        </div>
                      </div>
                      <button onClick={() => copyText(r.subject, i)}
                        style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #1E2235", background: copied===i ? "#001A11" : "#131525",
                          color: copied===i ? "#00E5A0" : "#4A5575", fontSize:12, cursor:"pointer",
                          whiteSpace:"nowrap", fontFamily:"monospace" }}>
                        {copied===i ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
                {aiResult.topTip && (
                  <div style={{ background:"#0A0D1A", border:"1px solid #2A3060", borderRadius:10, padding:14, marginTop:8, display:"flex", gap:12 }}>
                    <span style={{ fontSize:16 }}>💡</span>
                    <div style={{ fontSize:13, color:"#6B7A99", lineHeight:1.6 }}>{aiResult.topTip}</div>
                  </div>
                )}
                <button onClick={() => setAiResult(null)}
                  style={{ marginTop:16, padding:"8px 16px", borderRadius:8, border:"1px solid #1E2235", background:"transparent",
                    color:"#3A4060", fontSize:12, cursor:"pointer", fontFamily:"monospace" }}>
                  ↻ Regenerate
                </button>
              </div>
            )}
          </>
        )}
        {showForm && (
  <div style={{
    position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
    display:"flex", alignItems:"center", justifyContent:"center",
    zIndex:1000, padding:20
  }}>
    <div style={{
      background:"#10131F", border:"1px solid #2A3060",
      borderRadius:20, padding:36, width:"100%", maxWidth:460
    }}>
      <div style={{ fontSize:11, color:"#4F6EF7", fontFamily:"monospace", letterSpacing:2, marginBottom:8 }}>ONE LAST STEP</div>
      <h2 style={{ margin:"0 0 8px", fontSize:24, fontWeight:700, color:"#fff" }}>Get Your AI Rewrites</h2>
      <p style={{ margin:"0 0 24px", fontSize:14, color:"#4A5575" }}>Enter your details to unlock Claude-powered suggestions</p>

      {[
        { label:"Full Name *", key:"name", placeholder:"Sugavanesh M", type:"text" },
        { label:"Work Email *", key:"email", placeholder:"sugi@company.com", type:"email" },
        { label:"Phone Number", key:"phone", placeholder:"+91 98765 43210", type:"tel" },
        { label:"Job Role", key:"jobRole", placeholder:"Marketing Manager", type:"text" }
      ].map(field => (
        <div key={field.key} style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, color:"#6B7A99", marginBottom:6, fontFamily:"monospace" }}>{field.label}</label>
          <input
            type={field.type}
            placeholder={field.placeholder}
            value={formData[field.key]}
            onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            style={{
              width:"100%", background:"#080A14", border:"1px solid #2A3060",
              borderRadius:10, padding:"12px 16px", color:"#E8ECF8",
              fontSize:14, fontFamily:"system-ui, sans-serif", outline:"none",
              boxSizing:"border-box"
            }}
          />
        </div>
      ))}
      <div style={{ display:"flex", gap:12, marginTop:24 }}>
        <button onClick={() => setShowForm(false)}
          style={{ flex:1, padding:"12px", borderRadius:10, border:"1px solid #2A3060",
            background:"transparent", color:"#4A5575", fontSize:14, cursor:"pointer" }}>
          Cancel
        </button>
        <button onClick={handleFormSubmit} disabled={formLoading || !formData.name || !formData.email}
          style={{ flex:2, padding:"12px", borderRadius:10, border:"none",
            background: formLoading || !formData.name || !formData.email ? "#1A2456" : "linear-gradient(135deg, #2A3F8F, #4F6EF7)",
            color: formLoading || !formData.name || !formData.email ? "#4A5575" : "#fff",
            fontSize:14, fontWeight:600, cursor: formLoading ? "default" : "pointer" }}>
          {formLoading ? "Saving..." : "Unlock AI Rewrites →"}
        </button>
      </div>
      <p style={{ margin:"16px 0 0", fontSize:11, color:"#2A3060", textAlign:"center" }}>
        🔒 Your details are stored securely. No spam, ever.
      </p>
    </div>
  </div>
)}
      {!input && (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#1E2235" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✉</div>
            <div style={{ fontSize:14, fontFamily:"monospace" }}>Start typing to see your score</div>
          </div>
        )}
      </div>
    </div>
  );
}