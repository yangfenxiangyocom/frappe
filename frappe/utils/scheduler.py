# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt
"""
Events:
	always
	daily
	monthly
	weekly
"""

from __future__ import unicode_literals

import frappe
import frappe.utils
from frappe.utils.file_lock import create_lock, check_lock, delete_lock
from datetime import datetime
from frappe import _

DATETIME_FORMAT = '%Y-%m-%d %H:%M:%S'

def enqueue_events(site):
	if is_scheduler_disabled():
		return

	# lock before queuing begins
	lock = create_lock('scheduler')
	if not lock:
		return

	nowtime = frappe.utils.now_datetime()
	last = frappe.db.get_global('scheduler_last_event')

	# set scheduler last event
	frappe.db.begin()
	frappe.db.set_global('scheduler_last_event', nowtime.strftime(DATETIME_FORMAT))
	frappe.db.commit()

	out = []
	if last:
		last = datetime.strptime(last, DATETIME_FORMAT)
		out = enqueue_applicable_events(site, nowtime, last)

	delete_lock('scheduler')

	return '\n'.join(out)

def enqueue_applicable_events(site, nowtime, last):
	nowtime_str = nowtime.strftime(DATETIME_FORMAT)
	out = []

	def _log(event):
		out.append("{time} - {event} - queued".format(time=nowtime_str, event=event))

	if nowtime.day != last.day:
		# if first task of the day execute daily tasks
		trigger(site, "daily") and _log("daily")
		trigger(site, "daily_long") and _log("daily_long")

		if nowtime.month != last.month:
			trigger(site, "monthly") and _log("monthly")
			trigger(site, "monthly_long") and _log("monthly_long")

		if nowtime.weekday()==0:
			trigger(site, "weekly") and _log("weekly")
			trigger(site, "weekly_long") and _log("weekly_long")

	if nowtime.hour != last.hour:
		trigger(site, "hourly") and _log("hourly")

	trigger(site, "all") and _log("all")

	return out

def trigger(site, event, now=False):
	"""trigger method in startup.schedule_handler"""
	from frappe.tasks import scheduler_task

	for handler in frappe.get_hooks("scheduler_events").get(event, []):
		if not check_lock(handler):
			if not now:
				scheduler_task.delay(site=site, event=event, handler=handler)
			else:
				scheduler_task(site=site, event=event, handler=handler, now=True)

def log(method, message=None):
	"""log error in patch_log"""
	message = frappe.utils.cstr(message) + "\n" if message else ""
	message += frappe.get_traceback()

	if not (frappe.db and frappe.db._conn):
		frappe.connect()

	frappe.db.rollback()
	frappe.db.begin()

	d = frappe.new_doc("Scheduler Log")
	d.method = method
	d.error = message
	d.insert(ignore_permissions=True)

	frappe.db.commit()

	return message

def is_scheduler_disabled():
	return not frappe.utils.cint(frappe.db.get_default("enable_scheduler"))

def toggle_scheduler(enable):
	ss = frappe.get_doc("System Settings")
	ss.enable_scheduler = 1 if enable else 0
	ss.ignore_mandatory = True
	ss.save()

def enable_scheduler():
	toggle_scheduler(True)

def disable_scheduler():
	toggle_scheduler(False)

def get_errors(from_date, to_date, limit):
	errors = frappe.db.sql("""select modified, method, error from `tabScheduler Log`
		where date(modified) between %s and %s
		and error not like '%%[Errno 110] Connection timed out%%'
		order by modified limit %s""", (from_date, to_date, limit), as_dict=True)
	return ["""<p>Time: {modified}</p><pre><code>Method: {method}\n{error}</code></pre>""".format(**e)
		for e in errors]

def get_error_report(from_date=None, to_date=None, limit=10):
	from frappe.utils import get_url, now_datetime, add_days

	if not from_date:
		from_date = add_days(now_datetime().date(), -1)
	if not to_date:
		to_date = add_days(now_datetime().date(), -1)

	errors = get_errors(from_date, to_date, limit)

	if errors:
		return 1, _("""<h4>Scheduler Failed Events (max {limit}):</h4>	<p>URL: <a href="{url}" target="_blank">{url}</a></p><hr>{errors}""").format(
			limit=limit, url=get_url(), errors="<hr>".join(errors))
	else:
		return 0, _("<p>Scheduler didn't encounter any problems.</p>")
