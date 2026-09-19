"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { interviewReducer, initialInterviewState, type InterviewState } from "./interview-machine";
import { VoiceAnswerCapture } from "./VoiceAnswerCapture";
import { classifyDeviceError, requestInterviewDevices } from "./media";

const STORAGE_KEY = "claimproof-sage-interview-v2";

function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOfflineStatus() {
  return useSyncExternalStore(subscribeToConnectivity, () => !navigator.onLine, () => false);
}

function Icon({ name }: { name: "arrow" | "camera" | "check" | "lock" | "mic" | "reset" }) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    camera: <><path d="M3 7h13v11H3z" /><path d="m16 10 5-3v11l-5-3z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><path d="M6 10h12v10H6z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    reset: <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8m0-5v5h5" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>;
}

function formatElapsed(startedAt: number | null, now: number) {
  if (!startedAt || !now) return "0:00";
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Header({ offline }: { offline: boolean }) {
  return (
    <>
      <header className="sage-header">
        <a className="brand" href="/candidate"><span className="brand-mark" aria-hidden="true">CP</span><span>ClaimProof</span></a>
        <div className="sage-header-meta"><span>Candidate interview</span><a href="mailto:help@claimproof.example">Need help?</a></div>
      </header>
      {offline ? <div className="offline-banner" role="status">Offline mode is active. The complete demo interview remains available.</div> : null}
    </>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <p className="step-label">{children}</p>;
}

function Onboarding({ state, dispatch }: { state: InterviewState; dispatch: React.Dispatch<Parameters<typeof interviewReducer>[1]> }) {
  return (
    <main className="welcome-shell" id="main-content">
      <section className="welcome-copy">
        <div className="welcome-person"><span>Prepared for</span><strong>{state.application.candidateName}</strong><small>{state.application.roleTitle}</small></div>
        <StepLabel>Your interview is ready</StepLabel>
        <h1>Hi Maya, meet Sage.</h1>
        <p className="welcome-lede">This is your opportunity to bring the work behind your application to life. Sage will help you share the decisions, context, and impact that a resume cannot capture in 15 to 20 minutes.</p>
        <section className="why-sage" aria-labelledby="why-sage-title">
          <span>Why Sage</span>
          <h2 id="why-sage-title">A consistent chance to be heard.</h2>
          <p>Every candidate gets dedicated time to explain their work in their own words. Sage asks relevant follow-ups, then gives the recruiter a reviewable transcript. Sage does not make the hiring decision.</p>
        </section>
        <section className="conversation-roadmap" aria-labelledby="conversation-roadmap-title">
          <div className="roadmap-heading"><div><span>Conversation preview</span><h2 id="conversation-roadmap-title">What Sage may explore</h2></div><p>There are no surprise topics. Sage may ask a short adaptive follow-up when your answer opens a useful thread.</p></div>
          <ol>
            <li><span>01</span><p><strong>Your story</strong>Who you are and what motivates you</p></li>
            <li><span>02</span><p><strong>Relevant work</strong>Experience and projects connected to this role</p></li>
            <li><span>03</span><p><strong>Your contribution</strong>What you personally owned</p></li>
            <li><span>04</span><p><strong>Outcomes</strong>Measured results and impact</p></li>
            <li><span>05</span><p><strong>Your judgment</strong>Decisions, trade-offs, and lessons</p></li>
            <li><span>06</span><p><strong>Anything else</strong>A final chance to add helpful context</p></li>
          </ol>
        </section>
      </section>
      <aside className="welcome-side">
        <div className="sage-intro-card">
          <div className="sage-orb" aria-hidden="true"><i /><i /><span>S</span></div>
          <div><span>Your interviewer</span><h2>Sage</h2><p>Warm, focused, and curious about the details behind your work.</p></div>
        </div>
        <div className="topic-preview">
          <span>Topics from your experience</span>
          {state.application.claims.map((claim, index) => (
            <div key={claim.id}><b>0{index + 1}</b><p>{claim.text}<small>{claim.source.document} · {claim.source.section}</small></p></div>
          ))}
        </div>
        <label className="interview-consent">
          <input type="checkbox" checked={state.consentAccepted} onChange={(event) => dispatch({ type: "SET_CONSENT", accepted: event.target.checked })} />
          <span><strong>I understand and agree to microphone recording and transcription for this voice interview.</strong><small>Camera is not required. Any optional self-view is chosen separately on the next step.</small></span>
        </label>
        <button className="button button-primary welcome-continue" type="button" disabled={!state.consentAccepted} onClick={() => dispatch({ type: "OPEN_PERMISSIONS" })}>Set up microphone <Icon name="arrow" /></button>
        <p className="help-copy">Need an accommodation? <a href="mailto:help@claimproof.example">Contact a person before starting.</a></p>
      </aside>
    </main>
  );
}

function CameraPreview({ stream, demo, enabled, label = "Optional camera self-view" }: { stream: MediaStream | null; demo: boolean; enabled: boolean; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream && enabled) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [enabled, stream]);

  const className = !enabled ? "camera-preview is-off" : demo ? "camera-preview is-demo" : "camera-preview";
  return (
    <div className={className} aria-label={label}>
      {!enabled ? (
        <div className="camera-off-visual"><Icon name="camera" /><strong>Camera off</strong><span>Optional familiar self-view</span></div>
      ) : stream ? (
        <video ref={videoRef} muted playsInline />
      ) : (
        <div className="demo-face" aria-hidden="true"><span>MC</span></div>
      )}
      <div className="preview-label"><i />{!enabled ? "Off by default" : demo ? "Demo self-view" : "On-device self-view"}</div>
      <div className="preview-shield"><Icon name="lock" /> {!enabled ? "No camera permission requested" : "Never recorded, uploaded, or analyzed"}</div>
    </div>
  );
}

function Permissions({
  state,
  dispatch,
  stream,
  checking,
  onRequest,
}: {
  state: InterviewState;
  dispatch: React.Dispatch<Parameters<typeof interviewReducer>[1]>;
  stream: MediaStream | null;
  checking: boolean;
  onRequest: () => void;
}) {
  const ready = Boolean(state.permissionMode);
  return (
    <main className="permission-shell" id="main-content">
      <section className="permission-copy">
        <StepLabel>Device setup · one-time permission</StepLabel>
        <h1>Let’s make sure we can hear you.</h1>
        <p>Your browser will ask for microphone access so Sage can transcribe your answers. Camera stays off unless you explicitly choose the optional self-view below.</p>
        <div className="permission-ledger">
          <div><span><Icon name="mic" /></span><p><strong>Microphone</strong>Required for voice answers and the recruiter-reviewable transcript.</p><b className={ready ? "ready" : ""}>{ready ? "Ready" : "Required"}</b></div>
          <label className="camera-choice"><input type="checkbox" checked={state.cameraOptIn} disabled={ready} onChange={(event) => dispatch({ type: "SET_CAMERA_OPT_IN", enabled: event.target.checked })} /><span><Icon name="camera" /></span><p><strong>Optional camera self-view</strong>A familiar view of yourself during the interview. The stream stays on-device and is never recorded, uploaded, analyzed, or included in the recruiter report.</p><b className={state.cameraOptIn ? "ready" : ""}>{state.cameraOptIn ? "Opted in" : "Off by default"}</b></label>
        </div>
        <div className="privacy-promise"><Icon name="lock" /><p><strong>No biometric or behavioral analysis.</strong> ClaimProof does not analyze your face, voice, accent, tone, emotion, timing, eye contact, or environment.</p></div>
        {state.permissionMessage ? <p className={ready ? "device-message ready" : "device-message"} role="status">{state.permissionMessage}</p> : null}
        <div className="permission-actions">
          {!ready ? <button className="button button-primary" type="button" disabled={checking} onClick={onRequest}>{checking ? "Waiting for browser..." : state.cameraOptIn ? "Allow microphone and camera" : "Allow microphone"}</button> : null}
          {!ready ? <button className="button button-light" type="button" onClick={() => dispatch({ type: "USE_DEMO_DEVICES" })}>Use demo microphone</button> : null}
          {ready ? <button className="button button-primary" type="button" onClick={() => dispatch({ type: "START_INTERVIEW", now: Date.now() })}>Start interview with Sage <Icon name="arrow" /></button> : null}
        </div>
        {!ready ? <p className="demo-explanation">Demo mode provides deterministic voice capture when browser or microphone access is unavailable. Camera remains optional.</p> : null}
      </section>
      <aside className="permission-preview">
        <CameraPreview stream={stream} demo={state.permissionMode === "demo"} enabled={state.cameraOptIn} />
        <h2>{state.cameraOptIn ? ready ? "Your self-view is ready." : "Optional self-view selected." : "Camera is off."}</h2>
        <p>{state.cameraOptIn ? "This familiar self-view stays on your device and never enters the interview record." : "You can complete the entire polished voice interview without camera access."}</p>
      </aside>
    </main>
  );
}

function SagePanel({ speaking, progress }: { speaking: boolean; progress: number }) {
  return (
    <aside className="sage-panel" aria-label="Sage, your interview guide">
      <div className={speaking ? "sage-large-orb is-speaking" : "sage-large-orb"} aria-hidden="true"><i /><i /><i /><span>S</span></div>
      <span className="sage-name">Sage</span>
      <p>Your ClaimProof interviewer</p>
      <div className="sage-state"><i /> {speaking ? "Listening" : "Here with you"}</div>
      <div className="sage-progress"><div><span>Interview progress</span><strong>{progress}%</strong></div><div><i style={{ width: `${progress}%` }} /></div></div>
      <p className="sage-assurance"><Icon name="lock" /> Sage responds to answer content only. No visual, vocal, or behavioral signals are assessed.</p>
    </aside>
  );
}

function ConversationHistory({ state }: { state: InterviewState }) {
  return (
    <div className="sage-history" aria-label="Conversation transcript">
      {state.answers.map((answer) => {
        const question = state.questions.find((item) => item.id === answer.questionId);
        if (!question) return null;
        return (
          <article key={answer.id}>
            <div className="history-speaker sage"><span>S</span><p><strong>Sage</strong>{question.prompt}</p></div>
            <div className="history-speaker candidate"><span>MC</span><p><strong>You</strong>{answer.originalTranscript}</p></div>
          </article>
        );
      })}
    </div>
  );
}

function InterviewWorkspace({ state, dispatch, stream, now, offline }: { state: InterviewState; dispatch: React.Dispatch<Parameters<typeof interviewReducer>[1]>; stream: MediaStream | null; now: number; offline: boolean }) {
  const active = state.questions[state.activeQuestionIndex];
  const claim = state.application.claims.find((item) => item.id === active.claimId)!;
  const progress = Math.round((state.answers.length / state.questions.length) * 100);
  const demo = state.permissionMode === "demo";

  return (
    <main className="sage-workspace" id="main-content">
      <SagePanel speaking progress={progress} />
      <section className="interview-conversation">
        <header className="interview-topbar">
          <div><span>{offline ? "Offline-ready interview" : "Live interview"}</span><strong>{state.application.roleTitle}</strong></div>
          <div><span>Elapsed</span><strong>{formatElapsed(state.startedAt, now)}</strong></div>
          <div><span>Question</span><strong>{state.activeQuestionIndex + 1} of {state.questions.length}</strong></div>
        </header>
        <ConversationHistory state={state} />
        <article className="sage-question-card" aria-labelledby="sage-question">
          <div className="question-eyebrow"><span>{active.kind === "follow_up" ? "Adaptive follow-up" : `Claim area ${Math.min(state.activeQuestionIndex + 1, 3)}`}</span><i /></div>
          <div className="claim-link"><span>From your application</span><strong>“{claim.text}”</strong><small>{claim.source.document} · {claim.source.section}</small></div>
          <div className="sage-asks"><span>Sage asks</span><h1 id="sage-question">{active.prompt}</h1><p><strong>Why this question:</strong> {active.why}</p></div>
          <VoiceAnswerCapture key={active.id} questionId={active.id} stream={stream} demoMode={demo} onSubmit={(transcript) => dispatch({ type: "ANSWER_RECORDED", transcript })} />
        </article>
      </section>
      <aside className="candidate-rail">
        <CameraPreview stream={stream} demo={demo} enabled={state.cameraOptIn} />
        <div className="candidate-card"><span>Candidate</span><strong>{state.application.candidateName}</strong><small>{state.application.roleTitle}</small></div>
        <div className="session-guardrails"><span>Session guardrails</span><p><i /> {state.cameraOptIn ? "Optional self-view stays on-device" : "Camera is off"}</p><p><i /> Voice content only</p><p><i /> No behavioral analysis</p></div>
        <a href="mailto:help@claimproof.example" className="rail-help">Need help or an accommodation?</a>
      </aside>
    </main>
  );
}

function Completion({ state, onReset }: { state: InterviewState; onReset: () => void }) {
  const report = {
    candidate: { name: state.application.candidateName, role: state.application.roleTitle },
    interview: {
      format: "voice",
      questionsAnswered: state.answers.length,
      optionalCameraSelfViewUsed: state.cameraOptIn,
      cameraIncluded: false,
      behavioralSignalsIncluded: false,
    },
    evidence: state.answers.map((answer) => {
      const question = state.questions.find((item) => item.id === answer.questionId)!;
      const claim = state.application.claims.find((item) => item.id === answer.claimId)!;
      return {
        claim: claim.text,
        source: `${claim.source.document} · ${claim.source.section}`,
        question: question.prompt,
        questionType: question.kind,
        transcript: answer.originalTranscript,
      };
    }),
  };

  return (
    <main className="thank-you-shell" id="main-content">
      <section className="thank-you-hero">
        <div className="completion-mark"><Icon name="check" /></div>
        <StepLabel>Interview complete</StepLabel>
        <h1>Thank you, Maya.</h1>
        <p>Your conversation with Sage is complete. ClaimProof will hand the recruiter a source-linked record of what was discussed, not a score or a behavioral judgment.</p>
      </section>
      <section className="handoff-card">
        <div className="handoff-heading"><div><StepLabel>Transparent data handoff</StepLabel><h2>Exactly what the recruiter receives</h2></div><span>{state.answers.length} answers · 3 claim areas</span></div>
        <div className="handoff-grid">
          <div><span>Included</span><ul><li><Icon name="check" /> Application claim and source</li><li><Icon name="check" /> Sage’s questions and follow-up lineage</li><li><Icon name="check" /> Voice answer transcripts</li></ul></div>
          <div><span>Never included</span><ul><li><b>×</b> Camera preview or images</li><li><b>×</b> Facial, vocal, emotion, or behavior analysis</li><li><b>×</b> Honesty, competence, or hiring score</li></ul></div>
        </div>
        <div className="handoff-entries">
          {report.evidence.map((entry, index) => <div key={`${entry.questionType}-${index}`}><span>0{index + 1}</span><p><strong>{entry.claim}</strong><small>{entry.questionType === "follow_up" ? "Adaptive follow-up included" : entry.source}</small></p></div>)}
        </div>
        <details className="payload-details"><summary>View recruiter report payload</summary><pre>{JSON.stringify(report, null, 2)}</pre></details>
      </section>
      <section className="thank-you-footer"><div><h2>You’re all set.</h2><p>You can close this window. This demo stores the session only in this browser.</p></div><button type="button" className="button button-dark" onClick={onReset}><Icon name="reset" /> Reset demo interview</button></section>
    </main>
  );
}

export function CandidateExperience() {
  const [state, dispatch] = useReducer(interviewReducer, initialInterviewState);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(0);
  const offline = useOfflineStatus();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as InterviewState;
      window.setTimeout(() => dispatch({ type: "RESTORE", state: parsed }), 0);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.phase, state.activeQuestionIndex]);

  useEffect(() => {
    if (state.phase !== "interview") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "complete") {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }, [state.phase, stream]);

  useEffect(
    () => () => stream?.getTracks().forEach((track) => track.stop()),
    [stream],
  );

  const requestDevices = async () => {
    setChecking(true);
    try {
      const media = await requestInterviewDevices(state.cameraOptIn);
      setStream(media);
      dispatch({ type: "PERMISSIONS_GRANTED" });
    } catch (error) {
      const denied = classifyDeviceError(error) === "denied";
      dispatch({ type: "PERMISSIONS_FAILED", message: denied ? "Browser access was declined. You can try again or use deterministic demo devices." : "These devices are unavailable. Continue safely with deterministic demo devices." });
    } finally {
      setChecking(false);
    }
  };

  const reset = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    window.localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "RESET" });
  };

  return (
    <div className="app-frame sage-app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {state.phase !== "interview" ? <Header offline={offline} /> : null}
      {state.phase === "onboarding" ? <Onboarding state={state} dispatch={dispatch} /> : null}
      {state.phase === "permissions" ? <Permissions state={state} dispatch={dispatch} stream={stream} checking={checking} onRequest={requestDevices} /> : null}
      {state.phase === "interview" ? <InterviewWorkspace state={state} dispatch={dispatch} stream={stream} now={now} offline={offline} /> : null}
      {state.phase === "complete" ? <Completion state={state} onReset={reset} /> : null}
    </div>
  );
}
