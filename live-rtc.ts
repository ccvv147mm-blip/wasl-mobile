import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * بث مباشر بالكاميرا عبر WebRTC مع إشارات لحظية من الخدمة السحابية.
 * المضيف ينشئ اتصالاً منفصلاً لكل مشاهد (مناسب للبثوث الصغيرة والمتوسطة).
 */
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

type Signal =
  | { kind: "join"; from: string }
  | { kind: "leave"; from: string }
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "end"; from: string };

export const randomId = () => Math.random().toString(36).slice(2, 12);

function channelFor(streamId: string): RealtimeChannel {
  return supabase.channel(`live-signal-${streamId}`, { config: { broadcast: { self: false } } });
}

function send(ch: RealtimeChannel, payload: Signal) {
  void ch.send({ type: "broadcast", event: "signal", payload });
}

/** المضيف: يبث الكاميرا والميكروفون لكل من يدخل الغرفة */
export function startHosting(opts: {
  streamId: string;
  stream: MediaStream;
  onViewersChange?: (count: number) => void;
}) {
  const hostId = randomId();
  const peers = new Map<string, RTCPeerConnection>();
  const ch = channelFor(opts.streamId);

  const report = () => opts.onViewersChange?.(peers.size);

  const createPeer = async (viewer: string) => {
    peers.get(viewer)?.close();
    const pc = new RTCPeerConnection(ICE);
    peers.set(viewer, pc);
    opts.stream.getTracks().forEach((t) => pc.addTrack(t, opts.stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) send(ch, { kind: "ice", from: hostId, to: viewer, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        pc.close();
        peers.delete(viewer);
        report();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send(ch, { kind: "offer", from: hostId, to: viewer, sdp: offer });
    report();
  };

  ch.on("broadcast", { event: "signal" }, ({ payload }) => {
    const msg = payload as Signal;
    if (msg.kind === "join") {
      void createPeer(msg.from);
    } else if (msg.kind === "answer" && msg.to === hostId) {
      void peers.get(msg.from)?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if (msg.kind === "ice" && msg.to === hostId) {
      void peers.get(msg.from)?.addIceCandidate(new RTCIceCandidate(msg.candidate));
    } else if (msg.kind === "leave") {
      peers.get(msg.from)?.close();
      peers.delete(msg.from);
      report();
    }
  });

  void ch.subscribe();

  return {
    stop() {
      send(ch, { kind: "end", from: hostId });
      peers.forEach((p) => p.close());
      peers.clear();
      void supabase.removeChannel(ch);
    },
  };
}

/** المشاهد: يستقبل فيديو المضيف */
export function startWatching(opts: {
  streamId: string;
  onStream: (stream: MediaStream) => void;
  onState?: (state: "connecting" | "live" | "ended" | "failed") => void;
}) {
  const viewerId = randomId();
  const ch = channelFor(opts.streamId);
  let pc: RTCPeerConnection | null = null;
  let hostId: string | null = null;

  opts.onState?.("connecting");

  const ensurePeer = () => {
    if (pc) return pc;
    pc = new RTCPeerConnection(ICE);
    pc.ontrack = (e) => {
      if (e.streams[0]) opts.onStream(e.streams[0]);
      opts.onState?.("live");
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && hostId) {
        send(ch, { kind: "ice", from: viewerId, to: hostId, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc && ["failed", "closed"].includes(pc.connectionState)) opts.onState?.("failed");
    };
    return pc;
  };

  ch.on("broadcast", { event: "signal" }, ({ payload }) => {
    const msg = payload as Signal;
    if (msg.kind === "offer" && msg.to === viewerId) {
      hostId = msg.from;
      const peer = ensurePeer();
      void (async () => {
        await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send(ch, { kind: "answer", from: viewerId, to: msg.from, sdp: answer });
      })();
    } else if (msg.kind === "ice" && msg.to === viewerId) {
      void ensurePeer().addIceCandidate(new RTCIceCandidate(msg.candidate));
    } else if (msg.kind === "end") {
      opts.onState?.("ended");
    }
  });

  void ch.subscribe((status) => {
    if (status === "SUBSCRIBED") send(ch, { kind: "join", from: viewerId });
  });

  // إعادة إعلان الحضور في حال بدأ المضيف البث بعد دخولنا
  const retry = setInterval(() => {
    if (!pc) send(ch, { kind: "join", from: viewerId });
  }, 4000);

  return {
    stop() {
      clearInterval(retry);
      send(ch, { kind: "leave", from: viewerId });
      pc?.close();
      void supabase.removeChannel(ch);
    },
  };
}
