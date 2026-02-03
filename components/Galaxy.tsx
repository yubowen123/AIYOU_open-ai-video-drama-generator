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
  transparent = false,
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
    spiralAngle: number;
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
    const starCount = Math.floor(350 * density);

    const stars: Array<{
      x: number;
      y: number;
      size: number;
      hue: number;
      brightness: number;
      twinkle: number;
      angle: number;
      radius: number;
      spiralAngle: number;
      speed: number;
    }> = [];

    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spiralAngle = Math.random() * Math.PI * 8;
      const radius = Math.random() * Math.min(width, height) * 0.6;
      
      stars.push({
        x: 0,
        y: 0,
        size: Math.random() * 1.8 + 0.5,
        hue: Math.random() * 30 + hueShift - 15,
        brightness: Math.random() * 0.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
        angle,
        radius,
        spiralAngle,
        speed: (Math.random() * 0.6 + 0.4) * starSpeed,
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
    canvas.style.opacity = '1';
    container.appendChild(canvas);

    let animationId: number;
    let globalRotation = 0;
    let globalTime = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (!disableAnimation) {
        globalTime += 0.016 * speed;
        globalRotation += rotationSpeed * 0.3 * speed;
      }

      const centerX = width * focal[0];
      const centerY = height * focal[1];

      const stars = starsRef.current;

      stars.forEach((star, index) => {
        const currentAngle = star.angle + globalRotation * star.speed + star.spiralAngle * 0.1;
        const currentRadius = star.radius + Math.sin(globalTime * star.speed) * 5;
        
        let x = centerX + Math.cos(currentAngle) * currentRadius;
        let y = centerY + Math.sin(currentAngle) * currentRadius;

        if (mouseInteraction && isHovered && mouseRepulsion) {
          const dx = x - mousePos.x;
          const dy = y - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 300 && dist > 0) {
            const force = Math.pow((300 - dist) / 300, 2) * repulsionStrength * 2;
            if (autoCenterRepulsion > 0) {
              const centerDx = centerX - x;
              const centerDy = centerY - y;
              const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
              x += (centerDx / centerDist) * autoCenterRepulsion;
              y += (centerDy / centerDist) * autoCenterRepulsion;
            } else {
              x += (dx / dist) * force * 50;
              y += (dy / dist) * force * 50;
            }
          }
        }

        const twinkleFactor = 0.4 + Math.sin(globalTime * 2 + star.twinkle) * twinkleIntensity;
        const brightness = Math.min(1, star.brightness * twinkleFactor);

        const hue = (star.hue + hueShift * 0.5) % 360;
        const saturationValue = Math.min(80, saturation * 80);

        const glowSize = star.size * (5 + glowIntensity * 15);
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        gradient.addColorStop(0, `hsla(${hue}, ${saturationValue}%, ${brightness * 100}%, ${brightness})`);
        gradient.addColorStop(0.15, `hsla(${hue}, ${saturationValue}%, ${brightness * 80}%, ${brightness * 0.8})`);
        gradient.addColorStop(0.4, `hsla(${hue}, ${saturationValue}%, ${brightness * 60}%, ${brightness * 0.5})`);
        gradient.addColorStop(0.7, `hsla(${hue}, ${saturationValue}%, ${brightness * 40}%, ${brightness * 0.2})`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturationValue}%, ${brightness * 20}%, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, star.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${saturationValue}%, ${Math.min(100, brightness * 95)}%, ${brightness})`;
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
        background: transparent 
        ? 'transparent'
        : '#000000',
      }}
    />
  );
};

export default Galaxy;
