frappe.provide("frappe.ui.form");

frappe.ui.form.PrintPreview = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make();
		this.bind_events();
	},
	make: function() {
		this.wrapper = $('<div class="form-print-wrapper">\
			<div class="print-toolbar row" style="padding-top: 5px; padding-bottom: 5px; margin-top: -15px; \
				margin-bottom: 15px; padding-left: 15px; position:relative;">\
				<i class="text-muted icon-print" style="position: absolute; top: 13px; left: 10px; "></i>\
				<div class="col-xs-3">\
					<select class="print-preview-select form-control"></select></div>\
				<div class="col-xs-3">\
					<div class="checkbox"><label><input type="checkbox" class="print-letterhead" /> ' + __("Letterhead") + '</label></div></div>\
				<div class="col-xs-6 text-right" style="padding-top: 7px;">\
					<a style="margin-right: 7px;" class="btn-print-preview text-muted small">' + __("Preview") + '</a>\
					<a style="margin-right: 7px;" class="btn-download-pdf text-muted small">\
						<span class="octicon octicon-file-pdf"></span> ' + __("Download PDF") + '</a>\
					<strong><a style="margin-right: 7px;" class="btn-print-print">' + __("Print") + '</a></strong>\
					<a class="close">×</a>\
				</div>\
			</div>\
			<div class="print-preview">\
				<div class="print-format"></div>\
			</div>\
		</div>')
			.appendTo(this.frm.layout_main)
			.toggle(false);
	},
	bind_events: function() {
		var me = this;
		this.wrapper.find(".close").click(function() {
			me.frm.hide_print();
		});

		this.print_formats = frappe.meta.get_print_formats(this.frm.meta.name);
		this.print_letterhead = this.wrapper
			.find(".print-letterhead")
			.on("change", function() { me.print_sel.trigger("change"); })
			.prop("checked", cint(
				(frappe.model.get_doc(":Print Settings", "Print Settings")
					|| {with_letterhead: 1}).with_letterhead) ? true : false);
		this.print_sel = this.wrapper
			.find(".print-preview-select")
			.on("change", function() {
				if(me.is_old_style()) {
					me.wrapper.find(".btn-download-pdf").toggle(false);
					me.preview_old_style();
				} else {
					me.wrapper.find(".btn-download-pdf").toggle(true);
					me.preview();
				}
			});

		this.wrapper.find(".btn-print-print").click(function() {
			if(me.is_old_style()) {
				me.print_old_style();
			} else {
				me.printit();
			}
		});

		this.wrapper.find(".btn-print-preview").click(function() {
			if(me.is_old_style()) {
				me.new_page_preview_old_style();
			} else {
				me.new_page_preview();
			}
		});

		this.wrapper.find(".btn-download-pdf").click(function() {
			if(!me.is_old_style()) {
				var w = window.open("/api/method/frappe.templates.pages.print.download_pdf?"
					+"doctype="+encodeURIComponent(me.frm.doc.doctype)
					+"&name="+encodeURIComponent(me.frm.doc.name)
					+"&format="+me.selected_format()
					+"&no_letterhead="+(me.with_letterhead() ? "0" : "1"));
				if(!w) {
					msgprint(__("Please enable pop-ups")); return;
				}
			}
		});
	},
	preview: function() {
		var me = this;
		this.get_print_html(function(html) {
			me.wrapper.find(".print-format").html(html);
		});
	},
	printit: function() {
		this.new_page_preview(true);
	},
	new_page_preview: function(printit) {
		var me = this;
		this.get_print_html(function(html) {
			var w = window.open("/print?"
				+"doctype="+encodeURIComponent(me.frm.doc.doctype)
				+"&name="+encodeURIComponent(me.frm.doc.name)
				+(printit ? "&trigger_print=1" : "")
				+"&format="+me.selected_format()
				+"&no_letterhead="+(me.with_letterhead() ? "0" : "1"));
			if(!w) {
				msgprint(__("Please enable pop-ups")); return;
			}
		});
	},
	get_print_html: function(callback) {
		frappe.call({
			method: "frappe.templates.pages.print.get_html",
			args: {
				doc: this.frm.doc,
				print_format: this.selected_format(),
				no_letterhead: !this.with_letterhead() ? 1 : 0
			},
			callback: function(r) {
				if(!r.exc) {
					callback(r.message);
				}
			}
		});
	},
	preview_old_style: function() {
		var me = this;
		this.with_old_style({
			format: me.print_sel.val(),
			callback: function(html) {
				me.wrapper.find(".print-format").html('<div class="alert alert-warning">'
					+__("Warning: This Print Format is in old style and cannot be generated via the API.")
					+'</div>'
					+ html);
			},
			no_letterhead: !this.with_letterhead(),
			only_body: true,
			no_heading: true
		});
	},
	with_old_style: function(opts) {
		var me = this;
		frappe.require("/assets/js/print_format_v3.min.js");
		_p.build(opts.format, opts.callback, opts.no_letterhead, opts.only_body, opts.no_heading);
	},
	print_old_style: function() {
		frappe.require("/assets/js/print_format_v3.min.js");
		_p.build(this.print_sel.val(), _p.go,
			!this.with_letterhead());
	},
	new_page_preview_old_style: function() {
		frappe.require("/assets/js/print_format_v3.min.js");
		_p.build(this.print_sel.val(), _p.preview,
			!this.with_letterhead());
	},
	selected_format: function() {
		return this.print_sel.val();
	},
	is_old_style: function(format) {
		return this.get_print_format(format).print_format_type==="Client";
	},
	get_print_format: function(format) {
		if (!format) {
			format = this.selected_format();
		}

		if(locals["Print Format"] && locals["Print Format"][format]) {
			return locals["Print Format"][format]
		} else {
			return {}
		}
	},
	with_letterhead: function() {
		return this.print_letterhead.is(":checked") ? 1 : 0;
	}
})
