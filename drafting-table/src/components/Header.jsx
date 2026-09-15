import { Layers, Library, LogOut } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function Header({ tab, setTab, profileName }) {
  return (
    <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <h1 className="dt-brand" style={{ fontSize: 20, margin: 0 }}>The Drafting Table</h1>
        <nav style={{ display: "flex", gap: 20 }}>
          <div className={`dt-tab ${tab === "pool" ? "active" : ""}`} onClick={() => setTab("pool")}>
            <Layers size={15} />Card pool
          </div>
          <div className={`dt-tab ${tab === "decks" ? "active" : ""}`} onClick={() => setTab("decks")}>
            <Library size={15} />Decks &amp; cubes
          </div>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="dt-chip">{profileName}</span>
        <button type="button" className="dt-btn dt-btn-icon" title="Sign out" onClick={() => supabase.auth.signOut()}>
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
