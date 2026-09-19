import { describe, expect, it } from "vitest";
import { initialInterviewState, interviewReducer } from "./interview-machine";

function startDemoInterview() {
  let state = interviewReducer(initialInterviewState, { type: "SET_CONSENT", accepted: true });
  state = interviewReducer(state, { type: "OPEN_PERMISSIONS" });
  state = interviewReducer(state, { type: "USE_DEMO_DEVICES" });
  return interviewReducer(state, { type: "START_INTERVIEW", now: 1000 });
}

describe("voice interview state machine", () => {
  it("requires explicit consent and device mode before starting", () => {
    const withoutConsent = interviewReducer(initialInterviewState, { type: "OPEN_PERMISSIONS" });
    expect(withoutConsent.phase).toBe("onboarding");

    let state = interviewReducer(initialInterviewState, { type: "SET_CONSENT", accepted: true });
    state = interviewReducer(state, { type: "OPEN_PERMISSIONS" });
    expect(state.cameraOptIn).toBe(false);
    expect(interviewReducer(state, { type: "START_INTERVIEW", now: 1000 }).phase).toBe("permissions");

    state = interviewReducer(state, { type: "USE_DEMO_DEVICES" });
    expect(interviewReducer(state, { type: "START_INTERVIEW", now: 1000 }).phase).toBe("interview");
  });

  it("inserts an answer-aware follow-up from voice transcript content", () => {
    let state = startDemoInterview();
    state = interviewReducer(state, {
      type: "ANSWER_RECORDED",
      transcript: "We used a dashboard to track median onboarding days before and after.",
    });

    expect(state.questions).toHaveLength(4);
    expect(state.questions[1]).toMatchObject({
      kind: "follow_up",
      id: "question_onboarding_follow_up_measurement",
    });
    expect(state.answers[0]).toMatchObject({ mode: "voice", correctedTranscript: null });
  });

  it("requires live device reconnection after a refresh while preserving progress", () => {
    let state = startDemoInterview();
    state = { ...state, permissionMode: "live" };
    state = interviewReducer(state, {
      type: "ANSWER_RECORDED",
      transcript: "A voice answer already on the record.",
    });

    const restored = interviewReducer(initialInterviewState, { type: "RESTORE", state });
    expect(restored.phase).toBe("permissions");
    expect(restored.permissionMode).toBeNull();
    expect(restored.answers).toHaveLength(1);
  });

  it("completes one continuous interview and resets cleanly", () => {
    let state = startDemoInterview();
    state = interviewReducer(state, { type: "ANSWER_RECORDED", transcript: "First answer." });
    for (let index = 1; index < 4; index += 1) {
      state = interviewReducer(state, { type: "ANSWER_RECORDED", transcript: `Voice answer ${index}.` });
    }

    expect(state.phase).toBe("complete");
    expect(state.answers).toHaveLength(4);
    expect(interviewReducer(state, { type: "RESET" })).toEqual(initialInterviewState);
  });
});
