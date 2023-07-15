const { app, BrowserWindow } = require('electron');
const express = require('./express.js');

if (require('electron-squirrel-startup')) app.quit();
let mainWindow;
app.on('ready', function() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 1000,
    autoHideMenuBar: true,
    resizable: false,
  });
  mainWindow.loadURL('http://localhost:80/');
  mainWindow.focus();
});
