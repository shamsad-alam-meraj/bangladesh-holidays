/**
 * A dependency-free Node.js HTTP API (the same handlers work in Express, Fastify or Hono).
 * The script starts the server on a random port, calls it once, and exits.
 * Run: npm run build && node examples/node-http-server.ts
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { HolidayDataUnavailableError, InvalidDateError, createHolidayCalendar } from "bangladesh-holidays";

const calendar = createHolidayCalendar();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };
  try {
    if (url.pathname === "/holidays") {
      const year = Number(url.searchParams.get("year"));
      const locale = url.searchParams.get("locale") === "bn" ? "bn" : "en";
      return send(200, calendar.setLocale(locale).getHolidays({ year }));
    }
    if (url.pathname === "/business-day") {
      return send(200, calendar.getDayInfo(url.searchParams.get("date") ?? ""));
    }
    return send(404, { error: "not found" });
  } catch (error) {
    if (error instanceof InvalidDateError || error instanceof RangeError)
      return send(400, { error: error.message });
    if (error instanceof HolidayDataUnavailableError) return send(404, { error: error.message });
    return send(500, { error: "internal error" });
  }
});

server.listen(0, () => {
  const { port } = server.address() as AddressInfo;
  void (async () => {
    const day = (await (await fetch(`http://localhost:${port}/business-day?date=2027-03-26`)).json()) as {
      reason: string;
    };
    const holidays = (await (
      await fetch(`http://localhost:${port}/holidays?year=2027&locale=bn`)
    ).json()) as {
      name: string;
    }[];
    const missing = await fetch(`http://localhost:${port}/holidays?year=2030`);
    console.log(day.reason, holidays.length, holidays[0]?.name, missing.status); // holiday 23 শব-ই-বরাত 404
    server.close();
  })();
});
