import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuSkipForward, LuVolume2, LuVolumeX } from "react-icons/lu";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import promoVideo from "../assets/promo-video.mp4";

export default function PromoVideoPage() {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [continuing, setContinuing] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;

    el.muted = false;
    el.play()
      .then(() => {
        if (cancelled) return;
        setMuted(false);
      })
      .catch(() => {
        if (cancelled) return;
        el.muted = true;
        setMuted(true);
        setShowSoundPrompt(true);
        el.play().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enableSound = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.currentTime = 0;
    el.play().catch(() => {});
    setMuted(false);
    setShowSoundPrompt(false);
  };

  const toggleSound = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);
    setShowSoundPrompt(false);
  };

  const continueOn = async () => {
    if (continuing) return;
    setContinuing(true);
    await api.post("/onboarding/promo-video-seen");
    await refetch();
    navigate(user?.onboardingComplete ? "/" : "/onboarding", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={promoVideo}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
        muted
        onEnded={continueOn}
      />

      {showSoundPrompt && (
        <button
          onClick={enableSound}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play with sound"
        >
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20">
            <LuVolume2 className="h-4 w-4" />
            Tap for sound
          </span>
        </button>
      )}

      <button
        onClick={toggleSound}
        className="absolute bottom-6 left-6 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md hover:bg-white/20"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <LuVolumeX className="h-4 w-4" /> : <LuVolume2 className="h-4 w-4" />}
      </button>

      <button
        onClick={continueOn}
        disabled={continuing}
        className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md hover:bg-white/20 disabled:opacity-40"
      >
        Skip
        <LuSkipForward className="h-4 w-4" />
      </button>
    </div>
  );
}
