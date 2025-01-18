import { socket } from "../script.js";

export function sendMessage(typeMessage, dados) {
  console.log(typeMessage);
  const message = { type: typeMessage, data: dados };
  socket.send(JSON.stringify(message));
}
