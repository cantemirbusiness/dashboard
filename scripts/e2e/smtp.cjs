// Minimal SMTP sink: stores each message as JSON lines in mail.jsonl
const net = require("net"); const fs = require("fs");
const out = process.argv[2] || "mail.jsonl";
net.createServer((sock) => {
  let data = false, buf = "", msg = { to: [], body: "" };
  const w = (s) => sock.write(s + "\r\n");
  w("220 sink ESMTP");
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) {
        if (line === ".") { data = false; fs.appendFileSync(out, JSON.stringify(msg) + "\n"); msg = { to: [], body: "" }; w("250 OK queued"); }
        else msg.body += (line.startsWith("..") ? line.slice(1) : line) + "\n";
        continue;
      }
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") { sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n"); }
      else if (cmd === "AUTH") w("235 OK");
      else if (cmd === "MAIL") w("250 OK");
      else if (cmd === "RCPT") { msg.to.push(line); w("250 OK"); }
      else if (cmd === "DATA") { data = true; w("354 go"); }
      else if (cmd === "QUIT") { w("221 bye"); sock.end(); }
      else w("250 OK");
    }
  });
}).listen(2525, "127.0.0.1");
