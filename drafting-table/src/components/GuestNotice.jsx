import { Globe } from "lucide-react";
import Modal from "./Modal";

const MESSAGES = {
  save: "Saving cards needs an account. Anything you've entered here stays in this form, so you can sign in and then save it.",
  delete: "Removing cards from the pool needs an account.",
  import: "Importing from Hellfall or Reddit needs an account. You can still upload or paste an image and fill in the card by hand.",
  deck: "Go ahead and build, but decks made here aren't saved. They disappear when you refresh or close the page. Make an account to keep them.",
};

// Shown whenever a signed-out visitor hits something that would write to the
// shared pool or decks.
export default function GuestNotice({ reason, onClose, onSignIn, onSignUp }) {
  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)" }}>
          <Globe size={18} />
          <h2 className="dt-brand" style={{ fontSize: 19, margin: 0, color: "var(--text)" }}>You're on the public site</h2>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: "var(--text-dim)" }}>
          {MESSAGES[reason] || MESSAGES.save}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <button type="button" className="dt-btn" onClick={onClose}>Keep browsing</button>
          <button type="button" className="dt-btn" onClick={onSignIn}>Sign in</button>
          <button type="button" className="dt-btn dt-btn-primary" onClick={onSignUp}>Create an account</button>
        </div>
      </div>
    </Modal>
  );
}
