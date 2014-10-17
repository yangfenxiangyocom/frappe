// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

$(document).ready(function() {

	$('.btn-send').click(function() {
		//prepare translation fix
		messages_trans = {'Please enter both your email and message so that we can get back to you. Thanks!':"请输入您的邮件和咨询信息,谢谢",'You seem to have written your name instead of your email. Please enter a valid email address so that we can get back.':"请输入有效的邮件地址",	'Thank you for your message':"谢谢您,我们将尽快反馈",'There were errors':"发送失败请尝试联系在线客服"};
		$.extend(frappe._messages, messages_trans);
		
		var email = $('[name="email"]').val();
		var message = $('[name="message"]').val();

		if(!(email && message)) {
			msgprint(__("Please enter both your email and message so that we can get back to you. Thanks!"));
			return false;
		}

		if(!valid_email(email)) {
				msgprint(__("You seem to have written your name instead of your email. Please enter a valid email address so that we can get back."));
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
