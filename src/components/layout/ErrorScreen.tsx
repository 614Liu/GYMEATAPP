import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * 应用崩溃时的兜底页面：给用户看能懂的话和一个「重新加载」按钮，
 * 技术细节收在折叠区里，反馈问题时可以展开截图。
 * 数据都在本机存储或云端，重新加载不会丢。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 text-center space-y-5">
          <div className="text-4xl" aria-hidden>😵</div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">出了点问题</h1>
            <p className="text-sm text-slate-500">你的记录都还在，重新加载一下就好。</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-black active:scale-95 transition-transform"
          >
            重新加载
          </button>
          <details className="text-left">
            <summary className="text-xs text-slate-400 cursor-pointer">技术细节（反馈问题时可截图）</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-slate-400 bg-slate-50 rounded-xl p-3 select-text">
              {String(error)}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
