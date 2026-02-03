import React, { useEffect, useRef, useState, useCallback } from 'react';

interface GalaxyProps {
  focal?: [number, number];
  rotation?: [number, number];
  starSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  speed?: number;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  saturation?: number;
  mouseRepulsion?: boolean;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  repulsionStrength?: number;
  autoCenterRepulsion?: number;
  transparent?: boolean;
  className?: string;
}

export const Galaxy: React.FC<GalaxyProps> = ({
  focal = [0.5, 0.5],
  rotation = [1.0, 0.0],
  starSpeed = 0.5,
  density = 1,
  hueShift = 140,
  disableAnimation = false,
  speed = 1.0,
  mouseInteraction = true,
  glowIntensity = 0.3,
  saturation = 0.0,
  mouseRepulsion = true,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  repulsionStrength = 2,
  autoCenterRepulsion = 0,
  transparent = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const starsRef = useRef<Array<{
    x: number;
    y: number;
    size: number;
    hue: number;
    brightness: number;
    twinkle: number;
    angle: number;
    radius: number;
    speed: number;
  }>>([]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const starCount = Math.floor(150 * density);

    const stars: Array<{
      x: number;
      y: number;
      size: number;
      hue: number;
      brightness: number;
      twinkle: number;
      angle: number;
      radius: number;
      speed: number;
    }> = [];

    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(width, height) * 0.6;
      stars.push({
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        size: Math.random() * 1.5 + 0.5,
        hue: Math.random() * 60 + hueShift,
        brightness: Math.random() * 0.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
        angle,
        radius,
        speed: (Math.random() * 0.5 + 0.5) * starSpeed,
      });
    }
    starsRef.current = stars;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    container.innerHTML = '';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    let animationId: number;
    let rotationAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (!disableAnimation) {
        rotationAngle += rotationSpeed * speed;
      }

      const centerX = width * focal[0];
      const centerY = height * focal[1];

      const stars = starsRef.current;
      const time = Date.now() * 0.001 * starSpeed;

      stars.forEach((star, index) => {
        let x = centerX + Math.cos(star.angle + rotationAngle) * star.radius;
        let y = centerY + Math.sin(star.angle + rotationAngle) * star.radius;

        if (mouseInteraction && isHovered) {
          const dx = x - mousePos.x;
          const dy = y - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150 && dist > 0) {
            const force = (150 - dist) / 150 * repulsionStrength;
            if (autoCenterRepulsion > 0) {
              const centerDx = centerX - x;
              const centerDy = centerY - y;
              const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
              x += (centerDx / centerDist) * autoCenterRepulsion;
              y += (centerDy / centerDist) * autoCenterRepulsion;
            } else {
              x += (dx / dist) * force * 20;
              y += (dy / dist) * force * 20;
            }
          }
        }

        const twinkleFactor = 0.7 + Math.sin(time * 2 + star.twinkle) * twinkleIntensity * 0.3;
        const brightness = star.brightness * twinkleFactor;

        const hue = (star.hue + hueShift) % 360;
        const saturationValue = saturation * 100;

        const glowSize = star.size * (1 + glowIntensity * 2);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        gradient.addColorStop(0, `hsla(${hue}, ${saturationValue}%, ${brightness * 80}%, ${brightness})`);
        gradient.addColorStop(0.5, `hsla(${hue}, ${saturationValue}%, ${brightness * 50}%, ${brightness * 0.5})`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturationValue}%, ${brightness * 30}%, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, star.size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${saturationValue}%, ${brightness * 100}%, ${brightness})`;
        ctx.fill();
      });

      if (!disableAnimation) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = container.offsetWidth;
      const newHeight = container.offsetHeight;
      canvas.width = newWidth;
      canvas.height = newHeight;
      render();
    });

    resizeObserver.observe(container);

    if (mouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseenter', () => setIsHovered(true));
      container.addEventListener('mouseleave', () => setIsHovered(false));
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      resizeObserver.disconnect();
      if (mouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseenter', () => setIsHovered(true));
        container.removeEventListener('mouseleave', () => setIsHovered(false));
      }
    };
  }, [
    focal, rotation, starSpeed, density, hueShift, disableAnimation, speed,
    mouseInteraction, glowIntensity, saturation, mouseRepulsion, twinkleIntensity,
    rotationSpeed, repulsionStrength, autoCenterRepulsion, handleMouseMove
  ]);

  return (
    <div
      ref={containerRef}
      className={`galaxy-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: transparent ? 'transparent' : 'linear-gradient(180deg, #050510 0%, #0a0a15 50%, #000005 100%)',
      }}
    />
  );
};

export default Galaxy;
