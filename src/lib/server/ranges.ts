import { addDays, dayKey, isDateString, zonedToUtc } from '../time';

/** Resolve the report range from ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive), defaulting to this year. */
export function resolveRange(url: URL, tz: string, now = Date.now()) {
	const today = dayKey(now, tz);
	const year = today.slice(0, 4);
	const month = today.slice(0, 7);
	const presets = {
		month: { label: 'This month', from: `${month}-01`, to: today },
		lastMonth: (() => {
			const firstThis = `${month}-01`;
			const lastPrev = addDays(firstThis, -1);
			return { label: 'Last month', from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
		})(),
		year: { label: 'This year', from: `${year}-01-01`, to: today },
		lastYear: {
			label: 'Last year',
			from: `${Number(year) - 1}-01-01`,
			to: `${Number(year) - 1}-12-31`
		},
		all: { label: 'All time', from: '2000-01-01', to: today }
	};
	const fromParam = url.searchParams.get('from') ?? '';
	const toParam = url.searchParams.get('to') ?? '';
	const from = isDateString(fromParam) ? fromParam : presets.year.from;
	const to = isDateString(toParam) ? toParam : presets.year.to;
	return {
		from,
		to,
		fromMs: zonedToUtc(from, '00:00', tz),
		toMs: zonedToUtc(addDays(to, 1), '00:00', tz),
		presets: Object.entries(presets).map(([key, p]) => ({ key, ...p }))
	};
}
