var fs = require('fs');
//Picarto Messanger Interface
const pmi = require('pmi.js');

//Establish express constants and websocket
const port = 80;
const express = require('express');
const app = express()
const http = require('http').Server(app);
const io = require('socket.io')(http);

//ytdl for video titles
const ytdl = require('ytdl-core');
//load saved song playlist
let playlistPath = (__dirname + '/playlist.json');
var playList = JSON.parse(fs.readFileSync(playlistPath));

//Get text blocks
let aboutPath = (__dirname + '/about.txt');
var about = fs.readFileSync(aboutPath, {encoding: 'utf8'});
let updatePath = (__dirname + '/update.txt');
var update = fs.readFileSync(updatePath, {encoding: 'utf8'});
//Version
let verPath = (__dirname + '/ver.json');
var ver = JSON.parse(fs.readFileSync(verPath));

//Establish pmi client to replace
var client;

//public folder for css and favicon
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs')

//Listen to root URL, render index.ejs on it
app.get('/', function (req, res) {
  //Send saved creds for quick login
  let credPath = (__dirname + '/cred.json');
  let cred = JSON.parse(fs.readFileSync(credPath));

  res.render('login.ejs', {cred: cred, about: about, update: update, ver: ver});
})
//Listen to connected URL, render index.ejs on it
app.get('/connected', function (req, res) {
  res.render('index.ejs', {ver: ver});
})

//On websocket connection
io.on('connection', (socket) => {
  socket.on('login', (login) => {
    //write new login information to file
    let credPath = (__dirname + '/cred.json');
    let data = JSON.stringify({username: login[0], token: login[1]});
    fs.writeFileSync(credPath, data);

    //attempt login
    let opts = {
      identity: {
        username: login[0],
        password: login[1]
      }
    };
    //create Picarto client
    client = new pmi.client(opts);
    client.on('connected', onConnectedHandler);
    client.on('unauthenticated', onFailedHandler);
    client.on('message', onMessageHandler);
    //connecct client
    client.connect();
  });

  //socket sends playlist
  socket.on('playListUpdate', (pL) => {
    playList = pL;
    writePlayList(playList);
  });
  //socket requests playlist
  socket.on('updatePlayList', () => {
    io.emit('updatePL', playList);
  });
});

//Picarto events
function onConnectedHandler (addr, port) {
  //login successful
  io.emit('logged');
}
function onClosedHandler (){
  //automatic reconnect
  client.connect();
}
function onFailedHandler(){
  //login failed
  io.emit('failed');
  client.close();
}

//On Picarto message
function onMessageHandler (target, context, msg) {
  //split message
  let messageSplit = msg.split(" ");
  let command = messageSplit[0].toLowerCase();
  let parameters = messageSplit[1];
  //ignore bot messages
  if (context[0].z) {
    return;
  }
  //Streamer commands
  if(context[0].s){
    switch(command){
      //Skip Song
      case "!skip":
      if(playList.length > 0){
        io.emit('skipSong');
      }
      else{
        client.say(target, "There is no song to skip");
      }
      break;
    }
  }
  //Commands
  switch(command){
    //Song Request
    case "!sr":
      if(!parameters){
        break;
      }
      var videoid = parameters.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&]+)/);
      if(videoid != null) {
         youtubeInfo(videoid[1], target);
      } else {
          client.say(target, "Not a valid youtube URL");
      }
    break;
  }
}

//Start web page on selected port
http.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}/`);
});

//write playlist to json
function writePlayList(pL){
  let playlistPath = (__dirname + '/playlist.json');
  let data = JSON.stringify(pL);
  fs.writeFileSync(playlistPath, data);
}

//Get youtube information
function youtubeInfo(input, target){
  let newItem = [];
  ytdl.getInfo('https://www.youtube.com/watch?v=' + input)
    .then(info => {
      if(info.videoDetails.lengthSeconds >= 600 || info.videoDetails.lengthSeconds == 0){
        client.say(target, (info.videoDetails.title + " is longer than 10 minutes"));
        return;
      }
      let videoLength = convertLength(info.videoDetails.lengthSeconds);
      newItem = [input, info.videoDetails.title, videoLength, target];
      playList.push(newItem);
      writePlayList(playList);
      io.emit('updatePL', playList);
      client.say(target, (info.videoDetails.title + " has been added to the queue"));
    })
    .catch(err => client.say(target, "Video is unavailable"));
}
//convert youtube length from seconds to minutes
function convertLength(x){
  if(x < 60){
    return ("00:" + pad(x, 2));
  }
  else{
    return (pad((Math.floor(x/60)), 2) + ":" + pad((x%60), 2));
  }
}
//Add leading 0s to timecodes
function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}
