# Arkanoid Game

A modern, visually enhanced recreation of the classic Arkanoid/Breakout game built with Next.js 14, TypeScript, and HTML5 Canvas.

![Arkanoid Game](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Features

### Gameplay
- **Classic Arkanoid mechanics** - Break all the bricks with the ball
- **60 colorful bricks** arranged in 6 rows with different point values
- **3 lives system** - Don't let the ball fall!
- **Physics-based ball movement** - Ball angle changes based on paddle hit position
- **Score tracking** - Higher rows are worth more points

### Visual Effects
- **Particle explosions** when bricks are destroyed
- **Ball trail effect** for better visual feedback
- **3D brick styling** with shadows and highlights
- **Twinkling starfield** background
- **Glowing UI elements** with shadow effects
- **Score popups** that animate when breaking bricks
- **Pulsing animations** on menu screens
- **Smooth gradients** and color schemes

### Game States
- **Ready Screen** - Instructions and controls
- **Playing** - Active gameplay
- **Paused** - Press space to pause/resume
- **Game Over** - When all lives are lost
- **Victory Screen** - When all bricks are cleared

## Controls

| Key | Action |
|-----|--------|
| **← →** or **A D** | Move paddle left/right |
| **Space** | Start game / Pause / Resume |
| **R** | Restart (on game over or win) |

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arkanoid
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
arkanoid/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── icon.svg              # Favicon
├── components/
│   └── ArkanoidGame.tsx      # Main game component
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Technical Details

### Technologies Used
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **HTML5 Canvas** - Game rendering
- **Tailwind CSS** - Styling and utilities
- **React Hooks** - State management and lifecycle

### Game Architecture

The game uses a classic game loop architecture:

1. **Update Loop** - Updates game state, physics, and collision detection
2. **Render Loop** - Draws all game objects to the canvas
3. **RequestAnimationFrame** - Smooth 60fps animation

Key components:
- **Ball physics** - Velocity-based movement with collision detection
- **Paddle control** - Keyboard input with smooth movement
- **Brick grid** - 6×10 grid with different colors and point values
- **Collision detection** - AABB (Axis-Aligned Bounding Box) collision
- **Particle system** - Dynamic particle effects on collisions
- **Visual effects** - Trails, glows, shadows, and animations

### Performance Optimizations
- Uses `useRef` for game objects to avoid re-renders
- Efficient particle management with cleanup
- Canvas-based rendering for high performance
- Optimized collision detection

## Game Mechanics

### Scoring
- **Top row (Red):** 60 points per brick
- **Row 2 (Teal):** 50 points per brick
- **Row 3 (Blue):** 40 points per brick
- **Row 4 (Orange):** 30 points per brick
- **Row 5 (Mint):** 20 points per brick
- **Bottom row (Yellow):** 10 points per brick

### Ball Physics
- Ball speed remains constant throughout the game
- Hitting different parts of the paddle changes the ball's angle
- Maximum deflection angle: ±54 degrees from vertical
- Collisions with walls and ceiling create particle effects

### Lives System
- Start with 3 lives
- Lose a life when the ball falls below the paddle
- Game ends when all lives are lost

### Win Condition
- Clear all 60 bricks to win the game
- Final score is displayed on the victory screen

## Customization

You can easily customize the game by modifying constants in `components/ArkanoidGame.tsx`:

```typescript
const CANVAS_WIDTH = 800;      // Game canvas width
const CANVAS_HEIGHT = 600;     // Game canvas height
const PADDLE_WIDTH = 120;      // Paddle width
const BALL_RADIUS = 8;         // Ball size
const BRICK_ROWS = 6;          // Number of brick rows
const BRICK_COLS = 10;         // Number of brick columns
```

## Browser Compatibility

Works on all modern browsers that support:
- HTML5 Canvas
- ES6+ JavaScript
- CSS3

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

Potential features to add:
- [ ] Power-ups (multi-ball, wider paddle, etc.)
- [ ] Multiple levels with different brick patterns
- [ ] Sound effects and background music
- [ ] High score persistence (localStorage)
- [ ] Mobile touch controls
- [ ] Difficulty levels
- [ ] Different ball speeds

## License

MIT License - feel free to use this project for learning or personal use.

## Credits

Built with ❤️ using Next.js and TypeScript

---

**Enjoy the game!** 🎮
