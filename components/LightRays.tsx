import React, { useEffect, useRef, useState, useCallback } from 'react';

interface LightRaysProps {
  raysOrigin?: 'top-center' | 'top-left' | 'top-right' | 'right' | 'left' | 'bottom-center';
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  className?: string;
}

export const LightRays: React.FC<LightRaysProps> = ({
  raysOrigin = 'top-center',
  raysColor = '#ffffff',
  raysSpeed = 1,
  lightSpread = 0.5,
  rayLength = 1.0,
  pulsating = false,
  fadeDistance = 1.0,
  saturation = 1,
  followMouse = false,
  mouseInfluence = 0.1,
  noiseAmount = 0,
  distortion = 0,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!followMouse || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [followMouse]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateRays = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const centerX = width / 2;
      const maxRadius = Math.sqrt(width * width + height * height) * rayLength;

      ctx.clearRect(0, 0, width, height);

      const hueMatch = raysColor.match(/hsl\((\d+)/);
      const baseHue = hueMatch ? parseInt(hueMatch[1]) : 0;

      for (let i = 0; i < 80; i++) {
        const baseAngle = (Math.random() - 0.5) * Math.PI * lightSpread * 2;
        const mouseOffsetX = (mousePos.x - centerX) * mouseInfluence * 0.01;
        const angle = baseAngle + (mouseOffsetX / width) * Math.PI * 0.5;
        const x = centerX + Math.tan(angle) * height;

        if (x < -100 || x > width + 100) continue;

        const rayWidth = Math.random() * 20 + 8;
        const opacity = (Math.random() * 0.15 + 0.05) * saturation;

        const rayGradient = ctx.createLinearGradient(x, 0, x, height);
        rayGradient.addColorStop(0, `hsla(${baseHue}, 60%, 80%, ${opacity})`);
        rayGradient.addColorStop(0.2, `hsla(${baseHue}, 50%, 60%, ${opacity * 0.7})`);
        rayGradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - rayWidth / 2, 0);
        ctx.lineTo(x + rayWidth / 2, 0);
        ctx.lineTo(x + rayWidth * 1.5 + Math.random() * 30, height);
        ctx.lineTo(x - rayWidth * 1.5 - Math.random() * 30, height);
        ctx.closePath();
        ctx.fillStyle = rayGradient;
        ctx.fill();
        ctx.restore();
      }

      container.innerHTML = '';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);
    };

    updateRays();

    let animationId: number;
    if (pulsating) {
      const animate = () => {
        updateRays();
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);
    }

    const resizeObserver = new ResizeObserver(() => {
      updateRays();
    });

    resizeObserver.observe(container);

    if (followMouse) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      resizeObserver.disconnect();
      if (followMouse) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [raysColor, lightSpread, rayLength, pulsating, saturation, followMouse, mouseInfluence, handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className={`light-rays-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0f1020 50%, #050510 100%)',
      }}
    />
  );
};

export default LightRays;
