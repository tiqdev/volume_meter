const socket = io.connect("http://localhost:4000");

//Emit event
socket.emit("ping", {
  message: "Hello from the client!",
});

/*
socket.on("getPrevCoinList", (data) => {
  console.log(data);
});
*/

socket.on("get15mCandleList", (data) => {
  console.log(data);
});
