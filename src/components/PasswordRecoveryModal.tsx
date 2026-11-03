import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, KeyRound, Mail } from "lucide-react";
import { recoveryService } from "../services/recovery";
import { ErrorNotice, Modal, Spinner } from "./ui";

type Step = "email" | "code" | "complete";

export function PasswordRecoveryModal({ onClose, onBack }: {
  onClose: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await recoveryService.requestCode(email.trim().toLowerCase());
      setStep("code");
      setNotice("If this email is registered, a recovery code has been sent. Check your inbox and spam folder.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === "email") {
      await sendCode();
    } else if (step === "code") {
      if (password !== repeat) {
        setError("The two passwords do not match.");
        return;
      }
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await recoveryService.changePassword(email.trim().toLowerCase(), code.trim(), password);
        setStep("complete");
        setCode("");
        setPassword("");
        setRepeat("");
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <Modal title="Reset your password" onClose={onClose}>
      <form className="form-body auth-recovery" onSubmit={(event) => void submit(event)}>
        <div className="form-intro">
          <span className="round-icon">{step === "complete" ? <CheckCircle2 size={23} /> : <KeyRound size={23} />}</span>
          <h3>{step === "complete" ? "A fresh password. Same old potholes." : "Forgot the password? It happens."}</h3>
          <p>{step === "email"
            ? "Enter your account email. We'll send a one-time code so you can choose a new password."
            : step === "code"
              ? "Enter the code from your email and choose a new password."
              : "Your password has been changed. Sign in with your new password to continue."}</p>
        </div>
        {step !== "complete" && (
          <>
            <label>
              Account email
              <input type="email" autoComplete="email" required maxLength={254}
                disabled={busy || step === "code"}
                value={email} onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"/>
            </label>
            {step === "code" && (
              <>
                <label>
                  Recovery code
                  <input type="text" inputMode="numeric" pattern="[0-9]{6,8}"
                    autoComplete="one-time-code" required minLength={6} maxLength={8}
                    value={code} onChange={(event) => setCode(event.target.value)}
                    placeholder="6-digit code" />
                </label>
                <label>
                  New password
                  <input type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                    value={password} onChange={(event) => setPassword(event.target.value)}/>
                </label>
                <label>
                  Confirm new password
                  <input type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                    value={repeat} onChange={(event) => setRepeat(event.target.value)}/>
                </label>
              </>
            )}
          </>
        )}
        {notice && <p role="status" className="info-note"><Mail size={17}/>{notice}</p>}
        <ErrorNotice message={error}/>
        {step === "complete" ? (
          <button type="button" className="button primary full" onClick={onBack}>
            Return to sign in <ArrowRight size={17}/>
          </button>
        ) : (
          <button type="submit" className="button primary full" disabled={busy}>
            {busy ? <Spinner/> : step === "email" ? <>Email recovery code <ArrowRight size={17}/></>
              : <>Change password <ArrowRight size={17}/></>}
          </button>
        )}
        {step === "code" && (
          <div className="auth-recovery-actions">
            <button type="button" className="button" disabled={busy}
              onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}>
              Change email
            </button>
            <button type="button" className="button" disabled={busy}
              onClick={() => void sendCode()}>Resend code</button>
          </div>
        )}
        <button type="button" className="button full" disabled={busy} onClick={onBack}>
          <ChevronLeft size={16}/> Back to sign in
        </button>
        <p className="fine-print">For security, a recovery code expires and can only be used once. You do not need to confirm your email to sign up.</p>
      </form>
    </Modal>
  );
}
