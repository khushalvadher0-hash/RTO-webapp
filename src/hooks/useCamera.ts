import { useState, useCallback, useRef } from "react";

export interface CameraState {
  stream: MediaStream | null;
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
  isPlaying: boolean;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    stream: null,
    isLoading: false,
    loadingMessage: null,
    error: null,
    isPlaying: false,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCamera = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping track:", e);
        }
      });
      streamRef.current = null;
    }
    setState({
      stream: null,
      isLoading: false,
      loadingMessage: null,
      error: null,
      isPlaying: false,
    });
  }, []);

  const startCamera = useCallback(
    async (videoElement: HTMLVideoElement | null) => {
      // 1. Reset state & stop existing stream
      stopCamera();

      // Check HTTPS or Localhost
      const isSecure =
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

      if (!isSecure) {
        setState({
          stream: null,
          isLoading: false,
          loadingMessage: null,
          error: "Camera requires HTTPS or localhost. Please access via secure URL or use upload.",
          isPlaying: false,
        });
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState({
          stream: null,
          isLoading: false,
          loadingMessage: null,
          error: "Camera access is not supported on this browser. Please upload an image file.",
          isPlaying: false,
        });
        return;
      }

      setState({
        stream: null,
        isLoading: true,
        loadingMessage: "Opening Camera...",
        error: null,
        isPlaying: false,
      });

      // 2. Timeout Guard (5 seconds maximum loading)
      timeoutRef.current = setTimeout(() => {
        if (!streamRef.current) {
          console.warn("Camera initialization timeout after 5s");
          stopCamera();
          setState({
            stream: null,
            isLoading: false,
            loadingMessage: null,
            error: "Unable to access camera. Connection timed out.",
            isPlaying: false,
          });
        }
      }, 5000);

      // 1. Detect Device & Touch support
      const isMobile =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        window.innerWidth < 1024;

      // Constraints strategy
      const constraintsList: MediaStreamConstraints[] = [];

      if (isMobile) {
        // Attempt enumerating devices to locate rear camera ID directly
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          const rearDevice = videoInputs.find((d) =>
            /back|rear|environment|0|main/i.test(d.label || "")
          );
          if (rearDevice && rearDevice.deviceId) {
            constraintsList.push({
              video: { deviceId: { exact: rearDevice.deviceId } },
              audio: false,
            });
            constraintsList.push({
              video: { deviceId: rearDevice.deviceId },
              audio: false,
            });
          }
        } catch (e) {
          console.warn("enumerateDevices check error:", e);
        }

        // Mobile Constraint 1: Exact environment facingMode
        constraintsList.push({
          video: { facingMode: { exact: "environment" } },
          audio: false,
        });
        // Mobile Constraint 2: String environment facingMode
        constraintsList.push({
          video: { facingMode: "environment" },
          audio: false,
        });
        // Mobile Constraint 3: Ideal environment facingMode
        constraintsList.push({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        // Mobile Fallback: User facingMode
        constraintsList.push({
          video: { facingMode: "user" },
          audio: false,
        });
      } else {
        // Desktop / Laptop: Prefer user facingMode
        constraintsList.push({
          video: { facingMode: "user" },
          audio: false,
        });
      }

      // Final universal fallback for all devices
      constraintsList.push({ video: true, audio: false });

      let activeStream: MediaStream | null = null;
      let lastError: any = null;

      for (let i = 0; i < constraintsList.length; i++) {
        try {
          if (i > 0) {
            setState((prev) => ({
              ...prev,
              loadingMessage: "Trying another camera...",
            }));
          }
          activeStream = await navigator.mediaDevices.getUserMedia(constraintsList[i]);
          const track = activeStream.getVideoTracks()[0];
          if (track && track.readyState === "live") {
            break;
          } else if (activeStream) {
            activeStream.getTracks().forEach((t) => t.stop());
            activeStream = null;
          }
        } catch (err: any) {
          console.warn(`Camera constraint index ${i} failed:`, err);
          lastError = err;
        }
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!activeStream) {
        let errText = "Could not access camera. You can upload an image file.";
        if (lastError) {
          if (lastError.name === "NotAllowedError" || lastError.name === "PermissionDeniedError") {
            errText = "Camera permission denied. Please allow camera access in browser settings or upload an image file.";
          } else if (lastError.name === "NotFoundError" || lastError.name === "DevicesNotFoundError") {
            errText = "No camera found on this device. Please upload an image file.";
          } else if (lastError.name === "NotReadableError" || lastError.name === "TrackStartError") {
            errText = "Camera is currently in use by another application.";
          }
        }

        setState({
          stream: null,
          isLoading: false,
          loadingMessage: null,
          error: errText,
          isPlaying: false,
        });
        return;
      }

      streamRef.current = activeStream;

      if (videoElement) {
        try {
          videoElement.srcObject = activeStream;
          videoElement.setAttribute("playsinline", "true");
          videoElement.play().catch((playErr) => console.warn("Video play exception:", playErr));
        } catch (playErr) {
          console.warn("Video srcObject error:", playErr);
        }
      }

      setState({
        stream: activeStream,
        isLoading: false,
        loadingMessage: null,
        error: null,
        isPlaying: true,
      });
    },
    [stopCamera]
  );

  return {
    stream: state.stream,
    isLoading: state.isLoading,
    loadingMessage: state.loadingMessage,
    error: state.error,
    isPlaying: state.isPlaying,
    startCamera,
    stopCamera,
  };
}
