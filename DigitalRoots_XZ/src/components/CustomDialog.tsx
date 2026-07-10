import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function CustomDialog({
  isOpen,
  type,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: CustomDialogProps) {
  if (!isOpen) return null;

  const icons = {
    info: <Info className="text-blue-400" size={36} />,
    success: <CheckCircle className="text-emerald-400" size={36} />,
    warning: <AlertTriangle className="text-amber-500" size={36} />,
    error: <XCircle className="text-red-500" size={36} />,
  };

  const getThemeClass = () => {
    switch (type) {
      case 'warning':
        return 'bg-red-600 hover:bg-red-700';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-violet-600 hover:bg-violet-700';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
      <div 
        className="bg-stone-900 border rounded-3xl p-7 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-scale-up"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="mb-4 bg-stone-950/60 p-3 rounded-2xl border border-stone-800/50 shadow-inner">
          {icons[type]}
        </div>
        <h3 className="text-lg font-bold text-white mb-2 font-serif">
          {title}
        </h3>
        <p className="text-xs text-stone-400 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 w-full">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-stone-800 hover:bg-stone-800 rounded-2xl text-xs font-bold text-stone-300 transition-all cursor-pointer bg-stone-900/50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-grow py-3 rounded-2xl text-xs font-extrabold text-white transition-all cursor-pointer shadow-lg ${getThemeClass()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
