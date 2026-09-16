import { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setInfo("");
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || email.split("@")[0] } },
        });
        if (signUpError) throw signUpError;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="dt-panel" style={{ width: 380, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: "var(--accent)" }}>
          <Lock size={18} />
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Private table</span>
        </div>
        <h1 className="dt-brand" style={{ fontSize: 26, margin: "4px 0 18px" }}>Barnky Deck</h1>

        {mode === "signup" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Your name</label>
            <input className="dt-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown next to cards you add" />
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Email</label>
          <input className="dt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Password</label>
          <input
            className="dt-input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
          />
        </div>

        {error && <p style={{ color: "#E9A79B", fontSize: 13, marginTop: 10 }}>{error}</p>}
        {info && <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 10 }}>{info}</p>}

        <button type="button" className="dt-btn dt-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={busy} onClick={submit}>
          {busy ? "One sec…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <p style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginTop: 14 }}>
          {mode === "signup" ? "Already have an account?" : "New to this table?"}{" "}
          <span
            style={{ color: "var(--accent)", cursor: "pointer" }}
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setInfo(""); }}
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </span>
        </p>
      </div>
    </div>
  );
}
