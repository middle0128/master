// app.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

// 道具類型枚舉
enum PowerUpType {
  SpeedBoost,
  Shield,
  ScoreMultiplier,
  SlowMotion
}

// 道具類
interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  duration: number; // 持續時間（秒）
  active: boolean;
}

// 敵人類
interface Enemy {
  x: number;
  y: number;
  direction: string;
  speed: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('gameArea') gameArea!: ElementRef;

  // 蛇相關
  snakeSegments: { x: number, y: number }[] = [
    { x: 100, y: 100 },
    { x: 90, y: 100 },
    { x: 80, y: 100 }
  ];
  direction: string = 'right';
  gameSpeed: number = 60; // 更高的FPS
  snakeSpeed: number = 15; // 每秒移動的次數
  lastUpdateTime: number = 0;
  speedMultiplier: number = 1;

  // 食物相關
  food: { x: number, y: number } = { x: 200, y: 200 };

  // 道具相關
  powerUps: PowerUp[] = [];
  activePowerUps: PowerUp[] = [];
  powerUpChance: number = 0.1; // 每次食物生成時有10%機率產生道具

  // 敵人相關
  enemies: Enemy[] = [];
  enemySpawnInterval: number = 10000; // 10秒生成一個敵人
  enemySpawnTimer: number = 0;

  // 遊戲狀態
  gameRunning: boolean = false;
  score: number = 0;
  highScore: number = 0;
  hasShield: boolean = false;
  scoreMultiplier: number = 1;
  speed:number = 10;
  // 遊戲區域
  gameWidth: number = 600;
  gameHeight: number = 400;
  gridSize: number = 10;

  // 動畫相關
  animationId: number = 0;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    // 載入本地存儲的最高分
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) {
      this.highScore = parseInt(savedHighScore);
    }

    // 全局鍵盤事件監聽
    window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));
  }

  ngAfterViewInit(): void {
    // 確保遊戲區域可以獲得焦點
    this.gameArea.nativeElement.focus();
    this.startGame();
  }

  startGame() {
    // 重置遊戲狀態
    this.snakeSegments = [
      { x: 100, y: 100 },
      { x: 90, y: 100 },
      { x: 80, y: 100 }
    ];
    this.direction = 'right';
    this.speed = 15;
    this.score = 0;
    this.speedMultiplier = 1;
    this.scoreMultiplier = 1;
    this.hasShield = false;
    this.powerUps = [];
    this.activePowerUps = [];
    this.enemies = [];
    this.gameRunning = true;

    // 生成初始食物
    this.generateFood();

    // 使用requestAnimationFrame來提高FPS
    this.ngZone.runOutsideAngular(() => {
      this.lastUpdateTime = performance.now();
      this.gameLoop(this.lastUpdateTime);
    });
  }

  gameLoop(timestamp: number) {
    if (!this.gameRunning) return;

    const deltaTime = timestamp - this.lastUpdateTime;

    // 控制蛇的移動速度
    if (deltaTime > (1000 / (this.snakeSpeed * this.speedMultiplier))) {
      this.moveSnake();
      this.moveEnemies();
      this.checkCollisions();
      this.updatePowerUps(deltaTime);
      this.lastUpdateTime = timestamp;
    }

    // 敵人生成計時器
    this.enemySpawnTimer += deltaTime;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
    }

    // 繼續遊戲循環
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  moveSnake() {
    // 創建新的頭部
    const head = { ...this.snakeSegments[0] };

    // 根據方向移動頭部
    switch (this.direction) {
      case 'right':
        head.x += this.gridSize;
        break;
      case 'left':
        head.x -= this.gridSize;
        break;
      case 'up':
        head.y -= this.gridSize;
        break;
      case 'down':
        head.y += this.gridSize;
        break;
    }

    // 穿牆處理
    if (head.x >= this.gameWidth) head.x = 0;
    if (head.x < 0) head.x = this.gameWidth - this.gridSize;
    if (head.y >= this.gameHeight) head.y = 0;
    if (head.y < 0) head.y = this.gameHeight - this.gridSize;

    // 將新頭部添加到蛇的前端
    this.snakeSegments.unshift(head);

    // 如果吃到食物
    if (head.x === this.food.x && head.y === this.food.y) {
      this.eatFood();
    } else {
      // 如果沒有吃到食物，移除尾部
      this.snakeSegments.pop();
    }

    // 檢查是否吃到道具
    this.checkPowerUpCollision();
  }

  eatFood() {
    // 增加分數
    this.score += 10 * this.scoreMultiplier;

    // 更新最高分
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('snakeHighScore', this.highScore.toString());
    }

    // 生成新食物
    this.generateFood();

    // 隨機生成道具
    if (Math.random() < this.powerUpChance) {
      this.generatePowerUp();
    }

    // 每吃5個食物增加速度
    if (this.score % 50 === 0) {
      this.snakeSpeed = Math.min(this.snakeSpeed + 1, 30);
    }
  }

  generateFood() {
    // 計算網格上的可用位置
    const availablePositions = [];
    for (let x = 0; x < this.gameWidth; x += this.gridSize) {
      for (let y = 0; y < this.gameHeight; y += this.gridSize) {
        // 檢查位置是否被蛇、道具或敵人佔用
        if (!this.isPositionOccupied(x, y)) {
          availablePositions.push({ x, y });
        }
      }
    }

    if (availablePositions.length > 0) {
      // 隨機選擇一個位置
      const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
      this.food = { x: randomPosition.x, y: randomPosition.y };
    }
  }

  isPositionOccupied(x: number, y: number): boolean {
    // 檢查蛇
    for (const segment of this.snakeSegments) {
      if (segment.x === x && segment.y === y) {
        return true;
      }
    }

    // 檢查道具
    for (const powerUp of this.powerUps) {
      if (powerUp.x === x && powerUp.y === y) {
        return true;
      }
    }

    // 檢查敵人
    for (const enemy of this.enemies) {
      if (enemy.x === x && enemy.y === y) {
        return true;
      }
    }

    return false;
  }

  generatePowerUp() {
    // 計算網格上的可用位置
    const availablePositions = [];
    for (let x = 0; x < this.gameWidth; x += this.gridSize) {
      for (let y = 0; y < this.gameHeight; y += this.gridSize) {
        // 檢查位置是否被蛇、食物或敵人佔用
        if (!this.isPositionOccupied(x, y) && !(x === this.food.x && y === this.food.y)) {
          availablePositions.push({ x, y });
        }
      }
    }

    if (availablePositions.length > 0) {
      // 隨機選擇一個位置
      const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];

      // 隨機選擇道具類型
      const powerUpTypes = [
        PowerUpType.SpeedBoost,
        PowerUpType.Shield,
        PowerUpType.ScoreMultiplier,
        PowerUpType.SlowMotion
      ];
      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

      // 根據類型設置持續時間
      let duration = 5;
      switch (randomType) {
        case PowerUpType.SpeedBoost:
          duration = 3;
          break;
        case PowerUpType.Shield:
          duration = 8;
          break;
        case PowerUpType.ScoreMultiplier:
          duration = 10;
          break;
        case PowerUpType.SlowMotion:
          duration = 6;
          break;
      }

      // 創建新道具
      const newPowerUp: PowerUp = {
        x: randomPosition.x,
        y: randomPosition.y,
        type: randomType,
        duration: duration,
        active: false
      };

      this.powerUps.push(newPowerUp);

      // 設置自動移除時間（15秒後如果未被吃掉）
      setTimeout(() => {
        const index = this.powerUps.indexOf(newPowerUp);
        if (index !== -1 && !newPowerUp.active) {
          this.powerUps.splice(index, 1);
        }
      }, 15000);
    }
  }

  checkPowerUpCollision() {
    const head = this.snakeSegments[0];

    // 檢查是否碰到道具
    for (let i = 0; i < this.powerUps.length; i++) {
      const powerUp = this.powerUps[i];
      if (!powerUp.active && head.x === powerUp.x && head.y === powerUp.y) {
        // 激活道具
        this.activatePowerUp(powerUp);
        // 從地圖上移除道具
        this.powerUps.splice(i, 1);
        break;
      }
    }
  }

  activatePowerUp(powerUp: PowerUp) {
    powerUp.active = true;
    this.activePowerUps.push(powerUp);

    // 根據道具類型應用效果
    switch (powerUp.type) {
      case PowerUpType.SpeedBoost:
        this.speedMultiplier = 2;
        break;
      case PowerUpType.Shield:
        this.hasShield = true;
        break;
      case PowerUpType.ScoreMultiplier:
        this.scoreMultiplier = 2;
        break;
      case PowerUpType.SlowMotion:
        this.speedMultiplier = 0.5;
        break;
    }
  }

  updatePowerUps(deltaTime: number) {
    for (let i = this.activePowerUps.length - 1; i >= 0; i--) {
      const powerUp = this.activePowerUps[i];
      powerUp.duration -= deltaTime / 1000; // 將毫秒轉換為秒

      if (powerUp.duration <= 0) {
        // 移除道具效果
        this.deactivatePowerUp(powerUp);
        this.activePowerUps.splice(i, 1);
      }
    }
  }

  deactivatePowerUp(powerUp: PowerUp) {
    // 根據道具類型移除效果
    switch (powerUp.type) {
      case PowerUpType.SpeedBoost:
        this.speedMultiplier = 1;
        break;
      case PowerUpType.Shield:
        this.hasShield = false;
        break;
      case PowerUpType.ScoreMultiplier:
        this.scoreMultiplier = 1;
        break;
      case PowerUpType.SlowMotion:
        this.speedMultiplier = 1;
        break;
    }
  }

  spawnEnemy() {
    // 隨機生成敵人位置（在邊緣）
    let x = 0;
    let y = 0;
    let direction = '';

    // 隨機選擇出現在哪個邊緣
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: // 上邊緣
        x = Math.floor(Math.random() * (this.gameWidth / this.gridSize)) * this.gridSize;
        y = 0;
        direction = 'down';
        break;
      case 1: // 右邊緣
        x = this.gameWidth - this.gridSize;
        y = Math.floor(Math.random() * (this.gameHeight / this.gridSize)) * this.gridSize;
        direction = 'left';
        break;
      case 2: // 下邊緣
        x = Math.floor(Math.random() * (this.gameWidth / this.gridSize)) * this.gridSize;
        y = this.gameHeight - this.gridSize;
        direction = 'up';
        break;
      case 3: // 左邊緣
        x = 0;
        y = Math.floor(Math.random() * (this.gameHeight / this.gridSize)) * this.gridSize;
        direction = 'right';
        break;
    }

    // 創建新敵人
    const newEnemy: Enemy = {
      x: x,
      y: y,
      direction: direction,
      speed: 0.7 + Math.random() * 0.6 // 速度在0.7-1.3之間
    };

    this.enemies.push(newEnemy);
  }

  moveEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // 根據方向移動敵人
      switch (enemy.direction) {
        case 'right':
          enemy.x += this.gridSize * enemy.speed;
          break;
        case 'left':
          enemy.x -= this.gridSize * enemy.speed;
          break;
        case 'up':
          enemy.y -= this.gridSize * enemy.speed;
          break;
        case 'down':
          enemy.y += this.gridSize * enemy.speed;
          break;
      }

      // 檢查是否超出邊界
      if (enemy.x < -this.gridSize || enemy.x > this.gameWidth ||
          enemy.y < -this.gridSize || enemy.y > this.gameHeight) {
        // 移除超出邊界的敵人
        this.enemies.splice(i, 1);
      } else {
        // 隨機改變方向（10%的機率）
        if (Math.random() < 0.1) {
          const directions = ['up', 'right', 'down', 'left'];
          const oppositeDirections = {
            'up': 'down',
            'right': 'left',
            'down': 'up',
            'left': 'right'
          };
          // 過濾掉相反的方向，避免突然調頭
          const possibleDirections = directions.filter(dir => dir !== oppositeDirections[enemy.direction as keyof typeof oppositeDirections]);
          enemy.direction = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
        }
      }
    }
  }

  checkCollisions() {
    const head = this.snakeSegments[0];

    // 檢查蛇頭是否碰到自己的身體
    for (let i = 1; i < this.snakeSegments.length; i++) {
      if (head.x === this.snakeSegments[i].x && head.y === this.snakeSegments[i].y) {
        if (this.hasShield) {
          // 如果有護盾，消耗護盾而不死亡
          this.hasShield = false;
          const activeShieldIndex = this.activePowerUps.findIndex(p => p.type === PowerUpType.Shield);
          if (activeShieldIndex !== -1) {
            this.activePowerUps.splice(activeShieldIndex, 1);
          }
        } else {
          this.gameOver();
        }
        return;
      }
    }

    // 檢查蛇頭是否碰到敵人
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (Math.abs(head.x - enemy.x) < this.gridSize && Math.abs(head.y - enemy.y) < this.gridSize) {
        if (this.hasShield) {
          // 如果有護盾，消耗護盾而不死亡，並消滅敵人
          this.hasShield = false;
          this.enemies.splice(i, 1);
          const activeShieldIndex = this.activePowerUps.findIndex(p => p.type === PowerUpType.Shield);
          if (activeShieldIndex !== -1) {
            this.activePowerUps.splice(activeShieldIndex, 1);
          }
        } else {
          this.gameOver();
        }
        return;
      }
    }
  }

  gameOver() {
    this.gameRunning = false;
    cancelAnimationFrame(this.animationId);
    alert(`遊戲結束！你的分數：${this.score}`);
  }

  changeDirection(event: KeyboardEvent) {
    // 阻止默認行為（如頁面滾動）
    event.preventDefault();

    // 禁止180度轉向
    switch (event.key) {
      case 'ArrowUp':
        if (this.direction !== 'down') this.direction = 'up';
        break;
      case 'ArrowDown':
        if (this.direction !== 'up') this.direction = 'down';
        break;
      case 'ArrowLeft':
        if (this.direction !== 'right') this.direction = 'left';
        break;
      case 'ArrowRight':
        if (this.direction !== 'left') this.direction = 'right';
        break;
      case ' ': // 空格鍵暫停/繼續
        this.togglePause();
        break;
      case 'r': // R鍵重新開始
      case 'R':
        if (!this.gameRunning) {
          this.startGame();
        }
        break;
    }
  }

  togglePause() {
    if (this.gameRunning) {
      this.gameRunning = false;
      cancelAnimationFrame(this.animationId);
    } else {
      this.gameRunning = true;
      this.lastUpdateTime = performance.now();
      this.gameLoop(this.lastUpdateTime);
    }
  }

  handleGlobalKeyDown(event: KeyboardEvent) {
    // 檢查是否是遊戲控制鍵
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'r', 'R'].includes(event.key)) {
      this.changeDirection(event);
    }
  }

  // 組件銷毀時移除事件監聽器
  ngOnDestroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    cancelAnimationFrame(this.animationId);
  }

  // 獲取道具的顏色
  getPowerUpColor(type: PowerUpType): string {
    switch (type) {
      case PowerUpType.SpeedBoost:
        return '#ff5722'; // 橙色
      case PowerUpType.Shield:
        return '#2196f3'; // 藍色
      case PowerUpType.ScoreMultiplier:
        return '#4caf50'; // 綠色
      case PowerUpType.SlowMotion:
        return '#9c27b0'; // 紫色
      default:
        return '#ffffff';
    }
  }

  // 獲取蛇身顏色（條紋）
  getSnakeSegmentColor(index: number): string {
    return index % 2 === 0 ? '#4CAF50' : '#81C784'; // 深綠色和淺綠色條紋
  }
}
