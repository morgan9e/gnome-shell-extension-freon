import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export default class WattdUtil {

    constructor() {
        this._powerDir = '/run/power';
        this._readings = [];
        this._updated = false;
        this._available = GLib.file_test(this._powerDir, GLib.FileTest.IS_DIR);
    }

    get available() {
        return this._available;
    }

    get updated() {
        return this._updated;
    }

    set updated(updated) {
        this._updated = updated;
    }

    execute(callback) {
        this._updated = false;
        this._readings = [];

        try {
            this._available = GLib.file_test(this._powerDir, GLib.FileTest.IS_DIR);
            if (!this._available) {
                return;
            }

            const directory = Gio.File.new_for_path(this._powerDir);
            let enumerator = null;

            try {
                enumerator = directory.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);

                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    if (info.get_file_type() !== Gio.FileType.REGULAR)
                        continue;

                    const name = info.get_name();
                    const file = directory.get_child(name);

                    try {
                        const [ok, contents] = file.load_contents(null);
                        if (!ok)
                            continue;

                        const value = parseFloat(new TextDecoder('utf-8').decode(contents).trim());
                        if (isNaN(value))
                            continue;

                        const feature = {
                            label: this._formatLabel(name),
                            power: Math.abs(value),
                        };

                        this._readings.push(feature);
                    } catch (e) {
                        logError(e, `[FREON] Failed to read wattd metric ${name}`);
                    }
                }
            } finally {
                if (enumerator !== null)
                    enumerator.close(null);
            }

            this._readings.sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric: true}));
        } catch (e) {
            logError(e, '[FREON] Failed to enumerate wattd metrics');
            this._available = false;
            this._readings = [];
        } finally {
            this._updated = true;
            if (callback)
                callback();
        }
    }

    get power() {
        return this._readings;
    }

    destroy() {
        this._readings = [];
    }

    _formatLabel(name) {
        const parts = name.split(/[-_]/).filter(part => part.length > 0);
        if (parts.length === 0)
            return name;

        return parts.map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
    }
}
