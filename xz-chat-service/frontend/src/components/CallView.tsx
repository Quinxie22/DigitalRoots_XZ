// ─────────────────────────────────────────────────────────────────────────────
// CallView.tsx
// The main video call panel (left side of the desktop view).
//
// HOW IT WORKS:
//   - Displays the remote user's video stream in a large panel labeled
//     "PRIMARY" (as in the mockup's "PRIMARY / Safe Work" label).
//   - The local user's video appears as a small Picture-in-Picture overlay.
//   - If WebRTC streams aren't connected yet, a gradient animated placeholder
//     is shown instead.
//   - Control bar at the bottom provides: Mute, Camera, End Call, Captions,
//     Volume buttons — each syncing its state to other participants via socket.
//   - A "LIVE" recording indicator pulses when isRecording is true.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Captions, Volume2, Radio,
} from 'lucide-react';
import { socket } from '../socket';

interface CallViewProps {
  localStream:      MediaStream | null;
  remoteStream:     MediaStream | null;
  isMuted:          boolean;
  isVideoOff:       boolean;
  isInCall:         boolean;
  threadId:         string;
  remoteName:       string;
  currentUserName:  string;
  onToggleMute:     () => void;
  onToggleVideo:    () => void;
  onEndCall:        () => void;
  onShowCaptions:   () => void;
  showCaptions:     boolean;
}

export default function CallView({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isInCall,
  threadId,
  remoteName,
  currentUserName,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onShowCaptions,
  showCaptions,
}: CallViewProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(true);

  // Attach streams to video elements when they change
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Sync recording state from socket
  useEffect(() => {
    socket.on('recording-toggled', ({ isRecording: r }: { isRecording: boolean }) => {
      setIsRecording(r);
    });
    return () => { socket.off('recording-toggled'); };
  }, []);

  const toggleRecording = () => {
    const next = !isRecording;
    setIsRecording(next);
    socket.emit('toggle-recording', { threadId, isRecording: next });
  };

  // Gradient placeholder when no video stream
  const NoStreamPlaceholder = ({ label, initials }: { label: string; initials: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1111 50%, #0a0a1a 100%)' }}>
      <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4"
           style={{ background: 'var(--primary)', boxShadow: '0 0 40px rgba(220,38,38,0.4)' }}>
        {initials}
      </div>
      <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        {isInCall ? 'Camera off' : 'Waiting for call...'}
      </p>
    </div>
  );

  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const hasMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  return (
    <div className="relative flex flex-col h-full select-none"
         style={{ background: '#000', flex: '1 1 0' }}>

      {/* Secure context warning banner */}
      {(!isSecure || !hasMedia) && (
        <div className="text-red-400 px-3 py-2 text-[10px] sm:text-xs flex items-center gap-2 z-40 border-b border-red-500/20"
             style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
          <span className="flex-shrink-0 text-sm">⚠️</span>
          <span className="flex-1 leading-normal">
            <strong>Microphone & Camera Blocked:</strong> Browser restricts media devices on insecure connections. Run on localhost or configure HTTPS/SSL to enable calling.
          </span>
        </div>
      )}

      {/* ── Remote Video (main view) ───────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <NoStreamPlaceholder
            label={isInCall ? remoteName : 'No active call'}
            initials={remoteName.slice(0, 2).toUpperCase()}
          />
        )}

        {/* LIVE / Recording badge */}
        {isInCall && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                 style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--online)' }} />
              LIVE
            </div>
            {isRecording && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                   style={{ background: 'rgba(220,38,38,0.8)' }}>
                <Radio size={11} />
                REC
              </div>
            )}
          </div>
        )}

        {/* Participant name overlay */}
        {isInCall && (
          <div className="absolute bottom-4 left-4">
            <div className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
                 style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
              {remoteName}
            </div>
          </div>
        )}

        {/* ── PiP: Local Video ─────────────────────────────────── */}
        {isInCall && (
          <div className="absolute bottom-4 right-4 w-32 h-24 rounded-2xl overflow-hidden shadow-2xl"
               style={{ border: '2px solid rgba(255,255,255,0.15)' }}>
            {localStream && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                   style={{ background: 'var(--bg-elevated)' }}>
                <span className="text-xl font-bold text-white">
                  {currentUserName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            {/* "You" label */}
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs text-white"
                 style={{ background: 'rgba(0,0,0,0.6)', fontSize: '10px' }}>
              You
            </div>
          </div>
        )}
      </div>

      {/* ── PRIMARY / Safe Work labels ───────────────────────────── */}
      {!isInCall && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-6xl font-black tracking-widest opacity-20"
               style={{ color: 'var(--text-primary)' }}>
            PRIMARY
          </div>
          <div className="text-lg font-semibold tracking-widest opacity-20 mt-2"
               style={{ color: 'var(--text-secondary)' }}>
            Safe Work
          </div>
        </div>
      )}

      {/* ── Control Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 py-2 sm:py-4 px-2 sm:px-4"
           style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}>

        {/* Mute */}
        <ControlBtn
          onClick={onToggleMute}
          active={isMuted}
          activeColor="var(--primary)"
          title={isMuted ? 'Unmute' : 'Mute'}
          icon={isMuted ? <MicOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />}
          label={isMuted ? 'Muted' : 'Mute'}
        />

        {/* Camera */}
        <ControlBtn
          onClick={onToggleVideo}
          active={isVideoOff}
          activeColor="var(--primary)"
          title={isVideoOff ? 'Show Camera' : 'Hide Camera'}
          icon={isVideoOff ? <VideoOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Video size={16} className="sm:w-[18px] sm:h-[18px]" />}
          label="Camera"
        />

        {/* End Call */}
        <button
          onClick={onEndCall}
          className="flex flex-col items-center gap-0.5 sm:gap-1 px-3 sm:px-5 py-1.5 sm:py-3 rounded-xl sm:rounded-2xl text-white font-semibold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--primary)', boxShadow: '0 4px 16px rgba(220,38,38,0.5)' }}
          title="End Call">
          <PhoneOff size={16} className="sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-xs">End</span>
        </button>

        {/* Captions */}
        <ControlBtn
          onClick={onShowCaptions}
          active={showCaptions}
          activeColor="#7c3aed"
          title="Toggle Captions"
          icon={<Captions size={16} className="sm:w-[18px] sm:h-[18px]" />}
          label="Captions"
        />

        {/* Volume */}
        <ControlBtn
          onClick={() => setVolume(!volume)}
          active={!volume}
          activeColor="var(--primary)"
          title="Toggle Volume"
          icon={<Volume2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
          label="Volume"
        />

        {/* Recording */}
        <ControlBtn
          onClick={toggleRecording}
          active={isRecording}
          activeColor="#dc2626"
          title={isRecording ? 'Stop Recording' : 'Record'}
          icon={<Radio size={16} className="sm:w-[18px] sm:h-[18px]" />}
          label={isRecording ? 'Stop' : 'Rec'}
        />
      </div>
    </div>
  );
}

// Reusable control button
function ControlBtn({
  onClick, active, activeColor, title, icon, label,
}: {
  onClick: () => void;
  active: boolean;
  activeColor: string;
  title: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all hover:scale-105 active:scale-95"
      style={{
        background: active ? activeColor : 'rgba(255,255,255,0.08)',
        color: 'white',
        border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
        minWidth: '44px',
      }}
      title={title}>
      {icon}
      <span className="text-[8px] sm:text-[10px] font-semibold">{label}</span>
    </button>
  );
}
