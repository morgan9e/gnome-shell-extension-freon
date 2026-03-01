UUID = freon@UshakovVasilii_Github.yahoo.com
INSTALLDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all schemas install zip clean test

all: schemas

schemas:
	glib-compile-schemas $(UUID)/schemas

install: schemas
	rm -rf $(INSTALLDIR)
	cp -r $(UUID) $(INSTALLDIR)

zip: schemas
	cd $(UUID) && zip -x "*.pot" -x "*.po" -r ../$(UUID).zip *

clean:
	rm -f $(UUID).zip
	rm -f $(UUID)/schemas/gschemas.compiled

test: install
	dbus-run-session -- gnome-shell --devkit --wayland
