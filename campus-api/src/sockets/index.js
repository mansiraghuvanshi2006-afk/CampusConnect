/**
 * Socket.IO entry used by server bootstrap.
 */

export {
  initializeSocketServer as default,
  initializeSocketServer,
  getIO,
  forceLeaveConversation,
} from "./socketServer.js";
