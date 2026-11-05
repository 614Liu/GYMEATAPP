import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, History, LogOut, Settings as SettingsIcon } from 'lucide-react';
import type { CloudUser } from '../../lib/cloud';

interface AppHeaderProps {
  /** 是否显示登录/头像区（国内版和登录状态未就绪时不显示） */
  showAccount: boolean;
  user: CloudUser | null;
  onLogin: () => void;
  onLogoutClick: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

/**
 * 头像。谷歌头像图片在请求带来源页信息（Referer）时会拒绝加载，所以关掉 Referer；
 * 仍然加载失败或没有头像时，显示邮箱首字母。
 */
function Avatar({ user }: { user: CloudUser }) {
  const [failed, setFailed] = useState(false);
  const initial = (user.email?.[0] ?? '?').toUpperCase();
  if (!user.photoURL || failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black" aria-label="头像">
        {initial}
      </div>
    );
  }
  return (
    <img
      src={user.photoURL}
      alt="头像"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
    />
  );
}

const iconButton ='p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-transparent hover:border-slate-200';

export function AppHeader({ showAccount, user, onLogin, onLogoutClick, onOpenLibrary, onOpenSettings }: AppHeaderProps) {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/20 px-4 py-3 shadow-[0_4px_20px_rgb(0,0,0,0.02)]"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-white/60">
          <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center text-white shadow-inner shrink-0">
            <Flame size={18} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">健食</h1>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold mt-0.5">by 614</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <AnimatePresence mode="wait">
            {showAccount && (
              user ? (
                <motion.div
                  key="user-profile"
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2"
                >
                  <Avatar user={user} />
                  <button onClick={onLogoutClick} className={iconButton} title="退出登录" aria-label="退出登录">
                    <LogOut size={20} />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="login-btn"
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  onClick={onLogin}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-600 transition-all border border-emerald-100 shadow-sm mr-1 sm:mr-2"
                  title="登录同步数据"
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">登录</span>
                </motion.button>
              )
            )}
          </AnimatePresence>
          <button onClick={onOpenLibrary} className={iconButton} title="食物库" aria-label="食物库">
            <History size={20} />
          </button>
          <button onClick={onOpenSettings} className={iconButton} title="设置" aria-label="设置">
            <SettingsIcon size={20} />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
