// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.provide("frappe.views.calendar");
frappe.provide("frappe.views.calendars");

frappe.views.CalendarFactory = frappe.views.Factory.extend({
	make: function(route) {
		var me = this;
		frappe.model.with_doctype(route[1], function() {
			var options = {
				doctype: route[1],
				page: me.make_page()
			};
			$.extend(options, frappe.views.calendar[route[1]] || {});

			frappe.views.calendars[route[1]] = new frappe.views.Calendar(options);
		});
	}
});


frappe.views.Calendar = Class.extend({
	init: function(options) {
		$.extend(this, options);

		frappe.require('assets/frappe/js/lib/fullcalendar/fullcalendar.css');
		frappe.require('assets/frappe/js/lib/fullcalendar/fullcalendar.js');

		this.make_page();
		this.setup_options();
		this.make();
	},
	make_page: function() {
		var module = locals.DocType[this.doctype].module;
		this.page.appframe.set_title(__("Calendar") + " - " + __(this.doctype));
		this.page.appframe.add_module_icon(module==="Core" ? "Calendar" : module)
		this.page.appframe.set_views_for(this.doctype, "calendar");
		this.page.appframe.add_button("New", function() {
			var doc = frappe.model.get_new_doc(me.doctype);
			frappe.set_route("Form", me.doctype, doc.name);
		}, "icon-plus");

		var me = this;
		$(this.page).on("show", function() {
			me.$cal.fullCalendar("refetchEvents");
		})
	},
	make: function() {
		var me = this;
		this.$wrapper = $(this.page).find(".layout-main");
		this.$cal = $("<div>").appendTo(this.$wrapper);
		frappe.utils.set_footnote(this, this.$wrapper, __("Select or drag across time slots to create a new event."));
		//
		// $('<div class="help"></div>')
		// 	.html(__("Select dates to create a new ") + __(me.doctype))
		// 	.appendTo(this.$wrapper);

		this.$cal.fullCalendar(this.cal_options);
	},
	field_map: {
		"id": "name",
		"start": "start",
		"end": "end",
		"allDay": "all_day",
	},
	styles: {
		"standard": {
			"color": "#999"
		},
		"important": {
			"color": "#b94a48"
		},
		"warning": {
			"color": "#f89406"
		},
		"success": {
			"color": "#468847"
		},
		"info": {
			"color": "#3a87ad"
		},
		"inverse": {
			"color": "#333333"
		}
	},
	setup_options: function() {
		var me = this;
		this.cal_options = {
			header: {
				left: 'prev,next today',
				center: 'title',
				right: 'month,agendaWeek,agendaDay'
			},
			monthNames: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],  
			monthNamesShort: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],  
			dayNames: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],  
			dayNamesShort: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],  
			today: ["今天"],  
			firstDay: 1,  
			buttonText: {  
				today: '本月',  
				month: '月',  
				week: '周',  
				day: '日',  
				 prev: '上一月',  
				 next: '下一月'  
			},  
			editable: true,
			selectable: true,
			selectHelper: true,
			events: function(start, end, callback) {
				return frappe.call({
					method: me.get_events_method || "frappe.widgets.calendar.get_events",
					type: "GET",
					args: me.get_args(start, end),
					callback: function(r) {
						var events = r.message;
						me.prepare_events(events);
						callback(events);
					}
				})
			},
			eventClick: function(event, jsEvent, view) {
				// edit event description or delete
				var doctype = event.doctype || me.doctype;
				if(frappe.model.can_read(doctype)) {
					frappe.set_route("Form", doctype, event.name);
				}
			},
			eventDrop: function(event, dayDelta, minuteDelta, allDay, revertFunc) {
				me.update_event(event, revertFunc);
			},
			eventResize: function(event, dayDelta, minuteDelta, allDay, revertFunc) {
				me.update_event(event, revertFunc);
			},
			select: function(startDate, endDate, allDay, jsEvent, view) {
				if(jsEvent.day_clicked && view.name=="month")
					return;
				var event = frappe.model.get_new_doc(me.doctype);

				event[me.field_map.start] = frappe.datetime.get_datetime_as_string(startDate);

				if(me.field_map.end)
					event[me.field_map.end] = frappe.datetime.get_datetime_as_string(endDate);

				if(me.field_map.allDay)
					event[me.field_map.allDay] = allDay ? 1 : 0;

				frappe.set_route("Form", me.doctype, event.name);
			},
			dayClick: function(date, allDay, jsEvent, view) {
				jsEvent.day_clicked = true;
				return false;
			}
		};

		if(this.options) {
			$.extend(this.cal_options, this.options);
		}
	},
	get_args: function(start, end) {
		return {
			doctype: this.doctype,
			start: frappe.datetime.get_datetime_as_string(start),
			end: frappe.datetime.get_datetime_as_string(end)
		}
	},
	prepare_events: function(events) {
		var me = this;
		$.each(events || [], function(i, d) {
			d.id = d.name;
			d.editable = frappe.model.can_write(d.doctype || me.doctype);

			// do not allow submitted/cancelled events to be moved / extended
			if(d.docstatus && d.docstatus > 0) {
				d.editable = false;
			}

			$.each(me.field_map, function(target, source) {
				d[target] = d[source];
			});

			if(!me.field_map.allDay)
				d.allDay = 1;

			if(d.status) {
				if(me.style_map) {
					$.extend(d, me.styles[me.style_map[d.status]] || {});
				} else {
					$.extend(d, me.styles[frappe.utils.guess_style(d.status, "standard")]);
				}
			} else {
				$.extend(d, me.styles["standard"]);
			}
		})
	},
	update_event: function(event, revertFunc) {
		var me = this;
		frappe.model.remove_from_locals(me.doctype, event.name);
		return frappe.call({
			method: me.update_event_method || "frappe.widgets.calendar.update_event",
			args: me.get_update_args(event),
			callback: function(r) {
				if(r.exc) {
					show_alert("Unable to update event.")
					revertFunc();
				}
			}
		});
	},
	get_update_args: function(event) {
		var args = {
			name: event[this.field_map.id]
		};
		args[this.field_map.start]
			= frappe.datetime.get_datetime_as_string(event.start);

		if(this.field_map.end)
			args[this.field_map.end] = frappe.datetime.get_datetime_as_string(event.end);

		if(this.field_map.allDay)
			args[this.field_map.allDay] = event.allDay ? 1 : 0;

		args.doctype = event.doctype || this.doctype;

		return { args: args, field_map: this.field_map };
	}
})
