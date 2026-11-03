import { runRecurringForAllBooks } from "@/lib/data/recurring-job";

/** Daily Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runRecurringForAllBooks();
  return Response.json(result);
}
