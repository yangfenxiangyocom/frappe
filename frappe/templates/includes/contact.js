// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

$(document).ready(function() {

	$('.btn-send').click(function() {
		var email = $('[name="email"]').val();
		var message = $('[name="message"]').val();

		if(!(email && message)) {
			msgprint(__("Please enter both your email and message so that we \
				can get back to you. Thanks!"));
			return false;
		}

		if(!valid_email(email)) {
				msgprint(__("You seem to have written your name instead of your email. \
					Please enter a valid email address so that we can get back."));
				$('[name="email"]').focus();
				return false;
		}

		$("#contact-alert").toggle(false);
		frappe.send_message({
			subject: $('[name="subject"]').val(),
			sender: email,
			message: message,
			callback: function(r) {
				if(r.message==="okay") {
					msgprint(__("Thank you for your message"));
				} else {
					msgprint(__("There were errors"));
					console.log(r.exc);
				}
				$(':input').val('');
			}
		}, this);
	return false;
	});

});

var msgprint = function(txt) {
	if(txt) $("#contact-alert").html(txt).toggle(true);
}
