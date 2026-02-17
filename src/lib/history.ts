/**
 * Colour history — undo/redo ring buffer for hex + name pairs.
 */

export interface HistoryEntry {
	hex: string;
	name: string;
}

export class ColourHistory {
	private stack: HistoryEntry[] = [];
	private cursor = -1;
	private maxSize: number;

	constructor(maxSize = 30) {
		this.maxSize = maxSize;
	}

	/** Push a new entry. Truncates any forward history. */
	push(hex: string, name: string): void {
		// Don't push duplicates
		if (this.cursor >= 0) {
			const current = this.stack[this.cursor];
			if (current.hex === hex && current.name === name) return;
		}

		// Truncate forward history
		this.stack = this.stack.slice(0, this.cursor + 1);

		// Push new entry
		this.stack.push({ hex, name });

		// Cap at max size
		if (this.stack.length > this.maxSize) {
			this.stack.shift();
		}

		this.cursor = this.stack.length - 1;
	}

	/** Move back in history. Returns the entry or null if at the start. */
	back(): HistoryEntry | null {
		if (!this.canGoBack) return null;
		this.cursor--;
		return this.stack[this.cursor];
	}

	/** Move forward in history. Returns the entry or null if at the end. */
	forward(): HistoryEntry | null {
		if (!this.canGoForward) return null;
		this.cursor++;
		return this.stack[this.cursor];
	}

	get canGoBack(): boolean {
		return this.cursor > 0;
	}

	get canGoForward(): boolean {
		return this.cursor < this.stack.length - 1;
	}

	get size(): number {
		return this.stack.length;
	}

	get currentIndex(): number {
		return this.cursor;
	}
}
