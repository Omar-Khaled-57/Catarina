"use client";

/**
 * AudioPlayer — Minimal play/pause button for notification voice notes.
 * Extracted from NotificationPanel to break the NotificationPanel ↔ NotificationModal import cycle.
 */

import { useState, useRef } from "react";
import { Play, Pause, AlertTriangle } from "lucide-react";

export function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setError(false);
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setError(true);
      }
    }
  };

  return (
    <span className="inline-flex flex-col gap-0.5 mt-2">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all"
      >
        {error ? <AlertTriangle size={14} /> : playing ? <Pause size={14} /> : <Play size={14} />}
        {error ? "Error" : playing ? "Pause" : "Play"}
      </button>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        preload="none"
        className="hidden"
      />
    </span>
  );
}
