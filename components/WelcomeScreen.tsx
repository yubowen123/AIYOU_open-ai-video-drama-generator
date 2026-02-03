/**
 * AIYOU 漫剧生成平台 - 欢迎屏幕组件
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

// components/WelcomeScreen.tsx
import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { useLanguage } from '../src/i18n/LanguageContext';
import { Galaxy } from './Galaxy';

interface WelcomeScreenProps {
  visible: boolean;
}

/**
 * 欢迎屏幕组件
 * 在画布为空时显示
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ visible }) => {
  const { t } = useLanguage();

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 pointer-events-none ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
      }`}
    >
      {/* 背景星空 */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Galaxy
          focal={[0.5, 0.5]}
          rotation={[1.0, 0.0]}
          starSpeed={0.5}
          density={1}
          hueShift={140}
          disableAnimation={false}
          speed={1.0}
          mouseInteraction={true}
          glowIntensity={0.3}
          saturation={0.0}
          mouseRepulsion={true}
          twinkleIntensity={0.3}
          rotationSpeed={0.1}
          repulsionStrength={2}
          autoCenterRepulsion={0}
          transparent={false}
        />
      </div>

      {/* 标题 */}
      <div className="flex flex-col items-center justify-center mb-10 select-none animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="relative mb-8">
          <img
            src="/logo.png"
            alt="AIYOU Logo"
            className="h-40 md:h-52 object-contain drop-shadow-2xl"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          <span className="text-xl md:text-2xl font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 animate-pulse">
            {t.welcome}
          </span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent via-cyan-500/50 to-transparent"></div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="flex items-center gap-2 mb-6 text-zinc-500 text-xs font-medium tracking-wide opacity-60">
        <div className="px-1.5 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-[10px] flex items-center gap-1">
          <MousePointerClick size={10} />
          <span>{t.actions.doubleClick}</span>
        </div>
        <span>{t.actions.canvasHint}</span>
      </div>
    </div>
  );
};
