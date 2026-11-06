/** Renders simple, accessible transactional emails in both plain text and HTML. */

export interface EmailParts {
	greeting?: string;
	intro: string[];
	details?: [label: string, value: string][];
	actions?: { label: string; url: string; primary?: boolean }[];
	outro?: string[];
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function paragraphHtml(text: string): string {
	return `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

export function renderEmail(
	orgName: string,
	subject: string,
	parts: EmailParts
): { text: string; html: string } {
	const text: string[] = [];
	if (parts.greeting) text.push(parts.greeting, '');
	for (const p of parts.intro) text.push(p, '');
	if (parts.details?.length) {
		for (const [label, value] of parts.details) text.push(`${label}: ${value}`);
		text.push('');
	}
	for (const a of parts.actions ?? []) text.push(`${a.label}: ${a.url}`);
	if (parts.actions?.length) text.push('');
	for (const p of parts.outro ?? []) text.push(p, '');
	text.push('—', orgName);

	const details = parts.details?.length
		? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f4f7f6;border-radius:10px">
			${parts.details
				.map(
					([label, value]) =>
						`<tr><td style="padding:10px 14px;color:#5d6662;font-size:13px;width:90px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 14px;font-weight:600;vertical-align:top">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
				)
				.join('')}
		</table>`
		: '';

	const actions = (parts.actions ?? [])
		.map((a, i) => {
			const primary = a.primary ?? i === 0;
			const style = primary
				? 'background:#0f766e;color:#ffffff;border:1px solid #0f766e'
				: 'background:#ffffff;color:#0f766e;border:1px solid #c9d6d3';
			return `<a href="${escapeHtml(a.url)}" style="display:inline-block;margin:0 8px 10px 0;padding:11px 18px;border-radius:8px;font-weight:600;text-decoration:none;${style}">${escapeHtml(a.label)}</a>`;
		})
		.join('');

	const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d2321;font-size:15px">
	<div style="max-width:560px;margin:0 auto;padding:28px 16px">
		<div style="font-weight:700;font-size:16px;color:#0f766e;margin-bottom:16px">${escapeHtml(orgName)}</div>
		<div style="background:#ffffff;border:1px solid #e3e3dc;border-radius:14px;padding:28px">
			${parts.greeting ? paragraphHtml(parts.greeting) : ''}
			${parts.intro.map(paragraphHtml).join('')}
			${details}
			${actions ? `<div style="margin:4px 0 12px">${actions}</div>` : ''}
			${(parts.outro ?? []).map(paragraphHtml).join('')}
		</div>
		<p style="color:#7a837f;font-size:12px;line-height:1.5;margin:16px 4px 0">Sent by ${escapeHtml(orgName)} using Shiftnest, a free and open-source volunteer scheduler. No ads, no tracking.</p>
	</div>
</body>
</html>`;

	return { text: text.join('\n').trim() + '\n', html };
}
