/**
 * Whether `path` is a same-site path that's safe to redirect to: one leading
 * slash, never `//` or `/\` (which browsers treat as another site), and no
 * backslashes, whitespace or control characters anywhere.
 */
export function isSafePath(path: string | null | undefined): path is string {
	// eslint-disable-next-line no-control-regex
	return !!path && /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(path);
}
