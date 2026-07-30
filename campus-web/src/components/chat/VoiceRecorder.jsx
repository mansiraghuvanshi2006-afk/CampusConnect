import { useEffect, useRef, useState } from "react";

import {
  FiMic,
  FiPause,
  FiPlay,
  FiSquare,
  FiX,
} from "react-icons/fi";

const VoiceRecorder = ({
  onSend,
  onCancel,
  disabled,
  onRecordingChange,
}) => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveForm, setWaveForm] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);

      for (const track of streamRef.current?.getTracks() || []) {
        track.stop();
      }
    };
  }, []);

  const sampleWave = () => {
    const analyser = analyserRef.current;

    if (!analyser) {
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;

    for (let i = 0; i < data.length; i += 1) {
      const value = (data[i] - 128) / 128;
      sum += Math.abs(value);
    }

    const amplitude = Math.min(1, sum / data.length * 8);

    setWaveForm((previous) => [...previous.slice(-47), amplitude || 0.1]);
    rafRef.current = requestAnimationFrame(sampleWave);
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    streamRef.current = stream;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    sampleWave();

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(200);
    setRecording(true);
    setPaused(false);
    setSeconds(0);

    timerRef.current = setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);
  };

  const pause = () => {
    mediaRecorderRef.current?.pause();
    setPaused(true);
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
  };

  const resume = () => {
    mediaRecorderRef.current?.resume();
    setPaused(false);
    timerRef.current = setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);
    sampleWave();
  };

  const cancel = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    mediaRecorderRef.current?.stop();

    for (const track of streamRef.current?.getTracks() || []) {
      track.stop();
    }

    setRecording(false);
    setPaused(false);
    setSeconds(0);
    setWaveForm([]);
    onCancel?.();
  };

  const finish = () =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        resolve(blob);
      };

      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      recorder.stop();

      for (const track of streamRef.current?.getTracks() || []) {
        track.stop();
      }
    });

  if (!recording) {
    return (
      <button
        type="button"
        aria-label="Record voice note"
        disabled={disabled}
        onClick={() => start().catch(() => {})}
        className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <FiMic className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2">
      <div className="flex gap-[2px]">
        {waveForm.slice(-20).map((value, index) => (
          <span
            key={index}
            className="w-[3px] rounded-full bg-red-300"
            style={{ height: `${Math.max(4, value * 20)}px` }}
          />
        ))}
      </div>

      <span className="text-xs font-semibold text-red-200">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </span>

      {paused ? (
        <button
          type="button"
          aria-label="Resume recording"
          onClick={resume}
          className="rounded-lg p-1.5 text-white hover:bg-white/10"
        >
          <FiPlay className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Pause recording"
          onClick={pause}
          className="rounded-lg p-1.5 text-white hover:bg-white/10"
        >
          <FiPause className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        aria-label="Cancel recording"
        onClick={cancel}
        className="rounded-lg p-1.5 text-white hover:bg-white/10"
      >
        <FiX className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="Send voice note"
        onClick={async () => {
          const blob = await finish();

          if (!blob) {
            return;
          }

          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: blob.type || "audio/webm",
          });

          setRecording(false);
          onSend?.({
            file,
            duration: seconds,
            waveForm,
          });
        }}
        className="ml-auto rounded-lg bg-purple-600 p-1.5 text-white hover:bg-purple-500"
      >
        <FiSquare className="h-4 w-4" />
      </button>
    </div>
  );
};

export default VoiceRecorder;
