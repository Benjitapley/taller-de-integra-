// Loaded only in the isolated Next.js process. No external sockets or DNS.
const net = require("node:net");
const dns = require("node:dns");
const loopback = (host) => !host || ["127.0.0.1", "::1", "localhost"].includes(host);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof first === "object" ? first.host : typeof args[1] === "string" ? args[1] : undefined;
  if (!loopback(host)) {
    // Match Socket.connect's asynchronous error contract (including Undici).
    // No real connect is invoked; a blocked dev-server update check is catchable.
    process.nextTick(() => this.destroy(new Error("E2E: external socket forbidden")));
    return this;
  }
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (host, ...args) {
  if (!loopback(host)) throw new Error("E2E: external DNS forbidden");
  return lookup.call(this, host, ...args);
};
