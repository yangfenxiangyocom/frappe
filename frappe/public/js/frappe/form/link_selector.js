// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.ui.form.LinkSelector = Class.extend({
	_help: __("Dialog box to select a Link Value"),
	init: function(opts) {
		/* help: Options: doctype, get_query, target */
		$.extend(this, opts);

		var me = this;
		if(this.doctype!="[Select]") {
			frappe.model.with_doctype(this.doctype, function(r) {
				me.make();
			});
		} else {
			this.make();
		}
	},
	make: function() {
		this.dialog = new frappe.ui.Dialog({
			title: __("Select {0}", [(this.doctype=='[Select]') ? __("value") : __(this.doctype)]),
			fields: [
				{
					fieldtype: "Data", fieldname: "txt", label: __("Beginning with"),
					description: __("You can use wildcard %"),
				},
				{
					fieldtype: "HTML", fieldname: "results"
				}
			],
			primary_action_label: __("Search"),
			primary_action: function() {
				me.search();
			}
		});
		me = this;

		if(this.txt)
			this.dialog.fields_dict.txt.set_input(this.txt);

		this.dialog.get_input("txt").on("keypress", function(e) {
			if(e.which===13) {
				me.search();
			}
		});
		this.dialog.show();
	},
	search: function(btn) {
		var args = {
				txt: this.dialog.fields_dict.txt.get_value(),
				doctype: this.doctype,
				searchfield: "name"
			},
			me = this;

		if(this.target.set_custom_query) {
			this.target.set_custom_query(args);
		}

		// load custom query from grid
		if(this.target.is_grid && this.target.fieldinfo[this.fieldname]
			&& this.target.fieldinfo[this.fieldname].get_query) {
			$.extend(args,
					this.target.fieldinfo[this.fieldname].get_query(cur_frm.doc));
		}

		return frappe.call({
			method: "frappe.widgets.search.search_widget",
			type: "GET",
			args: args,
			callback: function(r) {
				var parent = me.dialog.fields_dict.results.$wrapper;
				parent.empty();
				if(r.values.length) {
					$.each(r.values, function(i, v) {
						var row = $(repl('<p><b><a href="#" data-value="%(name)s">%(display_name)s</a></b> \
							<span class="text-muted">%(values)s</span></p>', {
								name: v[0],
								display_name: __(v[0]),
								values: __(v.splice(1).join(", "))
							})).appendTo(parent);

						row.find("a").click(function() {
							var value = $(this).attr("data-value");
							var $link = this;
							if(me.target.is_grid) {
								// set in grid
								me.set_in_grid(value);
							} else {
								if(me.target.doctype)
									me.target.parse_validate_and_set_in_model(value);
								else {
									me.target.set_input(value);
									me.target.$input.trigger("change");
								}
								me.dialog.hide();
							}
							return false;
						})
					})
				} else {
					$('<div class="alert alert-info">' + __("No Results")
						+ (frappe.model.can_read(me.doctype) ?
							('. <a class="new-doc">'
							+ __("Make a new") + " " + __(me.doctype) + "</a>") : '')
						+ '</div>').appendTo(parent).find(".new-doc").click(function() {
							cur_frm.new_doc(me.doctype, me.target);
						});
				}
			},
			btn: this.dialog.get_primary_btn()
		});
	},
	set_in_grid: function(value) {
		var me = this, updated = false;
		if(this.qty_fieldname) {
			$.each(this.target.frm.doc[this.target.df.fieldname] || [], function(i, d) {
				if(d[me.fieldname]===value) {
					frappe.model.set_value(d.doctype, d.name, me.qty_fieldname, d[me.qty_fieldname] + 1);
					show_alert(__("Added {0} ({1})", [value, d[me.qty_fieldname]]));
					updated = true;
					return false;
				}
			});
		}
		if(!updated) {
			var d = this.target.add_new_row();
			frappe.model.set_value(d.doctype, d.name, me.fieldname, value);
			show_alert(__("{0} added", [value]));
		}
	}
})
