import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import http2 from "node:http2";
import type { AddressInfo } from "node:net";
import { test, type TestContext } from "node:test";
import { otlpTarget, ship } from "../src/otlp";
import type { Line } from "../src/telemetry";

const line: Line = { v: 2, at: "2026-11-27T00:00:00.000Z", version: "0.5.0", event: "resolve", run: "r1", by: "human" };
const local: Line = { ...line, repo: "/home/someone/src/app" };

const collector = async (context: TestContext) => {
  const seen: { url?: string; headers?: IncomingHttpHeaders; body?: Buffer } = {};
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk)).on("end", () => {
      Object.assign(seen, { url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  return { seen, endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` };
};

test("http/json sends the event as an OTLP log record with headers and without the local repo path", async (context) => {
  const { seen, endpoint } = await collector(context);

  assert.equal(await ship(local, { MOP_OTLP_ENDPOINT: endpoint, MOP_OTLP_HEADERS: "Authorization=Basic%20abc" }), true);
  assert.equal(await ship(line, {}), false);
  assert.equal(await ship(line, { MOP_OTLP_ENDPOINT: "http://127.0.0.1:1" }), false);

  const [log] = JSON.parse(String(seen.body)).resourceLogs[0].scopeLogs[0].logRecords;
  assert.deepEqual([seen.url, seen.headers?.authorization, seen.headers?.["content-type"]], ["/v1/logs", "Basic abc", "application/json"]);
  assert.equal(log.timeUnixNano, "1795737600000000000");
  assert.deepEqual(JSON.parse(log.body.stringValue), line);
  assert.deepEqual(
    Object.fromEntries(log.attributes.map(({ key, value }: any) => [key, value.stringValue])),
    { "event.name": "mop.resolve", "mop.schema": "2", "mop.run": "r1", "mop.by": "human" },
  );
});

test("http/protobuf posts the encoded request to /v1/logs", async (context) => {
  const { seen, endpoint } = await collector(context);

  assert.equal(await ship(local, { MOP_OTLP_ENDPOINT: endpoint, MOP_OTLP_PROTOCOL: "http/protobuf" }), true);

  assert.deepEqual([seen.url, seen.headers?.["content-type"]], ["/v1/logs", "application/x-protobuf"]);
  assert.equal(seen.body?.[0], 0x0a);
  assert.ok(seen.body?.includes(JSON.stringify(line)));
  assert.ok(!seen.body?.includes("/home/someone"));
});

test("grpc calls LogsService/Export and reads grpc-status from the trailers", async (context) => {
  const seen: { path?: unknown; authorization?: unknown; frame?: Buffer } = {};
  let status = "0";
  const server = http2.createServer();
  server.on("stream", (stream, headers) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk)).on("end", () => {
      Object.assign(seen, { path: headers[":path"], authorization: headers.authorization, frame: Buffer.concat(chunks) });
      stream.respond({ ":status": 200, "content-type": "application/grpc" }, { waitForTrailers: true });
      stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": status }));
      stream.end(Buffer.from([0, 0, 0, 0, 0]));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const env = { MOP_OTLP_ENDPOINT: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, MOP_OTLP_PROTOCOL: "grpc", MOP_OTLP_HEADERS: "authorization=Bearer%20t" };

  assert.equal(await ship(line, env), true);
  assert.deepEqual([seen.path, seen.authorization], ["/opentelemetry.proto.collector.logs.v1.LogsService/Export", "Bearer t"]);
  assert.equal(seen.frame?.readUInt8(0), 0);
  assert.equal(seen.frame?.readUInt32BE(1), (seen.frame?.length ?? 0) - 5);

  status = "16";
  assert.equal(await ship(line, env), false);
  assert.equal(await ship(line, { ...env, MOP_OTLP_ENDPOINT: "http://127.0.0.1:1" }), false);
});

test("MOP_OTLP_ENDPOINT brings its own headers and protocol; the built-in collector gets no headers", () => {
  const builtIn = { endpoint: "https://otel.example.com", protocol: "grpc" };

  assert.deepEqual(otlpTarget({}, builtIn), { url: "https://otel.example.com", protocol: "grpc", headers: {} });
  assert.deepEqual(otlpTarget({ MOP_OTLP_HEADERS: "authorization=Basic%20mine", MOP_OTLP_PROTOCOL: "http/json" }, builtIn), {
    url: "https://otel.example.com",
    protocol: "grpc",
    headers: {},
  });
  assert.deepEqual(otlpTarget({ MOP_OTLP_ENDPOINT: "http://localhost:4318/", MOP_OTLP_HEADERS: "x-team=a" }, builtIn), {
    url: "http://localhost:4318/v1/logs",
    protocol: "http/json",
    headers: { "x-team": "a" },
  });
  assert.equal(otlpTarget({ MOP_OTLP_ENDPOINT: "http://localhost:4318/v1/logs", MOP_OTLP_PROTOCOL: "http/protobuf" })?.url, "http://localhost:4318/v1/logs");
  assert.equal(otlpTarget({ MOP_OTLP_ENDPOINT: "http://localhost:4318", MOP_OTLP_PROTOCOL: "thrift" }), undefined);
  assert.equal(otlpTarget({}, {}), undefined);
});
