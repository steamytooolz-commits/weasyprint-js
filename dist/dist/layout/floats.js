// Float manager — shrink-to-fit exclusion zones for `float: left | right`.
export class FloatManager {
    widthPx;
    floats = [];
    constructor(widthPx) {
        this.widthPx = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 0;
    }
    addFloat(side, y, w, h) {
        const s = side === 'right' ? 'right' : 'left';
        const yy = Number.isFinite(y) ? y : 0;
        const ww = Number.isFinite(w) && w > 0 ? w : 0;
        const hh = Number.isFinite(h) && h > 0 ? h : 0;
        this.floats.push({ side: s, y: yy, w: ww, h: hh });
    }
    overlaps(f, y, h) {
        const queryH = h <= 0 ? 1 : h;
        const top = y;
        const bottom = y + queryH;
        const fTop = f.y;
        const fBottom = f.y + f.h;
        return fTop < bottom && top < fBottom;
    }
    /**
     * Available horizontal space for a block starting at `y` with height `h`.
     * Returns the x-offset of the content edge and the usable width after
     * excluding overlapping left/right floats.
     */
    availableWidthAt(y, h) {
        const yy = Number.isFinite(y) ? y : 0;
        const hh = Number.isFinite(h) ? h : 0;
        let left = 0;
        let right = 0;
        for (const f of this.floats) {
            if (!this.overlaps(f, yy, hh))
                continue;
            if (f.side === 'left')
                left = Math.max(left, f.w);
            else
                right = Math.max(right, f.w);
        }
        left = Math.min(left, this.widthPx);
        right = Math.min(right, Math.max(0, this.widthPx - left));
        return { x: left, width: Math.max(0, this.widthPx - left - right) };
    }
    /** Push `y` past floats required by `clear` (`left`/`right`/`both`). */
    clearY(clear, y) {
        const c = (clear ?? '').trim().toLowerCase();
        if (!c || c === 'none')
            return y;
        let res = Number.isFinite(y) ? y : 0;
        const wantsLeft = c.includes('left') || c.includes('both');
        const wantsRight = c.includes('right') || c.includes('both');
        if (!wantsLeft && !wantsRight)
            return res;
        for (const f of this.floats) {
            const bottom = f.y + f.h;
            if (bottom <= res)
                continue;
            if (f.side === 'left' && wantsLeft)
                res = Math.max(res, bottom);
            if (f.side === 'right' && wantsRight)
                res = Math.max(res, bottom);
        }
        return res;
    }
}
//# sourceMappingURL=floats.js.map