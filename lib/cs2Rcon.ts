import net from "node:net";

type RconOpts = {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
};

function buildPacket(id: number, type: number, body: string) {
  const bodyBuf = Buffer.from(body + "\x00", "utf8");
  const size = 4 + 4 + bodyBuf.length + 1; // id + type + body + null
  const buf = Buffer.alloc(4 + size);

  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeInt8(0, 12 + bodyBuf.length);

  return buf;
}

async function sendPacket(socket: net.Socket, id: number, type: number, body: string) {
  const pkt = buildPacket(id, type, body);
  return new Promise<void>((resolve, reject) => {
    socket.write(pkt, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Minimal RCON exec for CS2/Source RCON.
 * Best-effort (we don't parse replies), good enough for: sv_password, mp_restartgame, etc.
 */
export async function cs2RconExec(command: string, opts?: Partial<RconOpts>) {
  const host = opts?.host ?? process.env.ARENA_CS2_HOST;
  const port = Number(opts?.port ?? process.env.ARENA_CS2_PORT ?? 0);
  const password = opts?.password ?? process.env.ARENA_CS2_RCON;
  const timeoutMs = Number(opts?.timeoutMs ?? 2500);

  if (!host || !port || !password) throw new Error("RCON_NOT_CONFIGURED");

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const t = setTimeout(() => {
      try { socket.destroy(); } catch {}
      reject(new Error("RCON_TIMEOUT"));
    }, timeoutMs);

    socket.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });

    socket.on("connect", async () => {
      try {
        // auth: type 3
        await sendPacket(socket, 1, 3, password);
        // command: type 2
        await sendPacket(socket, 2, 2, command);
        clearTimeout(t);
        socket.end();
        resolve();
      } catch (e) {
        clearTimeout(t);
        try { socket.destroy(); } catch {}
        reject(e as any);
      }
    });
  });
}
