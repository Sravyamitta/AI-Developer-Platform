import { Response } from "express";

/** Set SSE headers and return helpers to write events and close the stream. */
export function startSSE(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const send = (event: string, data: string) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const done = () => {
    res.write("event: done\ndata: {}\n\n");
    res.end();
  };

  const error = (msg: string) => {
    res.write(`event: error\ndata: ${JSON.stringify(msg)}\n\n`);
    res.end();
  };

  return { send, done, error };
}
