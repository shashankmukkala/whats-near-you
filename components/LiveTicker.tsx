"use client";

import type { CityEvent } from "@/lib/supabase";
import { istToday } from "@/lib/season";

type LiveTickerProps = {
  events: CityEvent[];
};

export default function LiveTicker({ events }: LiveTickerProps) {
  const today = istToday();
  const activeEvents = events
    .filter((event) => event.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 8);

  if (activeEvents.length === 0) return null;

  const headlines = (
    <div className="live-ticker-group" aria-hidden="false">
      {activeEvents.map((event) => (
        <span key={event.id} className="live-ticker-item">
          <span className={event.event_date === today ? "live-ticker-flag-live" : "live-ticker-flag"}>
            {event.event_date === today ? "LIVE" : "UPCOMING"}
          </span>
          <span className="live-ticker-headline">{event.name}</span>
          {event.location && <span className="live-ticker-place">{event.location}</span>}
        </span>
      ))}
    </div>
  );

  return (
    <div className="live-ticker panel-elevated flex min-w-0 items-center overflow-hidden rounded-2xl px-3 py-2">
      <div className="live-ticker-label flex shrink-0 items-center gap-1.5 pr-3 text-[10px] font-bold tracking-[0.16em] text-rose-300 uppercase">
        <span className="live-dot" aria-hidden="true" />
        City broadcast
      </div>
      <div className="live-ticker-viewport min-w-0 flex-1 overflow-hidden">
        {/* Two identical groups, each at least as wide as the viewport, with
            the track animating exactly one group's width. That is what makes
            the loop seamless no matter how much content there is — the
            second group has already covered the viewport by the time the
            first scrolls off.
            It used to render a single static row whenever there was only one
            event, which is most of the time: a news channel does not stop
            its ticker because there is one headline, it repeats it. The
            duplicate is aria-hidden so a screen reader hears each headline
            once. */}
        <div className="live-ticker-track">
          {headlines}
          <div className="live-ticker-group" aria-hidden="true">
            {activeEvents.map((event) => (
              <span key={`repeat-${event.id}`} className="live-ticker-item">
                <span className={event.event_date === today ? "live-ticker-flag-live" : "live-ticker-flag"}>
                  {event.event_date === today ? "LIVE" : "UPCOMING"}
                </span>
                <span className="live-ticker-headline">{event.name}</span>
                {event.location && <span className="live-ticker-place">{event.location}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
