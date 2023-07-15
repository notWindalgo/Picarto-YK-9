var fs = require('fs');
//Picarto Messanger Interface
const pmi = require('pmi.js');

//read creds from file that does not get merged into electron app
let credPath = (__dirname + '/cred.json');
var cred = JSON.parse(fs.readFileSync(credPath));

//Picarto login details
const opts = {
  identity: {
    username: cred.username,
    password: cred.token
  }
};

//establish Express constants and websocket
const port = 80;
const express = require('express');
const app = express()
const http = require('http').Server(app);
const io = require('socket.io')(http);

//ytdl for video titles
const ytdl = require('ytdl-core');
//
let playlistPath = (__dirname + '/playlist.json');
var playList = JSON.parse(fs.readFileSync(playlistPath));

//create Picarto client
const client = new pmi.client(opts);
//client events
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);
client.on('closed', onClosedHandler);
//connecct client
client.connect();

//public folder for css and favicon
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs')

//Listen to root URL, render index.ejs on it
app.get('/', function (req, res) {
  res.render('index.ejs');
})

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
function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}`);
}
function onClosedHandler (){
  client.connect();
}

//On websocket connection
io.on('connection', (socket) => {
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

//Start web page on selected port
http.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}/`);
});

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

//write to json
function writePlayList(pL){
  let playlistPath = (__dirname + '/playlist.json');
  let data = JSON.stringify(pL);
  fs.writeFileSync(playlistPath, data);
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
