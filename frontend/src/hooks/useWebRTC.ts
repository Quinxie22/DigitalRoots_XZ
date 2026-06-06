// ─────────────────────────────────────────────────────────────────────────────
// useWebRTC.ts
// Custom React hook managing WebRTC peer-to-peer video call logic.
//
// HOW IT WORKS:
//   - WebRTC is a browser technology for direct peer-to-peer video/audio calls.
//   - The process to establish a call has these steps:
//     1. "Caller" gets their local camera/microphone stream.
//     2. Caller creates an RTCPeerConnection and sends an "offer" (SDP) via
//        the backend Socket.io server (which relays it to the other person).
//     3. "Callee" receives the offer, gets their own stream, sends back an
//        "answer" (SDP) via the socket.
//     4. Both sides exchange "ICE candidates" (network path info) via socket.
//     5. Once ICE negotiation completes, video/audio streams flow directly
//        between the two browsers without going through the server.
//
//   - If no physical camera is present (e.g. desktop without webcam), the hook
//     automatically falls back to a canvas-generated animated mock stream.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';

// ICE servers tell WebRTC how to traverse NAT/firewalls.
// Here we use free public STUN servers from Google and Cloudflare.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

function createMockStream(): MediaStream {
  // Create a canvas with animated gradient as a fallback video source
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;
  let frame = 0;

  const draw = () => {
    frame++;
    const grad = ctx.createLinearGradient(0, 0, 640, 480);
    const h = (frame % 360);
    grad.addColorStop(0, `hsl(${h}, 80%, 20%)`);
    grad.addColorStop(1, `hsl(${(h + 60) % 360}, 60%, 10%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 28px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷 No Camera', 320, 220);
    ctx.font = '16px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Mock Stream Active', 320, 260);
    requestAnimationFrame(draw);
  };
  draw();

  const stream = canvas.captureStream(24);
  return stream;
}

export function useWebRTC(_currentUserId: string, threadId: string) {
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);
  const [isInCall, setIsInCall]         = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [callError, setCallError]       = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ senderId: string; offer: any; threadId: string } | null>(null);

  const pcRef   = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get local camera/mic stream, falling back to mock if not available
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      return stream;
    } catch {
      console.warn('Camera/mic not available, using mock stream');
      return createMockStream();
    }
  }, []);

  // Create a new RTCPeerConnection with ICE servers configured
  const createPeerConnection = useCallback((targetId: string, customThreadId?: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const activeThreadId = customThreadId || threadId;

    // When we get a remote media track, expose it as remoteStream
    pc.ontrack = (e) => {
      const [remStream] = e.streams;
      setRemoteStream(remStream);
    };

    // When ICE finds a candidate, send it to the other peer via socket
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('webrtc-candidate', {
          threadId: activeThreadId,
          targetUserId: targetId,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [threadId, endCall]);

  // Initiate a call to another user
  const startCall = useCallback(async (targetUserId: string) => {
    try {
      setCallError(null);
      const stream = await getLocalStream();
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(targetUserId);

      // Add our local tracks to the peer connection
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Join the socket call room
      socket.emit('join-call', { threadId });

      // Create an SDP offer and set it as our local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send the offer to the other user through the socket server
      socket.emit('webrtc-offer', { threadId, targetUserId, offer });

      setRemoteUserId(targetUserId);
      setIsInCall(true);
    } catch (err: any) {
      setCallError(err.message);
    }
  }, [getLocalStream, createPeerConnection, threadId]);

  // Accept an incoming call (called when we receive a webrtc-offer)
  const answerCall = useCallback(async (fromUserId: string, offer: RTCSessionDescriptionInit, customThreadId?: string) => {
    try {
      setCallError(null);
      const stream = await getLocalStream();
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(fromUserId, customThreadId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const activeThreadId = customThreadId || threadId;
      socket.emit('join-call', { threadId: activeThreadId });

      // Set the caller's offer as the remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create an answer and send it back
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc-answer', { threadId: activeThreadId, targetUserId: fromUserId, answer });

      setRemoteUserId(fromUserId);
      setIsInCall(true);
    } catch (err: any) {
      setCallError(err.message);
    }
  }, [getLocalStream, createPeerConnection, threadId]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { senderId, offer, threadId: callThreadId } = incomingCall;
    setIncomingCall(null);
    await answerCall(senderId, offer, callThreadId);
  }, [incomingCall, answerCall]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;
    const { threadId: callThreadId } = incomingCall;
    setIncomingCall(null);
    setRemoteUserId(null);
    socket.emit('leave-call', { threadId: callThreadId });
    socket.emit('end-call-session', { threadId: callThreadId });
  }, [incomingCall]);

  // End the call and clean up resources
  const endCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setIsInCall(false);
    setRemoteUserId(null);

    socket.emit('leave-call', { threadId });
    socket.emit('end-call-session', { threadId });
  }, [threadId]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
    socket.emit('toggle-audio', { threadId, isMuted: !isMuted });
  }, [isMuted, threadId]);

  // Toggle camera on/off
  const toggleVideo = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
    setIsVideoOff(!isVideoOff);
    socket.emit('toggle-video', { threadId, isVideoOff: !isVideoOff });
  }, [isVideoOff, threadId]);

  // Listen for incoming WebRTC signals from the socket server
  useEffect(() => {
    socket.on('webrtc-offer', async ({ senderId, offer, threadId: callThreadId }) => {
      setRemoteUserId(senderId);
      setIncomingCall({ senderId, offer, threadId: callThreadId });
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc-candidate', async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate', e);
        }
      }
    });

    socket.on('call-ended', () => {
      setIncomingCall(null);
      endCall();
    });

    return () => {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-candidate');
      socket.off('call-ended');
    };
  }, [endCall]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isInCall,
    remoteUserId,
    incomingCall,
    callError,
    startCall,
    endCall,
    acceptCall,
    declineCall,
    toggleMute,
    toggleVideo,
  };
}
