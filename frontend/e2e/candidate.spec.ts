import { expect, test, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/candidate");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start connected demo" }).click();
  await expect(page.getByRole("complementary", { name: "Sage, your interview guide" })).toBeVisible();
}

test("Sage previews source claims before consent and fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/candidate");
  await expect(page.getByRole("heading", { name: "Meet Sage." })).toBeVisible();
  await expect(page.getByText("A consistent chance to be heard.")).toBeVisible();
  await expect(page.getByText(/Sage does not make the hiring decision/)).toBeVisible();
  await expect(page.getByText("Topics from your experience · fictional demo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What Sage may explore" })).toBeVisible();
  for (const area of ["Your story", "Relevant work", "Your contribution", "Outcomes", "Your judgment", "Anything else"]) {
    await expect(page.getByText(area, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Built a hybrid Neo4j/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start connected demo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Start offline rehearsal" })).toBeDisabled();
  await page.screenshot({ path: "test-results/sage-mobile-welcome.png", fullPage: true });
  await start(page);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByLabel("Optional camera self-view")).toContainText("Camera off");
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/sage-mobile-interview.png", fullPage: true });
});

test("camera stays off until explicit opt-in and denial preserves the interview", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __cameraRequests?: number }).__cameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: () => {
        (window as typeof window & { __cameraRequests?: number }).__cameraRequests = ((window as typeof window & { __cameraRequests?: number }).__cameraRequests ?? 0) + 1;
        return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
      },
    } });
  });
  await start(page);
  expect(await page.evaluate(() => (window as typeof window & { __cameraRequests?: number }).__cameraRequests)).toBe(0);
  await expect(page.getByLabel("Optional camera self-view")).toContainText("No camera permission requested");
  await page.getByRole("button", { name: "Enable optional self-view" }).click();
  expect(await page.evaluate(() => (window as typeof window & { __cameraRequests?: number }).__cameraRequests)).toBe(1);
  await expect(page.getByText("Optional self-view unavailable. You can continue the complete interview without camera access.")).toBeVisible();
  await page.getByRole("button", { name: "Start microphone" }).click();
  await expect(page.getByText(/Microphone access was not allowed/).first()).toBeVisible();
  await page.getByLabel("Your answer", { exact: true }).fill("I used Neo4j for RAG.");
  await page.getByRole("button", { name: "Review answer", exact: true }).click();
  await page.getByRole("button", { name: "Submit reviewed answer" }).click();
  await expect(page.getByText("Adaptive follow-up", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
});

test("recorded audio previews a labeled fixture and preserves the reviewed correction", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await page.getByRole("button", { name: "Enable optional self-view" }).click();
  await expect(page.getByText("On-device self-view", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn off optional self-view" }).click();
  await page.getByRole("button", { name: "Start microphone" }).click();
  await expect(page.getByText("Microphone recording", { exact: true })).toBeVisible();
  // Let the fake device produce a nonempty recording for the real multipart endpoint.
  await expect.poll(() => page.locator(".microphone-panel").textContent()).toContain("Stop recording");
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByText(/Simulated transcript from the demo fixture/)).toBeVisible();
  const original = await page.getByLabel("Your answer", { exact: true }).inputValue();
  expect(original.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Review answer", exact: true }).click();
  const corrected = "I used Neo4j for the RAG pipeline.";
  await page.getByLabel("Correct transcript before submitting").fill(corrected);
  await page.getByRole("button", { name: "Submit reviewed answer" }).click();
  await expect(page.getByText("Adaptive follow-up", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/sage-connected-interview.png", fullPage: true });
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Use example answer" }).click();
    await page.getByRole("button", { name: "Review answer", exact: true }).click();
    await page.getByRole("button", { name: "Submit reviewed answer" }).click();
    await expect(page.getByRole("button", { name: "Submit reviewed answer" })).toBeHidden();
    if (await page.getByRole("heading", { name: "Conversation complete" }).isVisible()) break;
  }
  await expect(page.getByRole("heading", { name: "Conversation complete" })).toBeVisible();
  const report = await page.evaluate(() => JSON.parse(localStorage.getItem("claimproof-integrated-session-v1")!).report);
  expect(report.answers[0]).toMatchObject({ transcript: corrected, original_transcript: original });
  expect(errors).toEqual([]);
});
