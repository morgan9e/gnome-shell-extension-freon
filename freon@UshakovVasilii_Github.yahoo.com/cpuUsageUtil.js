import GLib from 'gi://GLib';

export default class CpuUsageUtil {

    constructor(intervalSeconds = 2) {
        this._updated = false;
        this._readings = [];
        this._prevSnapshot = null;
        this._intervalUsec = 0;
        this._lastUpdateUsec = 0;
        this.interval = intervalSeconds;

        // Take initial snapshot so the first real execute() can compute a delta
        this._prevSnapshot = this._readProcStat();
    }

    get available() {
        return this._prevSnapshot !== null;
    }

    get updated() {
        return this._updated;
    }

    set updated(updated) {
        this._updated = updated;
    }

    execute(callback) {
        const nowUsec = GLib.get_monotonic_time();
        const remaining = this._intervalUsec - (nowUsec - this._lastUpdateUsec);
        if (this._intervalUsec > 0 && this._lastUpdateUsec !== 0 && remaining > 0) {
            if (callback)
                callback();
            return;
        }

        this._updated = false;

        try {
            const snapshot = this._readProcStat();
            if (!snapshot || !this._prevSnapshot) {
                this._prevSnapshot = snapshot;
                return;
            }

            this._readings = [];

            const fields = snapshot.get('cpu');
            const prev = this._prevSnapshot.get('cpu');
            if (fields && prev) {
                const idle = (fields.idle + fields.iowait) - (prev.idle + prev.iowait);
                const total = fields.total - prev.total;

                if (total > 0) {
                    const usage = 100.0 * (1.0 - idle / total);
                    this._readings.push({
                        label: 'CPU Usage',
                        usage: Math.max(0, Math.min(100, usage)),
                    });
                }
            }

            this._prevSnapshot = snapshot;
        } catch (e) {
            logError(e, '[FREON] Failed to read CPU usage');
            this._readings = [];
        } finally {
            this._lastUpdateUsec = nowUsec;
            this._updated = true;
            if (callback)
                callback();
        }
    }

    get usage() {
        return this._readings;
    }

    destroy() {
        this._readings = [];
        this._prevSnapshot = null;
        this._lastUpdateUsec = 0;
    }

    set interval(seconds) {
        const clamped = Math.max(1, seconds | 0);
        this._intervalUsec = clamped * 1000000;
        this._lastUpdateUsec = 0;
    }

    _readProcStat() {
        let ok, contents;
        try {
            [ok, contents] = GLib.file_get_contents('/proc/stat');
        } catch (e) {
            return null;
        }

        if (!ok)
            return null;

        const text = new TextDecoder().decode(contents);
        const result = new Map();

        for (const line of text.split('\n')) {
            if (!line.startsWith('cpu'))
                continue;

            const parts = line.trim().split(/\s+/);
            const name = parts[0];

            // user nice system idle iowait irq softirq steal
            const user    = parseInt(parts[1]) || 0;
            const nice    = parseInt(parts[2]) || 0;
            const system  = parseInt(parts[3]) || 0;
            const idle    = parseInt(parts[4]) || 0;
            const iowait  = parseInt(parts[5]) || 0;
            const irq     = parseInt(parts[6]) || 0;
            const softirq = parseInt(parts[7]) || 0;
            const steal   = parseInt(parts[8]) || 0;

            const total = user + nice + system + idle + iowait + irq + softirq + steal;

            result.set(name, { idle, iowait, total });
        }

        return result.size > 0 ? result : null;
    }
}
