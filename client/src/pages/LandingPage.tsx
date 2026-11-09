import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuVolume2, LuVolumeX, LuDownload } from "react-icons/lu";
import { Dithering } from "@paper-design/shaders-react";
import { useTheme } from "../lib/themeContext";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { DISCORD_INVITE_URL } from "../lib/links";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import sectionOne from "../assets/sections/first.png";
import sectionTwo from "../assets/sections/second.png";
import sectionThree from "../assets/sections/third.png";
import promoVideo from "../assets/promo-video-web.mp4";
import promoPoster from "../assets/promo-poster.jpg";
import promoAudio from "../assets/promo-audio.m4a";

const DISCORD_INVITE_CODES = ["oklah", "bz7U3UmWG", "GcuZJD68S"];

function useDiscordInvites(codes: string[]) {
  const [guilds, setGuilds] = useState<Record<string, { name: string; iconUrl: string | null }>>({});

  useEffect(() => {
    codes.forEach((code) => {
      fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.guild) return;
          const iconUrl = data.guild.icon
            ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=128`
            : null;
          setGuilds((prev) => ({ ...prev, [code]: { name: data.guild.name, iconUrl } }));
        })
        .catch(() => {});
    });
  }, [codes]);

  return guilds;
}

function Reveal({
  children,
  className = "",
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? "animate-hero-in" : "opacity-0"}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

const MAX_PLAY_ATTEMPTS = 8;
const AUDIO_HARD_SEEK = 0.4;
const AUDIO_SOFT_DRIFT = 0.06;
const AUDIO_RATE_TRIM = 0.04;
const MIN_SEEK_INTERVAL_MS = 1000;

function ScrollPlayVideo({ src, poster, audioSrc }: { src: string; poster: string; audioSrc: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(true);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let lastSeekAt = 0;
    let lastVideoTime = 0;

    const targetTime = (audio: HTMLAudioElement) =>
      audio.duration > 0 ? el.currentTime % audio.duration : el.currentTime;

    const ready = (audio: HTMLAudioElement) => audio.readyState >= 1 && Number.isFinite(audio.duration);

    const hardSeek = (audio: HTMLAudioElement) => {
      try {
        audio.currentTime = targetTime(audio);
      } catch {
        return;
      }
      audio.playbackRate = 1;
      lastSeekAt = performance.now();
    };

    const syncAudio = () => {
      const audio = audioRef.current;
      if (!audio || mutedRef.current || !ready(audio)) return;

      const looped = el.currentTime < lastVideoTime - 0.5;
      lastVideoTime = el.currentTime;

      const drift = audio.currentTime - targetTime(audio);
      const now = performance.now();

      if (looped || (Math.abs(drift) > AUDIO_HARD_SEEK && now - lastSeekAt > MIN_SEEK_INTERVAL_MS)) {
        hardSeek(audio);
        return;
      }

      if (Math.abs(drift) > AUDIO_SOFT_DRIFT) {
        audio.playbackRate = drift > 0 ? 1 - AUDIO_RATE_TRIM : 1 + AUDIO_RATE_TRIM;
      } else if (audio.playbackRate !== 1) {
        audio.playbackRate = 1;
      }
    };

    const onPlay = () => {
      const audio = audioRef.current;
      if (!audio || mutedRef.current) return;
      if (ready(audio)) hardSeek(audio);
      audio.play().catch(() => {});
    };

    const onPause = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.playbackRate = 1;
      audio.pause();
    };

    const onSeeked = () => {
      const audio = audioRef.current;
      if (!audio || mutedRef.current || !ready(audio)) return;
      hardSeek(audio);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("seeked", onSeeked);
    el.addEventListener("timeupdate", syncAudio);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("timeupdate", syncAudio);
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.muted = true;

    let wanted = false;
    let attempts = 0;
    let timer = 0;

    const attempt = () => {
      if (!wanted) return;
      el.play()
        .then(() => setBlocked(false))
        .catch(() => {
          attempts += 1;
          if (attempts >= MAX_PLAY_ATTEMPTS) {
            setBlocked(true);
            return;
          }
          timer = window.setTimeout(attempt, 250);
        });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        wanted = entry.isIntersecting;
        if (wanted) {
          attempts = 0;
          attempt();
        } else {
          el.pause();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const toggleSound = () => {
    const el = ref.current;
    if (!el) return;

    if (!muted) {
      const current = audioRef.current;
      if (current) {
        current.playbackRate = 1;
        current.pause();
      }
      mutedRef.current = true;
      setMuted(true);
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    audio.playbackRate = 1;

    const alignToVideo = () => {
      try {
        audio.currentTime = audio.duration > 0 ? el.currentTime % audio.duration : el.currentTime;
      } catch {
        return;
      }
    };

    audio.play().catch(() => {});
    if (audio.readyState >= 1) alignToVideo();
    else audio.addEventListener("loadedmetadata", alignToVideo, { once: true });

    mutedRef.current = false;
    setMuted(false);
    if (el.paused) el.play().catch(() => {});
  };

  return (
    <div className="relative">
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="block w-full"
        muted
        loop
        playsInline
        preload="auto"
        controls={blocked}
      />
      {!blocked && (
        <button
          onClick={toggleSound}
          className="absolute bottom-4 right-4 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-md transition hover:bg-black/60"
          aria-label={muted ? "Unmute video" : "Mute video"}
        >
          {muted ? <LuVolumeX className="h-4 w-4" /> : <LuVolume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function BrandCta({
  to,
  children,
  className,
  spinnerSize = 18,
}: {
  to: string;
  children: ReactNode;
  className: string;
  spinnerSize?: number;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <Link
      to={to}
      onClick={(e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        window.setTimeout(() => navigate(to), 900);
      }}
      aria-busy={loading}
      className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-brand font-medium text-white transition-transform active:translate-y-0.5 ${className}`}
    >
      <span className="relative inline-flex items-center justify-center">
        <span className={loading ? "invisible" : undefined}>{children}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <FlickerSpinner size={spinnerSize} />
          </span>
        )}
      </span>
    </Link>
  );
}

export default function LandingPage() {
  const { theme } = useTheme();
  const discordGuilds = useDiscordInvites(DISCORD_INVITE_CODES);
  const [loaded, setLoaded] = useState(false);
  const install = usePwaInstall();
  const [iosHelp, setIosHelp] = useState(false);
  const showDownload = !install.installed;
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => {
    if (document.readyState === "complete") {
      setLoaded(true);
      return;
    }
    const onLoad = () => setLoaded(true);
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <div className="bg-white text-black dark:bg-black dark:text-white">
      <div className="flex min-h-[100svh] flex-col">
        <header className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-5">
          <Link to="/" className="flex items-center gap-2 justify-self-start">
            <img src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"} alt="Socially" className="w-20" />
          </Link>
          <nav className="flex items-center gap-6 justify-self-center">
            <Link
              to="/applications"
              className="text-sm font-medium text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
            >
              Applications
            </Link>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-neutral-600 hover:text-[#5865F2] dark:text-neutral-300 dark:hover:text-[#5865F2]"
            >
              Discord
            </a>
          </nav>
          <div className="flex items-center gap-4 justify-self-end">
            <BrandCta to="/login" className="px-4 py-2 text-sm" spinnerSize={16}>
              Get started
            </BrandCta>
          </div>
        </header>

        <section className="relative flex flex-1 items-center overflow-hidden">
          <Dithering
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 22%), radial-gradient(ellipse 60% 55% at 50% 40%, black, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 22%), radial-gradient(ellipse 60% 55% at 50% 40%, black, transparent)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-60"
            colorBack={theme === "dark" ? "#000000" : "#ffffff"}
            colorFront="#1A4DFF"
            shape="warp"
            type="4x4"
            size={6}
            speed={0.15}
          />
          <div className="relative mx-auto w-full max-w-2xl px-4 py-10 text-center">
            <img
              src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"}
              alt="Socially"
              className={`mx-auto h-16 w-auto sm:h-24 ${loaded ? "animate-hero-in" : "opacity-0"}`}
            />
            <p
              className={`mx-auto mt-5 max-w-md text-lg text-neutral-700 dark:text-neutral-300 ${loaded ? "animate-hero-in" : "opacity-0"}`}
              style={{ animationDelay: "120ms" }}
            >
              Posts, stories, and messages for you. Follow your favorite servers or services
              and find out what they're up to.
            </p>
            <div
              className={`mt-8 flex flex-wrap items-center justify-center gap-3 ${loaded ? "animate-hero-in" : "opacity-0"}`}
              style={{ animationDelay: "240ms" }}
            >
              <BrandCta to="/login" className="gap-2 px-8 py-3" spinnerSize={20}>
                Get started
              </BrandCta>
              {showDownload && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => {
                      if (install.canInstall) {
                        install.promptInstall();
                      } else {
                        install.isIOS ? setIosHelp(true) : setInstallHelp(true);
                      }
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-8 py-3 font-medium transition-transform active:translate-y-0.5 dark:border-neutral-700"
                  >
                    <LuDownload className="h-5 w-5" />
                    Download
                  </button>
                  {iosHelp && (
                    <p className="max-w-xs text-sm text-neutral-600 dark:text-neutral-400">
                      Tap the Share button, then "Add to Home Screen" to install Socially.
                    </p>
                  )}
                  {installHelp && (
                    <p className="max-w-xs text-sm text-neutral-600 dark:text-neutral-400">
                      In your browser menu, look for "Install Socially" or "Add to Home Screen" to install the app.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:pb-24 sm:pt-12">
        <Reveal className="overflow-hidden rounded-2xl bg-black ring-1 ring-[#001b7d] shadow-[0_0_40px_rgba(0,27,125,0.30)] dark:shadow-[0_0_70px_rgba(0,27,125,0.65)]">
          <ScrollPlayVideo src={promoVideo} poster={promoPoster} audioSrc={promoAudio} />
        </Reveal>
      </section>

      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-28 bottom-0 overflow-hidden sm:-top-40">
          <div className="absolute inset-0 opacity-60 dark:opacity-100">
            <div className="absolute left-1/2 top-[42%] h-[340px] w-[min(1100px,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(26,77,255,0.28),transparent)] blur-3xl" />
            <div className="absolute left-1/2 bottom-0 h-[1400px] w-[max(2600px,220vw)] -translate-x-1/2 translate-y-[92%] rounded-[50%] border-t border-[#6f96ff]/40 shadow-[0_-30px_110px_-10px_rgba(26,77,255,0.55)]" />
          </div>
          <div className="absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-white to-transparent dark:from-black" />
          <div className="absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-white to-transparent dark:from-black" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-36 text-center sm:pt-12">
        <Reveal>
          <h2 className="text-3xl font-medium sm:text-4xl">Affiliated Servers</h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-10">
            {DISCORD_INVITE_CODES.map((code) => {
              const guild = discordGuilds[code];
              return (
                <a
                  key={code}
                  href={`https://discord.gg/${code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-100 transition-opacity hover:opacity-70"
                >
                  {guild?.iconUrl ? (
                    <img src={guild.iconUrl} alt={guild.name} className="h-16 w-16 rounded-full" />
                  ) : (
                    <span className="block h-16 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  )}
                </a>
              );
            })}
          </div>
        </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-3xl font-medium leading-tight sm:text-4xl">
              Say it your way.
            </h2>
            <p className="mt-4 max-w-md text-neutral-600 dark:text-neutral-400">
              Share text, images, GIFs, polls, and quote posts, and watch your community jump in
              with reposts and replies.
            </p>
          </Reveal>

          <Reveal delay={120} className="overflow-hidden rounded-lg bg-black shadow-xl">
            <img src={sectionOne} alt="A Socially post" className="w-full" />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="overflow-hidden rounded-lg bg-black shadow-xl lg:order-1">
            <img src={sectionTwo} alt="A Socially direct message thread" className="w-full" />
          </Reveal>

          <Reveal delay={120} className="lg:order-2">
            <h2 className="text-3xl font-medium leading-tight sm:text-4xl">
              Keep it between you two.
            </h2>
            <p className="mt-4 max-w-md text-neutral-600 dark:text-neutral-400">
              Direct messages with GIFs, images, and replies that actually feel instant, so you
              can pick up right where you left off.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-3xl font-medium leading-tight sm:text-4xl">
              Moderation that keeps up with you.
            </h2>
            <p className="mt-4 max-w-md text-neutral-600 dark:text-neutral-400">
              Audit logs, reports, and community-scoped staff roles, all in one panel, so
              nothing bleeds between the communities you moderate.
            </p>
          </Reveal>

          <Reveal delay={120} className="overflow-hidden rounded-lg bg-black shadow-xl">
            <img src={sectionThree} alt="Socially's moderation audit log" className="w-full" />
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"} alt="Socially" className="w-20" />
            </div>
            <p className="mt-2 text-sm text-neutral-400">© {new Date().getFullYear()} Socially. All rights reserved.</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-400">General</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link to="/" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Home
              </Link>
              <Link to="/login" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Log in
              </Link>
              <Link to="/applications" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Applications
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-400">Legal</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link to="/privacy" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Terms of Service
              </Link>
              <Link to="/copyright" className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white">
                Copyright
              </Link>
              <a
                href="mailto:legal@socially.lol"
                className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              >
                legal@socially.lol
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-400">Support</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              >
                Discord
              </a>
              <a
                href="mailto:support@socially.lol"
                className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              >
                support@socially.lol
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
