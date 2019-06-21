const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

//let count = 0;

// server (emit) => client(receive) --acknowledgement=> server
// client (emit) => server(receive) --acknowledgement=> client

io.on("connection", socket => {
  console.log("new web socket connection");
  //socket.emit("welcome", message);

  // socket.emit("countUpdated", count);

  // socket.on("increment", () => {
  //   count++;
  //   io.emit("countUpdated", count);
  // });

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });
    if (error) {
      return callback(error);
    }
    socket.join(user.room);
    socket.emit("message", generateMessage("admin", "Welcome"));
    socket.broadcast
      .to(user.room)
      .emit("message", generateMessage("admin", `${user.username} has joined`));
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    callback();
    //socket.emit(emit to specific client),
    // io.emit(emit to every connected client),
    // socket.broadcast.emit(emit to everyone except original client)
    // io.to.emit(emit to room),
    // socket.broadcast.to.emit(emit to everyone in specific room except original client)
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback("take it easy buddy");
    }
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
  });

  socket.on("sendLocation", (location, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(user.username, location)
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("admin", `${user.username} has left`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
