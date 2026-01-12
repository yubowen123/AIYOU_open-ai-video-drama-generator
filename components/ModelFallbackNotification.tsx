/**
 * 模型降级通知组件
 * 当系统自动切换模型时，显示友好提示
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface FallbackEvent {
  category: string;
  from: string;
  to: string;
  reason: string;
}

interface Notification {
  id: string;
  category: string;
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  image: '图片生成',
  video: '视频生成',
  text: '文本生成',
  audio: '音频生成'
};

const CATEGORY_COLORS: Record<string, string> = {
  image: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  video: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  text: 'bg-green-500/20 border-green-500/50 text-green-300',
  audio: 'bg-orange-500/20 border-orange-500/50 text-orange-300'
};

export const ModelFallbackNotification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const handleFallback = (event: CustomEvent<FallbackEvent>) => {
      const { category, from, to, reason } = event.detail;

      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        category,
        from,
        to,
        reason,
        timestamp: Date.now()
      };

      setNotifications(prev => [...prev, notification]);

      // 5秒后自动移除
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    };

    // 监听模型降级事件
    window.addEventListener('model-fallback', handleFallback as EventListener);

    return () => {
      window.removeEventListener('model-fallback', handleFallback as EventListener);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`pointer-events-auto min-w-[320px] max-w-[400px] p-3 rounded-lg border backdrop-blur-md shadow-xl animate-in slide-in-from-right duration-300 ${CATEGORY_COLORS[notification.category] || 'bg-white/10'}`}
        >
          <div className="flex items-start gap-3">
            {/* 图标 */}
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle size={16} />
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {CATEGORY_LABELS[notification.category] || notification.category}
                </span>
                <span className="text-[9px] opacity-60">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed">
                模型 <span className="font-mono font-bold">{notification.from}</span> {notification.reason === '配额用完' ? '额度用完' : '调用失败'}，
                已自动切换至 <span className="font-mono font-bold">{notification.to}</span>
              </p>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 单个降级通知（用于内嵌显示）
 */
export const FallbackAlert: React.FC<{
  from: string;
  to: string;
  reason: string;
  category: string;
  onDismiss?: () => void;
}> = ({ from, to, reason, category, onDismiss }) => {
  const colorClass = CATEGORY_COLORS[category] || 'bg-white/10';

  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[11px] font-medium mb-1">
            模型自动降级
          </p>
          <p className="text-[10px] leading-relaxed opacity-90">
            <span className="font-mono">{from}</span> {reason === '配额用完' ? '配额用完' : '不可用'}
            <br />
            已切换至 <span className="font-mono font-bold">{to}</span>
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
