import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onReady: (blob: Blob, durationMs: number) => void;
  disabled?: boolean;
};

export function AudioRecorder({ onReady, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const dur = Date.now() - startRef.current;
        stream.getTracks().forEach((t) => t.stop());
        onReady(blob, dur);
      };
      recRef.current = rec;
      startRef.current = Date.now();
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error("لا يمكن الوصول للميكروفون");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  if (!recording) {
    return (
      <Button type="button" size="icon" variant="ghost" onClick={start} disabled={disabled} title="سجّل تعليقاً صوتياً">
        <Mic className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant="destructive" onClick={stop} className="gap-1">
      <Square className="h-3 w-3" />
      <span className="text-xs tabular-nums">{seconds}s</span>
    </Button>
  );
}

export function AudioPreview({ blob, onClear }: { blob: Blob; onClear: () => void }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted px-2 py-1">
      <audio src={url} controls className="h-8 flex-1" />
      <Button type="button" size="icon" variant="ghost" onClick={onClear}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

export function UploadingHint() {
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> جاري الرفع...</span>;
}
