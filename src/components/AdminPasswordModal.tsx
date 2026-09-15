import React, { useState } from 'react';
import { Shield, Lock, X, ArrowRight, AlertCircle } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Required password is "2026"
    if (password === '2026') {
      setPassword('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPassword('');
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border-2 border-sky-200 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Icon & Title */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-sky-100 border-2 border-sky-300 text-sky-700 mx-auto flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-jua text-2xl text-slate-800">
            선생님 모드 비밀번호
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            퀴즈를 관리하고 제어하기 위해 암호를 입력해주세요.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              {/* type="password" ensures text is masked and never visible on screen */}
              <input
                id="admin-password-input"
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={10}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="비밀번호 입력"
                className={`w-full px-4 py-3.5 text-center tracking-widest text-2xl font-bold rounded-2xl bg-slate-50 border-2 focus:outline-none transition-all placeholder:text-sm placeholder:font-normal placeholder:tracking-normal ${
                  error
                    ? 'border-rose-400 focus:border-rose-500 bg-rose-50/50 text-rose-800'
                    : 'border-sky-200 focus:border-sky-500 focus:bg-white text-slate-800'
                }`}
              />
            </div>
            {error && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>비밀번호가 올바르지 않습니다. 다시 입력해주세요.</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-jua text-base transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              id="admin-password-submit-btn"
              type="submit"
              disabled={!password}
              className={`flex-1 py-3 rounded-xl font-jua text-base text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                password
                  ? 'bg-sky-600 hover:bg-sky-700 active:scale-98'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>확인</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
