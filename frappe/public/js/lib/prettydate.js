/*
 * JavaScript Pretty Date
 * Copyright (c) 2011 John Resig (ejohn.org)
 * Licensed under the MIT and GPL licenses.
 */

// Takes an ISO time and returns a string representing how
// long ago the date represents.
function prettyDate(time){
	if(!time) return ''
	var date = new Date((time || "").replace(/-/g,"/").replace(/[TZ]/g," ").replace(/\.[0-9]*/, "")),
		diff = (((new Date()).getTime() - date.getTime()) / 1000),
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

// If jQuery is included in the page, adds a jQuery plugin to handle it as well
if ( typeof jQuery != "undefined" )
	jQuery.fn.prettyDate = function(){
		return this.each(function(){
			var date = prettyDate(this.title);
			if ( date )
				jQuery(this).text( date );
		});
	};
