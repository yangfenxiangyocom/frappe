frappe.provide('frappe.ui.misc');
frappe.ui.misc.about = function() {
	if(!frappe.ui.misc.about_dialog) {
		var d = new frappe.ui.Dialog({title: __('Frappe Framework')})

		$(d.body).html(repl("<div>\
		<p>"+__("Open Source Web Applications for the Web")+"</p>  \
		<h4>Installed Apps</h4>\
		<div id='about-app-versions'>" + __("Loading versions") + "...</div>\
		<hr>\
		<p class='text-muted'>&copy; 2014 ERP Boost All rights reserved </p> \
		</div>", frappe.app));

		frappe.ui.misc.about_dialog = d;

		frappe.ui.misc.about_dialog.onshow = function() {
			if(!frappe.versions) {
				frappe.call({
					method: "frappe.get_versions",
					callback: function(r) {
						show_versions(r.message);
					}
				})
			}
		};

		var show_versions = function(versions) {
			var $wrap = $("#about-app-versions").empty();
			$.each(keys(versions).sort(), function(i, key) {
				var v = versions[key];
				$($.format('<p><b>{0}:</b> v{1}<br><span class="text-muted">{2}</span></p>',
					[v.title[0], v.version, v.description[0]])).appendTo($wrap);
			});

			frappe.versions = versions;
		}

	}

	frappe.ui.misc.about_dialog.show();

}
