export type DeviceFailure = "denied" | "unavailable";

export async function requestInterviewDevices(includeCamera: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Media capture is unavailable", "NotSupportedError");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: includeCamera
      ? {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false,
  });
}

export function classifyDeviceError(error: unknown): DeviceFailure {
  if (
    error instanceof DOMException &&
    ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(error.name)
  ) {
    return "denied";
  }
  return "unavailable";
}

export type MicrophoneFailure = "denied" | "unavailable" | "interrupted";

export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new DOMException("Microphone capture is unavailable", "NotSupportedError");
  }

  // Audio only by policy. Camera participation is outside the MVP and any future
  // camera experiment must live behind a separate, explicit capability boundary.
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function classifyMicrophoneError(error: unknown): MicrophoneFailure {
  if (
    error instanceof DOMException &&
    ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(error.name)
  ) {
    return "denied";
  }
  return "unavailable";
}
