// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.provide("website");

$.extend(frappe, {
	_assets_loaded: [],
	require: function(url) {
		if(frappe._assets_loaded.indexOf(url)!==-1) return;
		$.ajax({
			url: url,
			async: false,
			dataType: "text",
			success: function(data) {
				if(url.split(".").splice(-1) == "js") {
					var el = document.createElement('script');
				} else {
					var el = document.createElement('style');
				}
				el.appendChild(document.createTextNode(data));
				document.getElementsByTagName('head')[0].appendChild(el);
				frappe._assets_loaded.push(url);
			}
		});
	},
	hide_message: function(text) {
		$('.message-overlay').remove();
	},
	call: function(opts) {
		// opts = {"method": "PYTHON MODULE STRING", "args": {}, "callback": function(r) {}}
		frappe.prepare_call(opts);
		return $.ajax({
			type: opts.type || "POST",
			url: "/",
			data: opts.args,
			dataType: "json",
			statusCode: {
				404: function(xhr) {
					frappe.msgprint(__("Not found"));
				},
				403: function(xhr) {
					frappe.msgprint(__("Not permitted"));
				},
				200: function(data, xhr) {
					if(opts.callback)
						opts.callback(data);
				}
			}
		}).always(function(data) {
			// executed before statusCode functions
			if(data.responseText) {
				data = JSON.parse(data.responseText);
			}
			frappe.process_response(opts, data);
		});
	},
	prepare_call: function(opts) {
		if(opts.btn) {
			$(opts.btn).prop("disabled", true);
		}

		if(opts.msg) {
			$(opts.msg).toggle(false);
		}

		if(!opts.args) opts.args = {};

		// get or post?
		if(!opts.args._type) {
			opts.args._type = opts.type || "GET";
		}

		// method
		if(opts.method) {
			opts.args.cmd = opts.method;
		}

		// stringify
		$.each(opts.args, function(key, val) {
			if(typeof val != "string") {
				opts.args[key] = JSON.stringify(val);
			}
		});

		if(!opts.no_spinner) {
			//NProgress.start();
		}
	},
	process_response: function(opts, data) {
		//if(!opts.no_spinner) NProgress.done();

		if(opts.btn) {
			$(opts.btn).prop("disabled", false);
		}

		if(data.exc) {
			if(opts.btn) {
				$(opts.btn).addClass("btn-danger");
				setTimeout(function() { $(opts.btn).removeClass("btn-danger"); }, 1000);
			}
			try {
				var err = JSON.parse(data.exc);
				if($.isArray(err)) {
					err = err.join("\n");
				}
				console.error ? console.error(err) : console.log(err);
			} catch(e) {
				console.log(data.exc);
			}

			if (data._server_messages) {
				var server_messages = (JSON.parse(data._server_messages || '[]')).join("<br>");
				if(opts.error_msg) {
					$(opts.error_msg).html(server_messages).toggle(true);
				} else {
					frappe.msgprint(server_messages);
				}
			}
		} else{
			if(opts.btn) {
				$(opts.btn).addClass("btn-success");
				setTimeout(function() { $(opts.btn).removeClass("btn-success"); }, 1000);
			}
		}
		if(opts.msg && data.message) {
			$(opts.msg).html(data.message).toggle(true);
		}
	},
	show_message: function(text, icon) {
		if(!icon) icon="icon-refresh icon-spin";
		frappe.hide_message();
		$('<div class="message-overlay"></div>')
			.html('<div class="content"><i class="'+icon+' text-muted"></i><br>'
				+text+'</div>').appendTo(document.body);
	},
	hide_message: function(text) {
		$('.message-overlay').remove();
	},
	get_sid: function() {
		var sid = getCookie("sid");
		return sid && sid!=="Guest";
	},
	get_modal: function(title, body_html) {
		var modal = $('<div class="modal" style="overflow: auto;" tabindex="-1">\
			<div class="modal-dialog">\
				<div class="modal-content">\
					<div class="modal-header">\
						<a type="button" class="close"\
							data-dismiss="modal" aria-hidden="true">&times;</a>\
						<h4 class="modal-title">'+title+'</h4>\
					</div>\
					<div class="modal-body ui-front">'+body_html+'\
					</div>\
				</div>\
			</div>\
			</div>').appendTo(document.body);

		return modal;
	},
	msgprint: function(html, title) {
		if(html.substr(0,1)==="[") html = JSON.parse(html);
		if($.isArray(html)) {
			html = html.join("<hr>")
		}
		return frappe.get_modal(title || "Message", html).modal("show");
	},
	send_message: function(opts, btn) {
		return frappe.call({
			type: "POST",
			method: "frappe.templates.pages.contact.send_message",
			btn: btn,
			args: opts,
			callback: opts.callback
		});
	},
	has_permission: function(doctype, docname, perm_type, callback) {
		return frappe.call({
			method: "frappe.client.has_permission",
			no_spinner: true,
			args: {doctype: doctype, docname: docname, perm_type: perm_type},
			callback: function(r) {
				if(!r.exc && r.message.has_permission) {
					if(callback) { return callback(r); }
				}
			}
		});
	},
	render_user: function() {
		var sid = frappe.get_cookie("sid");
		if(sid && sid!=="Guest") {
			$(".btn-login-area").toggle(false);
			$(".logged-in").toggle(true);
			$(".full-name").html(frappe.get_cookie("full_name"));
			$(".user-picture").attr("src", frappe.get_cookie("user_image"));
		}
	},
	setup_push_state: function() {
		if(frappe.supports_pjax()) {
			// hack for chrome's onload popstate call
			window.initial_href = window.location.href
			$(document).on("click", "#wrap a", frappe.handle_click);

			$(window).on("popstate", function(event) {
				// don't run this on hash change
				if (location.hash && (!window.previous_href || window.previous_href.replace(location.hash, '') ===
					 location.href.replace(location.hash, '')))
					 return;

				// hack for chrome's onload popstate call
				if(window.initial_href==location.href && window.previous_href==undefined) {
					window.history.replaceState({"reload": true},
						window.document.title, location.href);
					return;
				}

				window.previous_href = location.href;
				var state = event.originalEvent.state;
				if(!state) {
					window.location.reload();
					return;
				}
				frappe.render_json(state);
			});
		}
	},
	handle_click: function(event) {
		// taken from jquery pjax
		var link = event.currentTarget

		if (link.tagName.toUpperCase() !== 'A')
			throw "using pjax requires an anchor element";

		// Middle click, cmd click, and ctrl click should open
		// links in a new tab as normal.
		if ( event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey )
			return;

		if (link.getAttribute("target"))
			return;

		// Ignore cross origin links
		if ( location.protocol !== link.protocol || location.hostname !== link.hostname )
			return;

		// Ignore anchors on the same page
		if (link.hash && link.href.replace(link.hash, '') ===
			 location.href.replace(location.hash, ''))
			 return;

		// Ignore empty anchor "foo.html#"
		if (link.href === location.href + '#')
			return;

		// our custom logic
		if (link.href.indexOf("cmd=")!==-1 || link.hasAttribute("no-pjax"))
			return;

		// has an extension, but is not htm/html
		var last_part = (link.href.split("/").slice(-1)[0] || "");
		if (last_part.indexOf(".")!==-1 && (last_part.indexOf(".htm")===-1))
			return;

		event.preventDefault()
		frappe.load_via_ajax(link.href);

	},
	load_via_ajax: function(href) {
		// console.log("calling ajax");
		window.previous_href = href;
		history.pushState(null, null, href);

		var _render = function(data) {
			try {
				history.replaceState(data, data.title, href);
			} catch(e) {
				// data too big (?)
				history.replaceState(null, data.title, href);
			}
			scroll(0,0);
			frappe.render_json(data);
		};

		$.ajax({
			url: href,
			cache: false,
			statusCode: {
				200: _render,
				404: function(xhr) { _render(xhr.responseJSON); }
			}
		}).fail(function(xhr, status, error) {
			window.location.reload();
		});
	},
	render_json: function(data) {
		if (data.reload) {
			window.location.reload();
			return;
		}

		$('[data-html-block]').each(function(i, section) {
			var $section = $(section);
			var stype = $section.attr("data-html-block");


			// handle meta separately
			if (stype==="meta_block") return;

			var block_data = data[stype] || "";

			// NOTE: use frappe.ready instead of $.ready for reliable execution
			if(stype==="script") {
				$section.remove();
				$("<script data-html-block='script'></script>")
					.html(block_data)
					.appendTo("body");
			} else if(stype==="script_lib") {
				// render once
				if(!$("[data-block-html='script_lib'][data-path='"+data.path+"']").length) {
					$("<script data-block-html='script_lib' data-path='"+data.path+"'></script>")
					.html(data.script_lib)
					.appendTo("body");
				}
			} else {
				$section.html(block_data);
			}
		});
		if(data.title) $("title").html(data.title);

		// change meta tags
		$('[data-html-block="meta_block"]').remove();
		if(data.meta_block) {
			$("head").append(data.meta_block);
		}

		// change id of current page
		$(".page-container").attr("id", "page-" + data.path);

		// clear page-header-right
		$(".page-header-right").html("");

		window.ga && ga('send', 'pageview', location.pathname);
		$(document).trigger("page-change");
	},
	supports_pjax: function() {
		return (window.history && window.history.pushState && window.history.replaceState &&
		  // pushState isn't reliable on iOS until 5.
		  !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/))
	},
	get_pathname: function() {
		return location.pathname && location.pathname.split("/")[1].split(".")[0];
	},
	page_ready_events: {},
	ready: function(fn) {
		if(!frappe.page_ready_events[frappe.get_pathname()]) {
			frappe.page_ready_events[frappe.get_pathname()] = [];
		}
		frappe.page_ready_events[frappe.get_pathname()].push(fn);
	},
	trigger_ready: function() {
		$.each((frappe.page_ready_events[frappe.get_pathname()] || []), function(i, fn) {
			fn();
		});
	},
	make_navbar_active: function() {
		var pathname = window.location.pathname;
		$(".navbar a.active").removeClass("active");
		$(".navbar a").each(function() {
			var href = $(this).attr("href");
			if(href===pathname) {
				$(this).addClass("active");
				return false;
			}
		})
	},
	toggle_template_blocks: function() {
		// this assumes frappe base template
		$(".page-header").toggleClass("hidden",
			!!!$("[data-html-block='header']").text().trim());

		$(".page-footer").toggleClass("hidden",
			!!!$(".page-footer").text().trim());

		// hide breadcrumbs if no breadcrumb content or if it is same as the header
		$("[data-html-block='breadcrumbs'] .breadcrumb").toggleClass("hidden",
			!$("[data-html-block='breadcrumbs']").text().trim() ||
			$("[data-html-block='breadcrumbs']").text().trim()==$("[data-html-block='header']").text().trim());

		// to show full content width, when no sidebar content
		var sidebar_has_content = !!$("[data-html-block='sidebar']").html().trim();
		$(".page-sidebar, .toggle-sidebar").toggleClass("hidden", !sidebar_has_content);
		$(".page-sidebar").toggleClass("col-sm-push-9", sidebar_has_content);
		$(".page-content").toggleClass("col-sm-12", !sidebar_has_content);
		$(".page-content").toggleClass("col-sm-9 col-sm-pull-3", sidebar_has_content);

		// if everything in the sub-header is hidden, hide the sub-header
		// var hide_sub_header = $(".page-sub-header .row").children().length === $(".page-sub-header .row").find(".hidden").length;
		// $(".page-sub-header").toggleClass("hidden", hide_sub_header);


		// collapse sidebar in mobile view on page change
		if(!$(".page-sidebar").hasClass("hidden-xs")) {
			$(".toggle-sidebar").trigger("click");
		}

		// TODO add private pages to sidebar
		// if(website.private_pages && $(".page-sidebar").length) {
		// 	$(website.private_pages).prependTo(".page-sidebar");
		// }
	}
});


// Utility functions

function valid_email(id) {
	return (id.toLowerCase().search("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")==-1) ? 0 : 1;

}

var validate_email = valid_email;

function get_url_arg(name) {
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var results = regex.exec( window.location.href );
	if(results == null)
		return "";
	else
		return decodeURIComponent(results[1]);
}

function make_query_string(obj) {
	var query_params = [];
	$.each(obj, function(k, v) { query_params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); });
	return "?" + query_params.join("&");
}

function repl(s, dict) {
	if(s==null)return '';
	for(key in dict) {
		s = s.split("%("+key+")s").join(dict[key]);
	}
	return s;
}

function replace_all(s, t1, t2) {
	return s.split(t1).join(t2);
}

function getCookie(name) {
	return getCookies()[name];
}

frappe.get_cookie = getCookie;

function getCookies() {
	var c = document.cookie, v = 0, cookies = {};
	if (document.cookie.match(/^\s*\$Version=(?:"1"|1);\s*(.*)/)) {
		c = RegExp.$1;
		v = 1;
	}
	if (v === 0) {
		c.split(/[,;]/).map(function(cookie) {
			var parts = cookie.split(/=/, 2),
				name = decodeURIComponent(parts[0].trimLeft()),
				value = parts.length > 1 ? decodeURIComponent(parts[1].trimRight()) : null;
			if(value && value.charAt(0)==='"') {
				value = value.substr(1, value.length-2);
			}
			cookies[name] = value;
		});
	} else {
		c.match(/(?:^|\s+)([!#$%&'*+\-.0-9A-Z^`a-z|~]+)=([!#$%&'*+\-.0-9A-Z^`a-z|~]*|"(?:[\x20-\x7E\x80\xFF]|\\[\x00-\x7F])*")(?=\s*[,;]|$)/g).map(function($0, $1) {
			var name = $0,
				value = $1.charAt(0) === '"'
						  ? $1.substr(1, -1).replace(/\\(.)/g, "$1")
						  : $1;
			cookies[name] = value;
		});
	}
	return cookies;
}

if (typeof String.prototype.trimLeft !== "function") {
	String.prototype.trimLeft = function() {
		return this.replace(/^\s+/, "");
	};
}
if (typeof String.prototype.trimRight !== "function") {
	String.prototype.trimRight = function() {
		return this.replace(/\s+$/, "");
	};
}
if (typeof Array.prototype.map !== "function") {
	Array.prototype.map = function(callback, thisArg) {
		for (var i=0, n=this.length, a=[]; i<n; i++) {
			if (i in this) a[i] = callback.call(thisArg, this[i]);
		}
		return a;
	};
}

function remove_script_and_style(txt) {
	return (!txt || (txt.indexOf("<script>")===-1 && txt.indexOf("<style>")===-1)) ? txt :
		$("<div></div>").html(txt).find("script,noscript,style,title,meta").remove().end().html();
}

function is_html(txt) {
	if(txt.indexOf("<br>")==-1 && txt.indexOf("<p")==-1
		&& txt.indexOf("<img")==-1 && txt.indexOf("<div")==-1) {
		return false;
	}
	return true;
}

function ask_to_login() {
	if(!window.full_name) {
		if(localStorage) {
			localStorage.setItem("last_visited",
				window.location.href.replace(window.location.origin, ""));
		}
		window.location.href = "login";
	}
}

// check if logged in?
$(document).ready(function() {
	window.full_name = getCookie("full_name");
	window.logged_in = getCookie("sid") && getCookie("sid")!=="Guest";
	$("#website-login").toggleClass("hide", logged_in ? true : false);
	$("#website-post-login").toggleClass("hide", logged_in ? false : true);

	$(".toggle-sidebar").on("click", function() {
		$(".page-sidebar").toggleClass("hidden-xs");
		$(".toggle-sidebar i").toggleClass("icon-rotate-180");
	});

	// switch to app link
	if(getCookie("system_user")==="yes") {
		$("#website-post-login .dropdown-menu").append('<li class="divider"></li>\
			<li><a href="/desk" no-pjax><i class="icon-fixed-width icon-th-large"></i> ' + __("Switch To Desk") + '</a></li>');
	}

	frappe.render_user();
	frappe.setup_push_state()

	$(document).trigger("page-change");
});

$(document).on("page-change", function() {
	$(document).trigger("apply_permissions");
	frappe.datetime.refresh_when();
	frappe.toggle_template_blocks();
	frappe.trigger_ready();
	frappe.make_navbar_active();
});
