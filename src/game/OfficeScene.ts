import Phaser from 'phaser'
import type { OfficeConfig } from '../config/types'

// Assets base path (relative to public/)
const A = './assets/'

export class OfficeScene extends Phaser.Scene {
  private config!: OfficeConfig
  private star!: Phaser.GameObjects.Sprite
  private starWorking!: Phaser.GameObjects.Sprite
  private errorBug!: Phaser.GameObjects.Sprite
  private syncAnimSprite!: Phaser.GameObjects.Sprite
  private serverroom!: Phaser.GameObjects.Sprite
  private plaqueText!: Phaser.GameObjects.Text
  private currentState = 'idle'
  private bugDirection = 1

  constructor() {
    super({ key: 'OfficeScene' })
  }

  init(data: { config: OfficeConfig }) {
    if (!data?.config) return
    this.config = data.config
  }

  preload() {
    let loaded = 0
    const total = 16
    const update = (window as unknown as Record<string, (l: number, t: number) => void>).__updateLoadingProgress
    const hideLoading = (window as unknown as Record<string, () => void>).__hideLoadingOverlay

    this.load.on('filecomplete', () => {
      loaded++
      update?.(loaded, total)
    })
    this.load.on('complete', () => {
      hideLoading?.()
    })

    // Background
    this.load.image('office_bg', A + this.config.office.background)

    // Character spritesheets
    this.load.spritesheet('star_idle', A + 'star-idle-v5.png', { frameWidth: 256, frameHeight: 256 })
    this.load.spritesheet('star_working', A + 'star-working-spritesheet-grid.webp', { frameWidth: 300, frameHeight: 300 })

    // Static furniture images
    this.load.image('sofa_idle', A + 'sofa-idle-v3.png')
    this.load.image('sofa_shadow', A + 'sofa-shadow-v1.png')
    this.load.image('desk_v2', A + 'desk-v3.webp')
    this.load.image('coffee_machine_shadow', A + 'coffee-machine-shadow-v1.png')

    // Animated furniture spritesheets
    this.load.spritesheet('plants', A + 'plants-spritesheet.webp', { frameWidth: 160, frameHeight: 160 })
    this.load.spritesheet('posters', A + 'posters-spritesheet.webp', { frameWidth: 160, frameHeight: 160 })
    this.load.spritesheet('coffee_machine', A + 'coffee-machine-v3-grid.webp', { frameWidth: 230, frameHeight: 230 })
    this.load.spritesheet('serverroom', A + 'serverroom-spritesheet.webp', { frameWidth: 180, frameHeight: 251 })
    this.load.spritesheet('cats', A + 'cats-spritesheet.webp', { frameWidth: 160, frameHeight: 160 })
    this.load.spritesheet('flowers', A + 'flowers-bloom-v2.webp', { frameWidth: 65, frameHeight: 65 })

    // Effect spritesheets
    this.load.spritesheet('error_bug', A + 'error-bug-spritesheet-grid.webp', { frameWidth: 220, frameHeight: 220 })
    this.load.spritesheet('sync_anim', A + 'sync-animation-v3-grid.webp', { frameWidth: 256, frameHeight: 256 })
  }

  create() {
    const cfg = this.config
    const furn = cfg.furniture

    // --- Background ---
    this.add.image(cfg.office.width / 2, cfg.office.height / 2, 'office_bg').setDepth(0)

    // --- Furniture: static images ---
    this.add.image(furn.sofaShadow.x, furn.sofaShadow.y, 'sofa_shadow')
      .setOrigin(0.5, 0.5).setDepth(furn.sofaShadow.depth)

    this.add.image(furn.sofa.x, furn.sofa.y, 'sofa_idle')
      .setOrigin(0.5, 0.5).setDepth(furn.sofa.depth)

    const deskOrigin = furn.desk.origin ?? { x: 0.5, y: 0.5 }
    this.add.image(furn.desk.x, furn.desk.y, 'desk_v2')
      .setOrigin(deskOrigin.x, deskOrigin.y).setDepth(furn.desk.depth)

    this.add.image(furn.coffeeMachineShadow.x, furn.coffeeMachineShadow.y, 'coffee_machine_shadow')
      .setOrigin(0.5, 0.5).setDepth(furn.coffeeMachineShadow.depth)

    // --- Furniture: animated sprites ---
    // Plants (static random frame)
    const plantMaxFrame = this.textures.get('plants').frameTotal - 2
    for (const p of furn.plants) {
      const frame = Phaser.Math.Between(0, plantMaxFrame)
      this.add.sprite(p.x, p.y, 'plants', frame).setOrigin(0.5, 0.5).setDepth(p.depth)
    }

    // Poster (random frame)
    const posterFrames = this.textures.get('posters').frameTotal - 1
    this.add.sprite(furn.poster.x, furn.poster.y, 'posters', Phaser.Math.Between(0, posterFrames - 1))
      .setOrigin(0.5, 0.5).setDepth(furn.poster.depth)

    // Coffee machine (animated)
    const cm = this.add.sprite(furn.coffeeMachine.x, furn.coffeeMachine.y, 'coffee_machine')
      .setOrigin(0.5, 0.5).setDepth(furn.coffeeMachine.depth)
    const cmFrames = this.textures.get('coffee_machine').frameTotal
    this.anims.create({
      key: 'coffee_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: cmFrames - 2 }),
      frameRate: 12.5,
      repeat: -1,
    })
    cm.play('coffee_machine')

    // Server room
    this.serverroom = this.add.sprite(furn.serverroom.x, furn.serverroom.y, 'serverroom')
      .setOrigin(0.5, 0.5).setDepth(furn.serverroom.depth)
    const srFrames = this.textures.get('serverroom').frameTotal
    this.anims.create({
      key: 'serverroom_on',
      frames: this.anims.generateFrameNumbers('serverroom', { start: 0, end: srFrames - 2 }),
      frameRate: 6,
      repeat: -1,
    })

    // Flower (random frame, on desk)
    const flowerMaxFrame = this.textures.get('flowers').frameTotal - 2
    const flowerFrame = Phaser.Math.Between(0, flowerMaxFrame)
    this.add.sprite(furn.flower.x, furn.flower.y, 'flowers', flowerFrame)
      .setOrigin(0.5, 0.5).setDepth(furn.flower.depth).setScale(furn.flower.scale ?? 1)

    // Cat (random frame, top layer)
    const catMaxFrame = this.textures.get('cats').frameTotal - 2
    const catFrame = Phaser.Math.Between(0, catMaxFrame)
    this.add.sprite(furn.cat.x, furn.cat.y, 'cats', catFrame)
      .setOrigin(0.5, 0.5).setDepth(furn.cat.depth)

    // --- Character sprites ---
    // Star idle (on sofa)
    const idleFrames = this.textures.get('star_idle').frameTotal
    this.anims.create({
      key: 'star_idle',
      frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: idleFrames - 2 }),
      frameRate: 12,
      repeat: -1,
    })
    this.star = this.add.sprite(furn.sofa.x, furn.sofa.y, 'star_idle')
      .setOrigin(0.5, 0.5).setDepth(20).setScale(1.0)

    // Star working (at desk)
    const workingFrames = this.textures.get('star_working').frameTotal
    this.anims.create({
      key: 'star_working',
      frames: this.anims.generateFrameNumbers('star_working', { start: 0, end: workingFrames - 2 }),
      frameRate: 12,
      repeat: -1,
    })
    this.starWorking = this.add.sprite(furn.starWorking.x, furn.starWorking.y, 'star_working')
      .setOrigin(0.5, 0.5).setDepth(furn.starWorking.depth).setScale(furn.starWorking.scale ?? 1)
      .setVisible(false)

    // Error bug sprite
    const bugFrames = this.textures.get('error_bug').frameTotal
    this.anims.create({
      key: 'error_bug',
      frames: this.anims.generateFrameNumbers('error_bug', { start: 0, end: Math.min(71, bugFrames - 1) }),
      frameRate: 12,
      repeat: -1,
    })
    this.errorBug = this.add.sprite(furn.errorBug.x, furn.errorBug.y, 'error_bug')
      .setOrigin(0.5, 0.5).setDepth(furn.errorBug.depth).setScale(furn.errorBug.scale ?? 1)
      .setVisible(false)

    // Sync animation sprite
    const syncFrames = this.textures.get('sync_anim').frameTotal
    this.anims.create({
      key: 'sync_anim',
      frames: this.anims.generateFrameNumbers('sync_anim', { start: 1, end: syncFrames - 2 }),
      frameRate: 12,
      repeat: -1,
    })
    this.syncAnimSprite = this.add.sprite(furn.syncAnim.x, furn.syncAnim.y, 'sync_anim')
      .setOrigin(0.5, 0.5).setDepth(furn.syncAnim.depth)
      .setVisible(false)

    // --- Bottom plaque ---
    const plaqueX = cfg.office.width / 2
    const plaqueY = cfg.office.height - 36
    this.add.rectangle(plaqueX, plaqueY, 420, 44, 0x5d4037).setOrigin(0.5, 0.5).setDepth(3000)
    this.plaqueText = this.add.text(plaqueX, plaqueY, cfg.office.title, {
      fontFamily: `${cfg.theme.fontFamily}, monospace`,
      fontSize: '18px',
      color: cfg.theme.accentColor,
    }).setOrigin(0.5, 0.5).setDepth(3001)

    // --- Hide skeleton ---
    this.events.emit('scene-ready')

    // --- Apply initial state ---
    this.applyState(cfg.character.defaultState)
  }

  update(_time: number, delta: number) {
    // Error bug ping-pong movement (frame-rate independent)
    if (this.currentState === 'error' && this.errorBug.visible) {
      const pp = this.config.furniture.errorBug.pingPong
      this.errorBug.x += pp.speed * this.bugDirection * (delta / 16.667)
      if (this.errorBug.x >= pp.rightX) this.bugDirection = -1
      if (this.errorBug.x <= pp.leftX) this.bugDirection = 1
    }
  }

  /**
   * Apply a visual state — called from React via scene reference.
   * Matches the original Star-Office-UI applyVisualState logic.
   */
  applyState(stateName: string) {
    this.currentState = stateName

    if (stateName === 'idle') {
      // Idle: Star on sofa, visible
      this.star.setVisible(true).setPosition(this.config.furniture.sofa.x, this.config.furniture.sofa.y)
      this.star.anims.play('star_idle', true)
      this.starWorking.setVisible(false)
      this.starWorking.anims.stop()
      this.errorBug.setVisible(false)
      this.syncAnimSprite.setVisible(false)
      this.serverroom.setFrame(0)
    } else if (stateName === 'error') {
      // Error: Star hidden, bug visible and ping-ponging
      this.star.setVisible(false)
      this.star.anims.stop()
      this.starWorking.setVisible(false)
      this.starWorking.anims.stop()
      this.errorBug.setVisible(true)
      this.errorBug.anims.play('error_bug', true)
      this.syncAnimSprite.setVisible(false)
      this.serverroom.anims.play('serverroom_on', true)
    } else if (stateName === 'syncing') {
      // Syncing: Star hidden, sync animation visible
      this.star.setVisible(false)
      this.star.anims.stop()
      this.starWorking.setVisible(false)
      this.starWorking.anims.stop()
      this.errorBug.setVisible(false)
      this.syncAnimSprite.setVisible(true)
      this.syncAnimSprite.anims.play('sync_anim', true)
      this.serverroom.anims.play('serverroom_on', true)
    } else if (stateName === 'working') {
      // Working: Star at desk
      this.star.setVisible(false)
      this.star.anims.stop()
      this.starWorking.setVisible(true)
      this.starWorking.anims.play('star_working', true)
      this.errorBug.setVisible(false)
      this.syncAnimSprite.setVisible(false)
      this.serverroom.anims.play('serverroom_on', true)
    }
  }

  updatePlaqueText(title: string) {
    this.plaqueText?.setText(title)
  }
}
