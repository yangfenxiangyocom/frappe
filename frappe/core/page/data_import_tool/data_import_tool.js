frappe.pages['data-import-tool'].onload = function(wrapper) {
	wrapper.app_page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Data Import / Export Tool"),
		icon: "icon-upload"
	});

	// check permission for import
	if(!((frappe.boot.user.can_import && frappe.boot.user.can_import.length) ||
		user_roles.indexOf("System Manager")!==-1)) {
			frappe.show_not_permitted("data-import-tool");
			return false;
		}

	$(wrapper).find('.layout-main-section').append('<h3>1. ' + __("Download Template") + '</h3>\
		<div style="min-height: 150px">\
			<p class="help">' + __("Download a template for importing a table.") + '</p>\
			<div class="row">\
				<div class="col-md-6">\
					<select class="form-control" style="width: 200px" name="dit-doctype">\
					</select><br><br>\
					<label>\
					    <input type="checkbox" name="dit-with-data"> <span>'+ __("Download with data") + '</span>\
					</label>\
					<p class="text-muted">' + __("Export all rows in CSV fields for re-upload. This is ideal for bulk-editing.") + '</p>\
				</div>\
				<div class="col-md-6">\
					<div class="alert alert-warning hide" id="dit-download"></div>\
				</div>\
			</div>\
		</div>\
		<hr>\
		<h3>2. '+ __("Import Data") + '</h3>\
		<p class="help">' + __("Attach .csv file to import data") + '</p>\
		<div id="dit-upload-area"></div><br>\
		<div class="dit-progress-area" style="display: None"></div>\
		<p id="dit-output"></p>\
		<div class="well">\
		<h4>' + __("Help: Importing non-English data in Microsoft Excel") + '</h4>\
				<p>' + __("While uploading non English files ensure that the encoding is UTF-8.") + '</p>\
				<ol>\
					<li>' + __("In Excel, save the file in CSV (Comma Delimited) format") + '</li>\
					<li>' + __("Open this saved file in Notepad") + '</li>\
					<li>' + __("Click on File -&gt; Save As") + '</li>\
					<li>' + __("File Name: &lt;your filename&gt;.csv<br />Save as type: Text Documents (*.txt)<br />Encoding: UTF-8") + '\
					</li>\
					<li>' + __("Click on Save") + '</li>\
				</ol>\
				</p>\
			</div>');

	$select = $(wrapper).find('[name="dit-doctype"]');

	frappe.messages.waiting($(wrapper).find(".dit-progress-area").toggle(false),
		__("Performing hardcore import process")+ "....", 100);

	// load doctypes
	frappe.call({
		method: 'frappe.core.page.data_import_tool.data_import_tool.get_doctypes',
		callback: function(r) {
			$select.add_options([__('Select') + '...'].concat(r.message));
			wrapper.doctypes = r.message;
			wrapper.set_route_options();
		}
	});

	wrapper.set_route_options = function() {
		if(frappe.route_options
			&& frappe.route_options.doctype
			&& in_list(wrapper.doctypes, frappe.route_options.doctype)) {
				$select.val(frappe.route_options.doctype).change();
				frappe.route_options = null;
		}
	}

	// check if template with_data is allowed
	var validate_download_with_data = function(doctype, verbose) {
		// if no export permission, uncheck with data
		var with_data = $('[name="dit-with-data"]').prop("checked");
		if(with_data && !frappe.model.can_export(doctype)) {
			$('[name="dit-with-data"]').prop("checked", false);
			with_data = false;

			if(verbose) {
				msgprint(__("You are not allowed to export the data of: {0}. Downloading empty template.", [doctype]));
			}
		}
		return with_data;
	};

	wrapper.add_template_download_link = function(doctype) {
		return $('<a style="cursor: pointer">')
			.html(doctype)
			.data('doctype', doctype)
			.data('all_doctypes', "No")
			.click(function() {
				var doctype = $(this).data('doctype');
				var parent_doctype = $('[name="dit-doctype"]').val();
				var with_data = validate_download_with_data(parent_doctype || doctype, true);
				window.location.href = repl(frappe.request.url
					+ '?cmd=%(cmd)s&doctype=%(doctype)s'
					+ '&parent_doctype=%(parent_doctype)s'
					+ '&with_data=%(with_data)s'
					+ '&all_doctypes=%(all_doctypes)s',
					{
						cmd: 'frappe.core.page.data_import_tool.exporter.get_template',
						doctype: doctype,
						parent_doctype: parent_doctype,
						with_data: with_data ? 'Yes' : 'No',
						all_doctypes: $(this).data('all_doctypes')
					});
			})
			.appendTo('#dit-download');
	}

	// load options
	$select.change(function() {
		var val = $(this).val()
		if(val!='Select...') {
			$('#dit-download').empty().removeClass("hide");

			frappe.model.with_doctype(val, function() {
				validate_download_with_data(val);

				// get options
				return frappe.call({
					btn: this,
					method: 'frappe.core.page.data_import_tool.data_import_tool.get_doctype_options',
					args: {doctype: val},
					callback: function(r) {
						$('<h4><i class="icon-download"></i>' + __("Download") + '</h4>').appendTo('#dit-download');
						var with_data = $('[name="dit-with-data"]:checked').length ? 'Yes' : 'No';
						// download link
						$.each(r.message, function(i, v) {
							if(i==0)
								$('<span>' + __("Main Table") + ':</span><br>').appendTo('#dit-download');
							if(i==1)
								$('<br><span>' + __("Child Tables") + ':</span><br>').appendTo('#dit-download');

							wrapper.add_template_download_link(v);
							$('#dit-download').append('<br>');
						});

						if(r.message.length > 1) {
							$('<br><span>' + __("All Tables (Main + Child Tables)") + ':</span><br>').appendTo('#dit-download');
							var link = wrapper
								.add_template_download_link(r.message[0])
								.data('all_doctypes', "Yes")
						}
					}
				})
			});
		}
	});

	var write_messages = function(r) {
		$(wrapper).find(".dit-progress-area").toggle(false);
		$("#dit-output").empty();

		$.each(r.messages, function(i, v) {
			var $p = $('<p></p>').html(frappe.markdown(v)).appendTo('#dit-output');
			$("<hr>").appendTo('#dit-output');
			if(v.substr(0,5)=='Error') {
				$p.css('color', 'red');
			} else if(v.substr(0,8)=='Inserted') {
				$p.css('color', 'green');
			} else if(v.substr(0,7)=='Updated') {
				$p.css('color', 'green');
			} else if(v.substr(0,5)=='Valid') {
				$p.css('color', '#777');
			}
		});
	}

	var onerror = function(r) {
		$(wrapper).find(".dit-progress-area").toggle(false);
		r.messages = $.map(r.message.messages, function(v) {
			var msg = v.replace("Inserted", "Valid")
				.replace("Updated", "Valid").split("<");
			if (msg.length > 1) {
				v = msg[0] + (msg[1].split(">").slice(-1)[0]);
			} else {
				v = msg[0];
			}
			return v;
		});

		r.messages = ["<h4 style='color:red'>" + __("Import Failed!") + "</h4>"]
			.concat(r.messages);

		write_messages(r);
	};

	// upload
	frappe.upload.make({
		parent: $('#dit-upload-area'),
		args: {
			method: 'frappe.core.page.data_import_tool.importer.upload'
		},
		onerror: onerror,
		callback: function(attachment, r) {
			if(r.message.error) {
				onerror(r);
			} else {
				// replace links if error has occured
				r.messages = ["<h4 style='color:green'>" + __("Import Successful!") + "</h4>"].
					concat(r.message.messages)

				write_messages(r);
			}
		}
	});

	// add overwrite option
	var $submit_btn = $('#dit-upload-area button.btn-upload')
		.html('<i class="icon-upload"></i> ' + __("Upload and Import"));

	$('<label><input type="checkbox" name="overwrite"> <span>' + __("Overwrite") + '</span></label>\
		<p class="text-muted">' + __("If you are uploading a child table (for example Item Price), the all the entries of that table will be deleted (for that parent record) and new entries will be made.") + '</p><br>')
		.insertBefore($submit_btn);

	// add submit option
	$('<label><input type="checkbox" name="_submit"> <span>' + __("Submit") + '</span></label>\
		<p class="text-muted">' + __("If you are inserting new records (overwrite not checked) and if you have submit permission, the record will be submitted.") + '</p><br>')
		.insertBefore($submit_btn);

	// add ignore option
	$('<label><input type="checkbox" name="ignore_encoding_errors"> <span>' + __("Ignore Encoding Errors") + '</span></label><br></br>')
		.insertBefore($submit_btn);

	// rename button
	$('#dit-upload-area button.btn-upload')
		.click(function() {
			$('#dit-output').empty();
			$(wrapper).find(".dit-progress-area").toggle(true);
		});
}

frappe.pages['data-import-tool'].onshow = function(wrapper) {
	wrapper.set_route_options && wrapper.set_route_options();
}
