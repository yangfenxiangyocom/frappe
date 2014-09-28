function prettyDate(time){
	if(moment && 1==2) {
		if(frappe.boot) {
			var user_timezone = frappe.boot.user.time_zone;
			var system_timezone = sys_defaults.time_zone;
			var zones = (frappe.boot.timezone_info || {}).zones || {};
		}
		if (frappe.boot && user_timezone && (user_timezone != system_timezone)
			&& zones[user_timezone] && zones[system_timezone]) {
			return moment.tz(time, sys_defaults.time_zone).tz(frappe.boot.user.time_zone).fromNow();
		} else {
			return moment(time).fromNow();
		}
	} else {
		if(!time) return ''
		var date = time;
		if(typeof(time)=="string")
			date = new Date((time || "").replace(/-/g,"/").replace(/[TZ]/g," ").replace(/\.[0-9]*/, ""));

		var diff = (((new Date()).getTime() - date.getTime()) / 1000),
		day_diff = Math.floor(diff / 86400);

		if ( isNaN(day_diff) || day_diff < 0 )
			return '';

		return when = day_diff == 0 && (
				diff < 60 && __("just now") ||
				diff < 120 && __("1 minute ago") ||
				diff < 3600 && __("{0} minutes ago",[Math.floor( diff / 60 )]) ||
				diff < 7200 && __("1 hour ago") ||
				diff < 86400 &&  __("{0} hours ago",[Math.floor( diff / 3600 )])) ||
			day_diff == 1 && __("Yesterday") ||
			day_diff < 7 && __("{0} days ago",[day_diff]) ||
			day_diff < 31 && __("{0} weeks ago",[Math.ceil( day_diff / 7 ) ]) ||
			day_diff < 365 && __("{0} months ago",[Math.ceil( day_diff / 30)]) ||
			"> " + __("{0} year(s) ago",[Math.floor( day_diff / 365 )]);
	}
}


var comment_when = function(datetime) {
	var timestamp = frappe.datetime.str_to_user ?
		frappe.datetime.str_to_user(datetime) : datetime;
	return '<span class="frappe-timestamp" data-timestamp="'+datetime
		+'" title="'+timestamp+'">'
		+ prettyDate(datetime) + '</span>';
};

frappe.provide("frappe.datetime");
frappe.datetime.comment_when = prettyDate;
frappe.datetime.refresh_when = function() {
	if(jQuery) {
		$(".frappe-timestamp").each(function() {
			$(this).html(prettyDate($(this).attr("data-timestamp")));
		})
	}
}

setInterval(function() { frappe.datetime.refresh_when() }, 60000); // refresh every minute
