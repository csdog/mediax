import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

/** Schedule-X week/day column header: show year when not the current year. */
export function WeekGridDate({ date }: { date: string }) {
  const day = new Date(`${date}T12:00:00`);
  const thisYear = new Date().getFullYear();
  const showYear = day.getFullYear() !== thisYear;

  return (
    <>
      <div className="sx__week-grid__day-name">{format(day, "EEE", { locale: zhCN })}</div>
      <div className="sx__week-grid__date-number">{format(day, "d")}</div>
      {showYear ? <div className="mediax-week-grid-year">{format(day, "yyyy")}</div> : null}
    </>
  );
}
