import net from "node:net";

type RconOpts = {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
};

const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;

function buildPacket(id: number, type: number, body: string) {
  const bodyBuf = Buffer.from(body, "utf8");
  const size = 4 + 4 + bodyBuf.length + 2; // id + type + body + 2 null bytes
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeInt16LE(0, 12 + bodyBuf.length); // 2 null bytes
  return buf;
}

function parsePackets(chunk: Buffer) {
  const packets: Array<{ id: number; type: number; body: string }> = [];
  let off = 0;
  while (off + 4 <= chunk.length) {
    const size = chunk.readInt32LE(off);
    const end = off + 4 + size;
    if (end > chunk.length) break;
    const id = chunk.readInt32LE(off + 4);
    const type = chunk.readInt32LE(off + 8);
    const bodyBuf = chunk.subarray(off + 12, end - 2);
    const body = bodyBuf.toString("utf8");
    packets.push({ id, type, body });
    off = end;
  }
  return packets;
}

export async function rconExec(opts: RconOpts, command: string) {
  const timeoutMs = opts.timeoutMs ?? 1800;

  return await new Promise<{ ok: boolean; body?: string; error?: string }>((resolve) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let authed = false;
    const authId = 0x1337;
    const cmdId = 0x1338;

    const done = (res: any) => {
      try { socket.destroy(); } catch {}
      resolve(res);
    };

    const timer = setTimeout(() => done({ ok: false, error: "RCON_TIMEOUT" }), timeoutMs);

    socket.on("error", (e) => {
      clearTimeout(timer);
      done({ ok: false, error: "RCON_SOCKET_ERROR", detail: String(e?.message || e) });
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const packets = parsePackets(buffer);
      // very simple: if we parsed at least one full packet, drop consumed bytes by re-serializing remainder
      // (we don't track exact consumed; safest: reset buffer to empty because CS2 RCON responses are small and we don't need streaming)
      if (packets.length) buffer = Buffer.alloc(0);

      for (const p of packets) {
        // auth response: id == -1 if failed
        if (!authed && (p.type === SERVERDATA_AUTH_RESPONSE || p.type === SERVERDATA_EXECCOMMAND)) {
          if (p.id === -1) {
            clearTimeout(timer);
            return done({ ok: false, error: "RCON_AUTH_FAILED" });
          }
          // accept success
          authed = true;
          socket.write(buildPacket(cmdId, SERVERDATA_EXECCOMMAND, command));
        } else if (authed && p.id === cmdId) {
          clearTimeout(timer);
          return done({ ok: true, body: p.body });
        }
      }
    });

    socket.connect(opts.port, opts.host, () => {
      socket.write(buildPacket(authId, SERVERDATA_AUTH, opts.password));
    });
  });
}


// Back-compat alias (older code may import cs2RconExec)
export const cs2RconExec = rconExec;
