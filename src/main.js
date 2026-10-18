import { Player } from './player.js';
import { Engine } from './engine.js';
import { GunsmithUI } from './ui/gunsmithUI.js';
import { ScreenManager } from './ui/screenManager.js';
import { P2PNetwork } from './network/p2pNetwork.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const player = new Player(160, 360);

  // Initialize P2P Network locked to room 1111
const network = new P2PNetwork('1111');

  // Initialize Gunsmith & Preview
  const gunsmithUI = new GunsmithUI(player);

  // Initialize Test Range Engine with Network
  const engine = new Engine(canvas, player, network);
  engine.start();

  // Initialize Screen Manager (pass network)
  const screenManager = new ScreenManager(engine, gunsmithUI, network);
  screenManager.setScreen('menu');

  // Connect to P2P network on first deploy click
  document.getElementById('btn-deploy').addEventListener('click', () => {
    network.connect();
  });
  document.getElementById('btn-workbench-deploy').addEventListener('click', () => {
    network.connect();
  });
});