// client/src/nakamaClient.ts
import * as nakamajs from "@heroiclabs/nakama-js";

const host = "127.0.0.1";
const port = "7350";
const serverKey = "defaultkey"; 
const useSSL = false;

export function makeClient() {
  return new nakamajs.Client(serverKey, host, port, useSSL);
}

export async function authDevice(client: any, deviceId: string) {
  
  const session = await client.authenticateDevice(deviceId, true);
  return session;
}

export function makeSocket(client: any) {
  return client.createSocket(false);
}
