"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import fixture from "@fixtures/report.json";
import type { Session } from "./ConnectedInterview";
import { MicrophoneCapture } from "./MicrophoneCapture";

interface Props {
  session: Session | null;
  busy: boolean;
  error: string;
  notice: string;
  consent: boolean;
  draft: string;
  original: string | null;
  evidenceUrl: string;
  evidenceMode: "fixture" | "live";
  setConsent: (value: boolean) => void;
  setDraft: (value: string) => void;
  setOriginal: (value: string) => void;
  setNotice: (value: string) => void;
  setEvidenceUrl: (value: string) => void;
  setEvidenceMode: (value: "fixture" | "live") => void;
  start: (mode: "live" | "offline") => Promise<void>;
  submit: () => Promise<void>;
  attach: () => Promise<void>;
  reset: () => Promise<void>;
  transcribe: (blob: Blob) => Promise<void>;
  useExample: () => void;
}

function CameraPreview() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  async function toggle() {
    if (enabled) {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
      setEnabled(false);
      return;
    }
    setBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!active.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      setEnabled(true); setMessage("");
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      setMessage("Optional self-view unavailable. You can continue the complete interview without camera access.");
    } finally { if (active.current) setBusy(false); }
  }
  return <section className="optional-camera" aria-label="Optional camera self-view">
    <div className={enabled ? "camera-preview" : "camera-preview is-off"}>
      <video ref={video} muted playsInline hidden={!enabled} />
      {!enabled && <div className="camera-off-visual"><strong>Camera off</strong><span>Optional familiar self-view</span></div>}
      <div className="preview-label">{enabled ? "On-device self-view" : "Off by default"}</div>
      <div className="preview-shield">{enabled ? "Never recorded, uploaded, analyzed, or shared" : "No camera permission requested"}</div>
    </div>
    <button type="button" className="text-action" disabled={busy} onClick={toggle}>{enabled ? "Turn off optional self-view" : "Enable optional self-view"}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}

export function SageInterviewView(props: Props) {
  const { session, busy, error, notice, consent, draft, original } = props;
  const question = session?.question;
  const claim = session?.claims.find(item => item.id === question?.claim_id);
  const claimIndex = session?.claims.findIndex(item => item.id === claim?.id) ?? 0;
  const progress = session?.report ? 100 : Math.round(claimIndex / 3 * 100);
  return <div className="app-frame sage-app integrated-sage">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {(!session || !question) && <header className="sage-header">
      <Link className="brand" href="/candidate"><span className="brand-mark">CP</span>ClaimProof</Link>
      <nav className="sage-header-meta" aria-label="Session navigation">
        <Link href="/recruiter">Recruiter view</Link>
        {session && <><Link href={`/traces/${session.id}?source=${session.mode}`}>Session trace</Link><button className="text-action" disabled={busy} onClick={props.reset}>Reset demo</button></>}
      </nav>
    </header>}
    {error && <p role="alert" className="integration-alert">{error}</p>}
    {notice && <p role="status" className="integration-notice">{notice}</p>}
    {busy && <p role="status" className="integration-notice">Saving or loading…</p>}
    {!session ? <main className="welcome-shell" id="main-content">
      <section className="welcome-copy">
        <div className="welcome-person"><span>Your demo application</span><strong>Machine Learning Engineer</strong><small>Three claims · one focused conversation</small></div>
        <p className="step-label">Your interview is ready</p>
        <h1>Meet Sage.</h1>
        <p className="welcome-lede">This is your opportunity to bring the work behind your application to life and add the context a resume cannot capture.</p>
        <section className="why-sage" aria-labelledby="why-sage-title">
          <span>Why Sage</span><h2 id="why-sage-title">A consistent chance to be heard.</h2>
          <p>Every candidate gets dedicated time to explain their work in their own words. Sage asks relevant follow-ups, then gives the recruiter a reviewable transcript. Sage does not make the hiring decision.</p>
        </section>
        <section className="conversation-roadmap" aria-labelledby="roadmap-title">
          <div className="roadmap-heading"><div><span>Conversation preview</span><h2 id="roadmap-title">What Sage may explore</h2></div><p>There are no surprise topics. Sage may ask a short adaptive follow-up when your answer opens a useful thread.</p></div>
          <ol>{[
            ["Your story", "Who you are and what motivates you"],
            ["Relevant work", "Projects and experience connected to this role"],
            ["Your contribution", "What you personally owned"],
            ["Outcomes", "Measured results and supporting evidence"],
            ["Your judgment", "Decisions, trade-offs, and lessons"],
            ["Anything else", "A final chance to add helpful context"],
          ].map(([title, description], index) => <li key={title}><span>0{index + 1}</span><p><strong>{title}</strong>{description}</p></li>)}</ol>
        </section>
      </section>
      <aside className="welcome-side">
        <div className="sage-intro-card"><div className="sage-orb" aria-hidden="true"><i /><i /><span>S</span></div><div><span>Your interviewer</span><h2>Sage</h2><p>Curious about the details behind your work.</p></div></div>
        <div className="topic-preview"><span>Topics from your experience · fictional demo</span>{fixture.claims.map((item, index) => <div key={item.id}><b>0{index + 1}</b><p>{item.source_excerpt}<small>From the seeded resume</small></p></div>)}</div>
        <label className="interview-consent"><input type="checkbox" checked={consent} onChange={e => props.setConsent(e.target.checked)} /><span><strong>I understand how the demo records and transcribes my answers.</strong><small>Connected answers are saved to the local backend; offline answers stay in this browser. Camera is off by default and any optional self-view stays on-device, is never recorded, and is not included in the recruiter report.</small></span></label>
        <div className="welcome-actions"><button className="button button-primary" disabled={busy || !consent} onClick={() => props.start("live")}>Start connected demo</button><button className="button button-light" disabled={busy || !consent} onClick={() => props.start("offline")}>Start offline rehearsal</button></div>
      </aside>
    </main> : question ? <main className="sage-workspace" id="main-content">
      <aside className="sage-panel" aria-label="Sage, your interview guide">
        <div className="sage-large-orb" aria-hidden="true"><i /><i /><i /><span>S</span></div><span className="sage-name">Sage</span><p>Your ClaimProof interviewer</p>
        <div className="sage-state"><i />Here with you</div>
        <div className="sage-progress"><div><span>Claim progress</span><strong>{claimIndex + 1} of 3</strong></div><div><i style={{ width: `${progress}%` }} /></div></div>
        <p className="sage-assurance">Sage responds to answer content only. No visual, vocal, or behavioral signals are assessed.</p>
      </aside>
      <section className="interview-conversation">
        <header className="interview-topbar"><div><span>{session.mode === "live" ? "Connected session" : "Offline rehearsal · simulated flow"}</span><strong>Machine Learning Engineer</strong></div><div><span>Claim</span><strong>{claimIndex + 1} of 3</strong></div></header>
        <div className="sage-history" aria-label="Conversation transcript">{session.answers.map(answer => {
          const asked = session.questions.find(item => item.id === answer.question_id);
          return <article key={answer.id}><div className="history-speaker sage"><span>S</span><p><strong>Sage</strong>{asked?.text}</p></div><div className="history-speaker candidate"><span>You</span><p><strong>You</strong>{answer.transcript}</p></div></article>;
        })}</div>
        <article className="sage-question-card">
          <div className="question-eyebrow"><span>{question.kind === "follow_up" ? "Adaptive follow-up" : "Opening question"}</span><i /></div>
          <div className="claim-link"><span>From your application</span><strong>“{claim?.source_excerpt}”</strong><small>Resume · {claim?.category}</small></div>
          <div className="sage-asks"><span>Sage asks</span><h1>{question.text}</h1><p><strong>Why this question:</strong> {question.intent}</p></div>
          {original === null ? <>
            <MicrophoneCapture key={question.id} transcript={draft} onTranscript={props.setDraft} onFallbackToText={props.setNotice} onAudio={session.mode === "live" ? props.transcribe : undefined} disabled={busy} />
            <div className="sage-answer-field"><label htmlFor="candidate-answer">Your answer</label><textarea id="candidate-answer" rows={5} value={draft} disabled={busy} onChange={e => props.setDraft(e.target.value)} /></div>
            <div className="answer-actions"><button className="button button-primary" disabled={busy || !draft.trim()} onClick={() => props.setOriginal(draft)}>Review answer</button><button className="text-action" disabled={busy} onClick={props.useExample}>Use example answer</button></div>
          </> : <><p className="original-transcript">Original transcript: {original}</p><div className="sage-answer-field"><label htmlFor="reviewed-answer">Correct transcript before submitting</label><textarea id="reviewed-answer" rows={5} disabled={busy} value={draft} onChange={e => props.setDraft(e.target.value)} /></div><button className="button button-primary" disabled={busy || !draft.trim()} onClick={props.submit}>Submit reviewed answer</button></>}
        </article>
        <section className="sage-evidence"><h2>Supporting evidence for the RAG claim</h2><p>The controlled artifact is fictional. Live retrieval requires an approved public host.</p><a href="/demo-artifact" target="_blank">Inspect synthetic artifact</a><div className="evidence-controls"><select aria-label="Evidence mode" value={props.evidenceMode} onChange={e => props.setEvidenceMode(e.target.value as "fixture" | "live")}><option value="fixture">Synthetic fixture</option><option value="live">Live public page</option></select><input aria-label="Evidence URL" value={props.evidenceUrl} onChange={e => props.setEvidenceUrl(e.target.value)} /><button className="button button-dark" disabled={busy} onClick={props.attach}>Attach evidence</button></div>{session.evidence.map(item => <p key={item.id}>{item.source_label}: {item.limitations}</p>)}</section>
      </section>
      <aside className="candidate-rail"><CameraPreview /><div className="candidate-card"><span>Candidate application</span><strong>Machine Learning Engineer</strong><small>Fictional demo · three claims</small></div><details className="source-claims"><summary>Review all three source claims</summary>{session.claims.map(item => <blockquote key={item.id}>{item.source_excerpt}</blockquote>)}</details><div className="session-guardrails"><span>Session guardrails</span><p>Camera is off by default</p><p>Optional self-view stays on-device</p><p>No behavioral analysis or hiring decision</p></div></aside>
    </main> : <main className="thank-you-shell" id="main-content">
      <section className="thank-you-hero"><p className="step-label">Conversation complete</p><h1>Conversation complete</h1><p>Thank you for sharing the work behind your application. Your answers and supporting evidence are ready for review.</p></section>
      <section className="handoff-card"><div className="handoff-heading"><div><p className="step-label">Transparent handoff</p><h2>What the recruiter receives</h2></div><span>{session.answers.length} answers · 3 claims</span></div><div className="handoff-grid"><div><span>Included</span><ul><li>Application claims and their sources</li><li>Questions and reviewed answer transcripts</li><li>Evidence, limitations, and unresolved questions</li></ul></div><div><span>Never included</span><ul><li>Camera preview or images</li><li>Facial, vocal, or behavioral analysis</li><li>An honesty or hiring score</li></ul></div></div></section>
      <section className="thank-you-footer"><p>{session.mode === "live" ? "Your report is saved to the local backend." : "Offline rehearsal: your answers are saved in this browser and remain unassessed."}</p><Link className="button button-primary" href={session.mode === "live" ? `/recruiter/${session.candidate}?source=live&session=${session.id}` : `/recruiter/offline?session=${session.id}`}>Open evidence report</Link></section>
    </main>}
  </div>;
}
