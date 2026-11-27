import http2 from "node:http2";
import type { Line } from "./telemetry";

type Env = Record<string, string | undefined>;

export type Protocol = "http/json" | "http/protobuf" | "grpc";

export interface BuiltInOtlp {
  endpoint?: string;
  protocol?: string;
}

export interface OtlpTarget {
  url: string;
  headers: Record<string, string>;
  protocol: Protocol;
}

declare const __SLOPMOP_OTLP__: BuiltInOtlp | undefined;

export const BUILT_IN_OTLP: BuiltInOtlp = typeof __SLOPMOP_OTLP__ === "object" ? __SLOPMOP_OTLP__ : {};

export const PROTOCOLS: readonly Protocol[] = ["http/json", "http/protobuf", "grpc"];

const TIMEOUT_MS = 5000;
const GRPC_PATH = "/opentelemetry.proto.collector.logs.v1.LogsService/Export";
const SEVERITY_INFO = 9;
const ATTRIBUTES = ["run", "origin", "branch", "head", "mop", "by"] as const;
const LOCAL_ONLY = new Set(["repo"]);

const isProtocol = (value: string): value is Protocol => (PROTOCOLS as readonly string[]).includes(value);

const parseHeaders = (headers = ""): Record<string, string> =>
  Object.fromEntries(
    headers.split(",").flatMap((pair) => {
      const split = pair.indexOf("=");
      if (split <= 0) return [];
      return [[decodeURIComponent(pair.slice(0, split).trim()).toLowerCase(), decodeURIComponent(pair.slice(split + 1).trim())]];
    }),
  );

export const otlpTarget = (env: Env = process.env, builtIn: BuiltInOtlp = BUILT_IN_OTLP): OtlpTarget | undefined => {
  const own = env.MOP_OTLP_ENDPOINT?.trim();
  const endpoint = own || builtIn.endpoint?.trim();
  const protocol = (own ? env.MOP_OTLP_PROTOCOL : builtIn.protocol)?.trim() || "http/json";
  if (!endpoint || !isProtocol(protocol)) return undefined;
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const url = protocol === "grpc" || base.endsWith("/v1/logs") ? base : `${base}/v1/logs`;
  return { url, protocol, headers: own ? parseHeaders(env.MOP_OTLP_HEADERS) : {} };
};

const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

export const otlpLogs = (line: Line) => ({
  resourceLogs: [
    {
      resource: { attributes: [attribute("service.name", "slopmop"), attribute("service.version", line.version)] },
      scopeLogs: [
        {
          scope: { name: "slopmop", version: line.version },
          logRecords: [
            {
              timeUnixNano: String(BigInt(Date.parse(line.at)) * 1_000_000n),
              severityNumber: SEVERITY_INFO,
              severityText: "INFO",
              eventName: `mop.${line.event}`,
              body: { stringValue: JSON.stringify(Object.fromEntries(Object.entries(line).filter(([key]) => !LOCAL_ONLY.has(key)))) },
              attributes: [
                attribute("event.name", `mop.${line.event}`),
                attribute("mop.schema", String(line.v)),
                ...ATTRIBUTES.flatMap((key) => {
                  const value = line[key];
                  return typeof value === "string" ? [attribute(`mop.${key}`, value)] : [];
                }),
              ],
            },
          ],
        },
      ],
    },
  ],
});

type Logs = ReturnType<typeof otlpLogs>;
type Attribute = ReturnType<typeof attribute>;
type LogRecord = Logs["resourceLogs"][number]["scopeLogs"][number]["logRecords"][number];

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_LENGTH = 2;
const utf8 = new TextEncoder();

const varint = (value: number | bigint): number[] => {
  const bytes: number[] = [];
  let rest = BigInt(value);
  while (rest > 0x7Fn) {
    bytes.push(Number(rest & 0x7Fn) | 0x80);
    rest >>= 7n;
  }
  bytes.push(Number(rest));
  return bytes;
};

const tag = (field: number, wire: number): number[] => varint(field * 8 + wire);
const message = (field: number, payload: number[]): number[] => [...tag(field, WIRE_LENGTH), ...varint(payload.length), ...payload];
const text = (field: number, value: string): number[] => message(field, [...utf8.encode(value)]);
const enumeration = (field: number, value: number): number[] => [...tag(field, WIRE_VARINT), ...varint(value)];
const fixed64 = (field: number, value: bigint): number[] => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return [...tag(field, WIRE_FIXED64), ...bytes];
};

const keyValues = (field: number, attributes: Attribute[]): number[] =>
  attributes.flatMap(({ key, value }) => message(field, [...text(1, key), ...message(2, text(1, value.stringValue))]));

const logRecord = (record: LogRecord): number[] => [
  ...fixed64(1, BigInt(record.timeUnixNano)),
  ...enumeration(2, record.severityNumber),
  ...text(3, record.severityText),
  ...message(5, text(1, record.body.stringValue)),
  ...keyValues(6, record.attributes),
  ...text(12, record.eventName),
];

export const encodeLogs = (logs: Logs): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(
    logs.resourceLogs.flatMap((resourceLogs) =>
      message(1, [
        ...message(1, keyValues(1, resourceLogs.resource.attributes)),
        ...resourceLogs.scopeLogs.flatMap(({ scope, logRecords }) =>
          message(2, [...message(1, [...text(1, scope.name), ...text(2, scope.version)]), ...logRecords.flatMap((record) => message(2, logRecord(record)))]),
        ),
      ]),
    ),
  );

const exportGrpc = (target: OtlpTarget, body: Uint8Array): Promise<boolean> =>
  new Promise((resolve) => {
    const session = http2.connect(target.url);
    const done = (ok: boolean) => {
      session.close();
      resolve(ok);
    };
    session.on("error", () => done(false));
    const frame = Buffer.alloc(5 + body.length);
    frame.writeUInt32BE(body.length, 1);
    frame.set(body, 5);
    const stream = session.request({
      ":method": "POST",
      ":path": GRPC_PATH,
      "content-type": "application/grpc",
      te: "trailers",
      ...target.headers,
    });
    let status: unknown;
    stream.on("response", (headers) => (status = headers["grpc-status"] ?? status));
    stream.on("trailers", (trailers) => (status = trailers["grpc-status"] ?? status));
    stream.on("error", () => done(false));
    stream.on("close", () => done(status === "0"));
    stream.setTimeout(TIMEOUT_MS, () => stream.close(http2.constants.NGHTTP2_CANCEL));
    stream.resume();
    stream.end(frame);
  });

const exportHttp = async (target: OtlpTarget, logs: Logs): Promise<boolean> => {
  const json = target.protocol === "http/json";
  const response = await fetch(target.url, {
    method: "POST",
    headers: { "content-type": json ? "application/json" : "application/x-protobuf", ...target.headers },
    body: json ? JSON.stringify(logs) : encodeLogs(logs),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await response.arrayBuffer();
  return response.ok;
};

export const ship = async (line: Line, env: Env = process.env, builtIn: BuiltInOtlp = BUILT_IN_OTLP): Promise<boolean> => {
  try {
    const target = otlpTarget(env, builtIn);
    if (!target) return false;
    const logs = otlpLogs(line);
    return target.protocol === "grpc" ? await exportGrpc(target, encodeLogs(logs)) : await exportHttp(target, logs);
  } catch {
    return false;
  }
};
