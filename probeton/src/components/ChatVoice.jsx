import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

// Голосовые сообщения в чате: запись с микрофона (MediaRecorder,
// встроен в браузер — ничего платного) и проигрыватель в «пузыре».

export const MAX_VOICE_SECONDS = 120;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  return types.find((tp) => MediaRecorder.isTypeSupported?.(tp)) || "";
}

export function canRecordVoice() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Запись: start() — начать, stop() — закончить и получить {blob, duration},
// cancel() — выбросить запись.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const timerRef = useRef(null);
  const resolveRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanup = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  };

  useEffect(() => () => {
    cancelledRef.current = true;
    try {
      recRef.current?.stop();
    } catch {
      // уже остановлен
    }
    cleanup();
  }, []);

  const stop = () =>
    new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);
      cancelledRef.current = false;
      resolveRef.current = resolve;
      rec.stop();
    });

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const duration = (Date.now() - startedRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
      const resolve = resolveRef.current;
      resolveRef.current = null;
      const cancelled = cancelledRef.current;
      cleanup();
      resolve?.(cancelled || blob.size === 0 ? null : { blob, duration });
    };
    recRef.current = rec;
    startedRef.current = Date.now();
    rec.start(250);
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedRef.current) / 1000;
      setSeconds(s);
    }, 250);
  };

  const cancel = () => {
    cancelledRef.current = true;
    resolveRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      cleanup();
    }
  };

  return { recording, seconds, start, stop, cancel };
}

// Проигрыватель голосового сообщения внутри «пузыря».
export function VoiceBubble({ src, duration, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(Number(duration) || 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setTotal(a.duration);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Одновременно играет только одно голосовое.
      document.querySelectorAll("audio[data-chat-voice]").forEach((el) => {
        if (el !== a) el.pause();
      });
      a.play().catch((e) => console.error(e));
    } else {
      a.pause();
    }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * total;
    setCurrent(a.currentTime);
  };

  const progress = total ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" data-chat-voice />
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white",
          mine ? "bg-green-700" : "bg-green-600"
        )}
        aria-label={playing ? "Пауза" : "Слушать"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div onClick={seek} className="relative h-6 flex items-center cursor-pointer">
          <div className="w-full h-1 rounded-full bg-black/15" />
          <div
            className="absolute left-0 h-1 rounded-full bg-green-600"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute w-3 h-3 rounded-full bg-green-600 -translate-x-1/2"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] chat-meta flex items-center gap-1 -mt-0.5">
          <Mic className="w-3 h-3" />
          {fmtDuration(playing || current ? current : total)}
        </div>
      </div>
    </div>
  );
}
