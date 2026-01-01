"use client";

import { useEffect, useRef, useState } from "react";

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  active: boolean;
  points: number;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
}

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface BallTrail {
  x: number;
  y: number;
  alpha: number;
}

interface ScorePopup {
  x: number;
  y: number;
  value: number;
  alpha: number;
  vy: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

type GameState = "ready" | "playing" | "paused" | "gameOver" | "win";

const ArkanoidGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const animationFrameRef = useRef<number>();
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const PADDLE_WIDTH = 120;
  const PADDLE_HEIGHT = 15;
  const BALL_RADIUS = 8;
  const BRICK_ROWS = 6;
  const BRICK_COLS = 10;
  const BRICK_WIDTH = 70;
  const BRICK_HEIGHT = 25;
  const BRICK_PADDING = 10;
  const BRICK_OFFSET_TOP = 80;
  const BRICK_OFFSET_LEFT = 35;

  // Visual effects
  const particles = useRef<Particle[]>([]);
  const ballTrail = useRef<BallTrail[]>([]);
  const scorePopups = useRef<ScorePopup[]>([]);
  const stars = useRef<Star[]>([]);
  const time = useRef(0);

  // Game objects refs
  const paddle = useRef<Paddle>({
    x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
    y: CANVAS_HEIGHT - 40,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    speed: 8,
  });

  const ball = useRef<Ball>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    dx: 4,
    dy: -4,
    radius: BALL_RADIUS,
  });

  const bricks = useRef<Brick[]>([]);

  // Initialize stars for background
  const initStars = () => {
    const newStars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      newStars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2,
        alpha: Math.random(),
        twinkleSpeed: 0.01 + Math.random() * 0.02,
      });
    }
    stars.current = newStars;
  };

  // Initialize bricks
  const initBricks = () => {
    const colors = [
      "#FF6B6B", // Red
      "#4ECDC4", // Teal
      "#45B7D1", // Blue
      "#FFA07A", // Orange
      "#98D8C8", // Mint
      "#FFD93D", // Yellow
    ];
    const newBricks: Brick[] = [];

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        newBricks.push({
          x: col * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
          y: row * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          color: colors[row % colors.length],
          active: true,
          points: (BRICK_ROWS - row) * 10,
        });
      }
    }

    bricks.current = newBricks;
  };

  // Create particle explosion
  const createParticles = (x: number, y: number, color: string, count = 15) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;
      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  };

  // Create score popup
  const createScorePopup = (x: number, y: number, value: number) => {
    scorePopups.current.push({
      x,
      y,
      value,
      alpha: 1,
      vy: -1.5,
    });
  };

  // Reset ball position
  const resetBall = () => {
    ball.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: 4 * (Math.random() > 0.5 ? 1 : -1),
      dy: -4,
      radius: BALL_RADIUS,
    };
    ballTrail.current = [];
  };

  // Reset game
  const resetGame = () => {
    setScore(0);
    setLives(3);
    initBricks();
    resetBall();
    paddle.current.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    particles.current = [];
    scorePopups.current = [];
    setGameState("ready");
  };

  // Draw starfield background
  const drawStarfield = (ctx: CanvasRenderingContext2D) => {
    stars.current.forEach((star) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);

      // Twinkling effect
      star.alpha += star.twinkleSpeed;
      if (star.alpha > 1 || star.alpha < 0.2) {
        star.twinkleSpeed = -star.twinkleSpeed;
      }
    });
  };

  // Draw ball with trail and glow
  const drawBall = (ctx: CanvasRenderingContext2D) => {
    const b = ball.current;

    // Draw trail
    ballTrail.current.forEach((trail, index) => {
      const alpha = trail.alpha * (index / ballTrail.current.length);
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, b.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(147, 197, 253, ${alpha * 0.5})`;
      ctx.fill();
    });

    // Outer glow
    const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3);
    gradient.addColorStop(0, "rgba(147, 197, 253, 0.8)");
    gradient.addColorStop(0.5, "rgba(147, 197, 253, 0.3)");
    gradient.addColorStop(1, "rgba(147, 197, 253, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Main ball with gradient
    const ballGradient = ctx.createRadialGradient(
      b.x - b.radius * 0.3,
      b.y - b.radius * 0.3,
      0,
      b.x,
      b.y,
      b.radius
    );
    ballGradient.addColorStop(0, "#FFFFFF");
    ballGradient.addColorStop(0.7, "#93C5FD");
    ballGradient.addColorStop(1, "#3B82F6");

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient;
    ctx.fill();

    // Shine effect
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
  };

  // Draw paddle with 3D effect
  const drawPaddle = (ctx: CanvasRenderingContext2D) => {
    const p = paddle.current;

    // Shadow/glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#6366F1";

    // Main gradient
    const gradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    gradient.addColorStop(0, "#818CF8");
    gradient.addColorStop(0.5, "#6366F1");
    gradient.addColorStop(1, "#4F46E5");

    ctx.fillStyle = gradient;
    ctx.fillRect(p.x, p.y, p.width, p.height);

    // Top highlight
    const highlightGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height * 0.4);
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(p.x, p.y, p.width, p.height * 0.4);

    // Border
    ctx.strokeStyle = "#A5B4FC";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.width, p.height);

    ctx.shadowBlur = 0;
  };

  // Draw bricks with 3D effect
  const drawBricks = (ctx: CanvasRenderingContext2D) => {
    bricks.current.forEach((brick) => {
      if (brick.active) {
        // Shadow for depth
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.width, brick.height);

        // Main brick with gradient
        const gradient = ctx.createLinearGradient(
          brick.x,
          brick.y,
          brick.x,
          brick.y + brick.height
        );

        // Parse color and create lighter/darker variants
        const color = brick.color;
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, adjustBrightness(color, -20));

        ctx.fillStyle = gradient;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

        // Top highlight for 3D effect
        const highlightGradient = ctx.createLinearGradient(
          brick.x,
          brick.y,
          brick.x,
          brick.y + brick.height * 0.3
        );
        highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
        highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height * 0.3);

        // Border with glow
        ctx.strokeStyle = adjustBrightness(color, 40);
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);

        // Inner border for depth
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
      }
    });
  };

  // Helper function to adjust color brightness
  const adjustBrightness = (color: string, amount: number): string => {
    const hex = color.replace("#", "");
    const r = Math.min(255, Math.max(0, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(hex.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  // Draw particles
  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particles.current.forEach((particle, index) => {
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.life;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.globalAlpha = 1;

      // Update particle
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // Gravity
      particle.life -= 1 / (particle.maxLife * 60);

      if (particle.life <= 0) {
        particles.current.splice(index, 1);
      }
    });
  };

  // Draw score popups
  const drawScorePopups = (ctx: CanvasRenderingContext2D) => {
    scorePopups.current.forEach((popup, index) => {
      ctx.fillStyle = `rgba(255, 215, 0, ${popup.alpha})`;
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`+${popup.value}`, popup.x, popup.y);

      // Update popup
      popup.y += popup.vy;
      popup.alpha -= 0.02;

      if (popup.alpha <= 0) {
        scorePopups.current.splice(index, 1);
      }
    });
    ctx.textAlign = "left";
  };

  // Draw enhanced UI
  const drawUI = (ctx: CanvasRenderingContext2D) => {
    // HUD background
    ctx.fillStyle = "rgba(15, 15, 35, 0.8)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, 60);

    // Score
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px Arial";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#60A5FA";
    ctx.fillText(`SCORE: ${score}`, 30, 40);

    // Lives
    ctx.fillText(`LIVES: ${lives}`, CANVAS_WIDTH - 180, 40);
    ctx.shadowBlur = 0;

    // Draw life icons
    for (let i = 0; i < lives; i++) {
      const heartX = CANVAS_WIDTH - 150 + i * 35;
      const heartY = 25;

      ctx.fillStyle = "#EF4444";
      ctx.beginPath();
      ctx.arc(heartX, heartY, 6, 0, Math.PI * 2);
      ctx.arc(heartX + 12, heartY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(heartX - 6, heartY);
      ctx.lineTo(heartX + 6, heartY + 12);
      ctx.lineTo(heartX + 18, heartY);
      ctx.fill();
    }
  };

  // Draw game state with enhanced effects
  const drawGameState = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const pulse = Math.sin(time.current * 0.05) * 0.3 + 0.7;

    ctx.textAlign = "center";

    if (gameState === "ready") {
      // Animated title
      ctx.shadowBlur = 30 * pulse;
      ctx.shadowColor = "#60A5FA";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 72px Arial";
      ctx.fillText("ARKANOID", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

      ctx.shadowBlur = 15;
      ctx.font = "28px Arial";
      ctx.fillStyle = `rgba(147, 197, 253, ${pulse})`;
      ctx.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

      ctx.shadowBlur = 0;
      ctx.font = "20px Arial";
      ctx.fillStyle = "#9CA3AF";
      ctx.fillText("Use ← → or A D to move paddle", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    } else if (gameState === "paused") {
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#F59E0B";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 64px Arial";
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      ctx.shadowBlur = 10;
      ctx.font = "24px Arial";
      ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
      ctx.fillText("Press SPACE to continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
    } else if (gameState === "gameOver") {
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#EF4444";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 64px Arial";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      ctx.shadowBlur = 15;
      ctx.font = "32px Arial";
      ctx.fillStyle = "#FCA5A5";
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

      ctx.shadowBlur = 10;
      ctx.font = "24px Arial";
      ctx.fillStyle = `rgba(252, 165, 165, ${pulse})`;
      ctx.fillText("Press R to restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
    } else if (gameState === "win") {
      ctx.shadowBlur = 40;
      ctx.shadowColor = "#10B981";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 72px Arial";
      ctx.fillText("YOU WIN!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      ctx.shadowBlur = 20;
      ctx.font = "32px Arial";
      ctx.fillStyle = "#6EE7B7";
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

      ctx.shadowBlur = 10;
      ctx.font = "24px Arial";
      ctx.fillStyle = `rgba(110, 231, 183, ${pulse})`;
      ctx.fillText("Press R to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
  };

  // Collision detection
  const checkBallBrickCollision = () => {
    const b = ball.current;

    for (let i = 0; i < bricks.current.length; i++) {
      const brick = bricks.current[i];

      if (brick.active) {
        if (
          b.x + b.radius > brick.x &&
          b.x - b.radius < brick.x + brick.width &&
          b.y + b.radius > brick.y &&
          b.y - b.radius < brick.y + brick.height
        ) {
          const ballCenterX = b.x;
          const ballCenterY = b.y;
          const brickCenterX = brick.x + brick.width / 2;
          const brickCenterY = brick.y + brick.height / 2;

          const dx = ballCenterX - brickCenterX;
          const dy = ballCenterY - brickCenterY;

          const width = (brick.width + b.radius * 2) / 2;
          const height = (brick.height + b.radius * 2) / 2;
          const crossWidth = width * dy;
          const crossHeight = height * dx;

          if (Math.abs(crossWidth) > Math.abs(crossHeight)) {
            b.dy = -b.dy;
          } else {
            b.dx = -b.dx;
          }

          brick.active = false;
          setScore((prev) => prev + brick.points);

          // Visual effects
          createParticles(brickCenterX, brickCenterY, brick.color);
          createScorePopup(brickCenterX, brickCenterY, brick.points);

          break;
        }
      }
    }
  };

  const checkBallPaddleCollision = () => {
    const b = ball.current;
    const p = paddle.current;

    if (
      b.x + b.radius > p.x &&
      b.x - b.radius < p.x + p.width &&
      b.y + b.radius > p.y &&
      b.y - b.radius < p.y + p.height
    ) {
      const hitPosition = (b.x - p.x) / p.width;
      const angle = (hitPosition - 0.5) * Math.PI * 0.6;
      const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);

      b.dx = Math.sin(angle) * speed;
      b.dy = -Math.abs(Math.cos(angle) * speed);
      b.y = p.y - b.radius;

      // Create small particle effect on paddle hit
      createParticles(b.x, p.y, "#818CF8", 5);
    }
  };

  // Update game
  const update = () => {
    time.current++;

    if (gameState !== "playing") return;

    const b = ball.current;
    const p = paddle.current;

    // Add to ball trail
    ballTrail.current.push({ x: b.x, y: b.y, alpha: 1 });
    if (ballTrail.current.length > 15) {
      ballTrail.current.shift();
    }
    ballTrail.current.forEach((trail, i) => {
      trail.alpha = i / ballTrail.current.length;
    });

    // Move ball
    b.x += b.dx;
    b.y += b.dy;

    // Ball collision with walls
    if (b.x + b.radius > CANVAS_WIDTH || b.x - b.radius < 0) {
      b.dx = -b.dx;
      createParticles(b.x, b.y, "#93C5FD", 8);
    }

    if (b.y - b.radius < 60) {
      b.dy = -b.dy;
      createParticles(b.x, b.y, "#93C5FD", 8);
    }

    // Ball falls below paddle
    if (b.y - b.radius > CANVAS_HEIGHT) {
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameState("gameOver");
        } else {
          resetBall();
          setGameState("ready");
        }
        return newLives;
      });
    }

    // Move paddle
    if (keysPressed.current["ArrowLeft"] || keysPressed.current["a"]) {
      p.x -= p.speed;
    }
    if (keysPressed.current["ArrowRight"] || keysPressed.current["d"]) {
      p.x += p.speed;
    }

    // Keep paddle in bounds
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > CANVAS_WIDTH) p.x = CANVAS_WIDTH - p.width;

    // Check collisions
    checkBallPaddleCollision();
    checkBallBrickCollision();

    // Check win condition
    const activeBricks = bricks.current.filter((b) => b.active).length;
    if (activeBricks === 0) {
      setGameState("win");
    }
  };

  // Render
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, "#0F0F23");
    bgGradient.addColorStop(0.5, "#1a1a3e");
    bgGradient.addColorStop(1, "#0F0F23");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw starfield
    drawStarfield(ctx);

    // Draw game objects
    drawBricks(ctx);
    drawParticles(ctx);
    drawPaddle(ctx);
    drawBall(ctx);
    drawScorePopups(ctx);
    drawUI(ctx);

    // Draw game state overlay
    if (gameState !== "playing") {
      drawGameState(ctx);
    }
  };

  // Game loop
  const gameLoop = () => {
    update();
    render();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (gameState === "ready") {
          setGameState("playing");
        } else if (gameState === "playing") {
          setGameState("paused");
        } else if (gameState === "paused") {
          setGameState("playing");
        }
      }

      if (e.key === "r" || e.key === "R") {
        if (gameState === "gameOver" || gameState === "win") {
          resetGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // Initialize game
  useEffect(() => {
    initStars();
    initBricks();
    gameLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Restart game loop when game state changes
  useEffect(() => {
    if (gameState === "playing" && !animationFrameRef.current) {
      gameLoop();
    }
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-6">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-4 border-indigo-500 rounded-lg shadow-2xl shadow-indigo-500/50"
        style={{
          boxShadow: "0 0 40px rgba(99, 102, 241, 0.5), 0 0 80px rgba(99, 102, 241, 0.3)",
        }}
      />
      <div className="text-white text-center bg-slate-900/50 px-6 py-3 rounded-lg border border-indigo-500/30">
        <p className="text-sm font-medium text-slate-300">
          <span className="text-indigo-400">Controls:</span> Arrow Keys or A/D{" "}
          <span className="mx-2 text-slate-600">|</span>
          <span className="text-indigo-400">Space:</span> Start/Pause{" "}
          <span className="mx-2 text-slate-600">|</span>
          <span className="text-indigo-400">R:</span> Restart
        </p>
      </div>
    </div>
  );
};

export default ArkanoidGame;
