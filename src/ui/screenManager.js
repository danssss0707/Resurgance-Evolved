export class ScreenManager {
  constructor(engine, gunsmithUI, network = null) {
    this.engine = engine;
    this.gunsmithUI = gunsmithUI;
    this.network = network;

    this.screenMenu = document.getElementById('screen-main-menu');
    this.screenGunsmith = document.getElementById('screen-gunsmith');
    this.screenGame = document.getElementById('screen-game');

    this.btnDeploy = document.getElementById('btn-deploy');
    this.btnOpenLoadout = document.getElementById('btn-open-loadout');

    this.btnWorkbenchBack = document.getElementById('btn-workbench-back');
    this.btnWorkbenchDeploy = document.getElementById('btn-workbench-deploy');

    this.btnGamePause = document.getElementById('btn-game-pause');

    this.currentScreen = 'menu';

    this.setupListeners();
  }

  setScreen(screenName) {
    this.currentScreen = screenName;
    if (this.network) {
      this.network.currentScreen = screenName;
    }

    this.screenMenu.classList.toggle('active', screenName === 'menu');
    this.screenGunsmith.classList.toggle('active', screenName === 'gunsmith');
    this.screenGame.classList.toggle('active', screenName === 'game');

    // Keep engine running so network heartbeats and position syncs never freeze
    this.engine.running = true;

    if (screenName === 'game') {
      this.engine.snapCameraToPlayer();
    } else {
      this.gunsmithUI.refreshWeapon();
    }
  }

  setupListeners() {
    this.btnDeploy.addEventListener('click', () => this.setScreen('game'));
    this.btnOpenLoadout.addEventListener('click', () => this.setScreen('gunsmith'));

    this.btnWorkbenchBack.addEventListener('click', () => this.setScreen('menu'));
    this.btnWorkbenchDeploy.addEventListener('click', () => this.setScreen('game'));

    this.btnGamePause.addEventListener('click', () => this.setScreen('menu'));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.currentScreen === 'game' || this.currentScreen === 'gunsmith') {
          this.setScreen('menu');
        }
      }
      if (e.key === ' ' && this.currentScreen === 'menu') {
        e.preventDefault();
        this.setScreen('game');
      }
    });
  }
}