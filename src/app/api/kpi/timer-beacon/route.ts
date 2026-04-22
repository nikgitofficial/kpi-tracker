import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ProductivityTimer from "@/models/ProductivityTimer";

/**
 * POST /api/kpi/timer-beacon
 * ─────────────────────────
 * Called via navigator.sendBeacon() on page hide / unload.
 * Persists the final productiveSeconds so no time is lost
 * when the tab is closed.
 *
 * Security model:
 *   • No session check — beacon requests drop cookies in some
 *     browsers. Instead we validate ownership via the record's
 *     _id + timerStartEpoch guard so a stale/replayed beacon
 *     cannot overwrite a manual pause or end action.
 *   • Always returns 200 so the browser doesn't retry.
 *
 * Stale-beacon guard:
 *   The client sends the timerStartEpoch that was active when
 *   the beacon was created. We only apply the update if the DB
 *   record still has that exact epoch AND timerPaused is false,
 *   meaning no other action (pause, end, edit) has run since.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, productiveSeconds, timerStartEpoch } = body;

    if (!id) return NextResponse.json({ ok: false });

    await connectDB();

    await ProductivityTimer.findOneAndUpdate(
      {
        _id:             id,
        // Stale-beacon guard: only apply if the timer is still running
        // with the same start epoch the client observed.
        timerStartEpoch: timerStartEpoch ?? null,
        timerPaused:     false,
      },
      {
        $set: {
          productiveSeconds: Math.max(0, Number(productiveSeconds ?? 0)),
        },
      }
      // Intentionally no { new: true } — we don't need the result
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Swallow — beacon responses are not observed by the browser
    console.error("[POST /api/kpi/timer-beacon]", err);
    return NextResponse.json({ ok: false });
  }
}