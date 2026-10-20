import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  size: number;
}

export const StarfallBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Create 45-degree falling stars
    // Falling from top-left toward bottom-right at 45 degrees (dx = dy)
    const starCount = 42;
    const stars: Star[] = [];

    const createStar = (initialY = -1): Star => {
      return {
        x: Math.random() * (width + height * 0.8) - height * 0.4,
        y: initialY >= 0 ? initialY : Math.random() * height,
        length: 12 + Math.random() * 28, // subtle star trail length
        speed: 0.35 + Math.random() * 0.65, // slow and smooth movement
        opacity: 0.15 + Math.random() * 0.65,
        size: 0.8 + Math.random() * 1.5,
      };
    };

    for (let i = 0; i < starCount; i++) {
      stars.push(createStar());
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 45 degrees direction vector: cos(45°) = sin(45°) ≈ 0.7071
      const cos45 = Math.SQRT1_2;
      const sin45 = Math.SQRT1_2;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Move 45 degrees downward
        star.x += star.speed * cos45;
        star.y += star.speed * sin45;

        // Reset if out of bounds
        if (star.y > height + 50 || star.x > width + 100) {
          stars[i] = createStar(-20);
        }

        // Draw star trail along 45 degree angle
        const tailX = star.x - star.length * cos45;
        const tailY = star.y - star.length * sin45;

        const gradient = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0)');
        gradient.addColorStop(0.6, `rgba(99, 102, 241, ${star.opacity * 0.4})`);
        gradient.addColorStop(1, `rgba(226, 232, 240, ${star.opacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(star.x, star.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = star.size;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Star head glow
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 opacity-80"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
