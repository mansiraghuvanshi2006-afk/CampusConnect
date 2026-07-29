import { useContext } from "react";

import {
  SocketContext,
} from "./SocketProvider.jsx";

const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      "useSocket must be used within SocketProvider"
    );
  }

  return context;
};

export default useSocket;
