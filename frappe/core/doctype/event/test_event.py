# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""Use blog post test to test user permissions logic"""

import frappe
import frappe.defaults
import unittest
import json

from frappe.core.doctype.event.event import get_events

test_records = frappe.get_test_records('Event')

class TestEvent(unittest.TestCase):
	# def setUp(self):
	# 	user = frappe.get_doc("User", "test1@example.com")
	# 	user.add_roles("Website Manager")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_allowed_public(self):
		frappe.set_user("test1@example.com")
		doc = frappe.get_doc("Event", frappe.db.get_value("Event", {"subject":"_Test Event 1"}))
		self.assertTrue(frappe.has_permission("Event", doc=doc))

	def test_not_allowed_private(self):
		frappe.set_user("test1@example.com")
		doc = frappe.get_doc("Event", frappe.db.get_value("Event", {"subject":"_Test Event 2"}))
		self.assertFalse(frappe.has_permission("Event", doc=doc))

	def test_allowed_private_if_in_event_user(self):
		frappe.set_user("test1@example.com")
		doc = frappe.get_doc("Event", frappe.db.get_value("Event", {"subject":"_Test Event 3"}))
		self.assertTrue(frappe.has_permission("Event", doc=doc))

	def test_event_list(self):
		frappe.set_user("test1@example.com")
		res = frappe.get_list("Event", filters=[["Event", "subject", "like", "_Test Event%"]], fields=["name", "subject"])
		self.assertEquals(len(res), 2)
		subjects = [r.subject for r in res]
		self.assertTrue("_Test Event 1" in subjects)
		self.assertTrue("_Test Event 3" in subjects)
		self.assertFalse("_Test Event 2" in subjects)

	def test_revert_logic(self):
		ev = frappe.get_doc(test_records[0]).insert()
		name = ev.name

		frappe.delete_doc("Event", ev.name)

		# insert again
		ev = frappe.get_doc(test_records[0]).insert()

		# the name should be same!
		self.assertEquals(ev.name, name)

	def test_assign(self):
		from frappe.widgets.form.assign_to import add

		ev = frappe.get_doc(test_records[0]).insert()

		add({
			"assign_to": "test@example.com",
			"doctype": "Event",
			"name": ev.name,
			"description": "Test Assignment"
		})

		ev = frappe.get_doc("Event", ev.name)

		self.assertEquals(ev._assign, json.dumps(["test@example.com"]))

		# add another one
		add({
			"assign_to": "test1@example.com",
			"doctype": "Event",
			"name": ev.name,
			"description": "Test Assignment"
		})

		ev = frappe.get_doc("Event", ev.name)

		self.assertEquals(set(json.loads(ev._assign)), set(["test@example.com", "test1@example.com"]))

		# close an assignment
		todo = frappe.get_doc("ToDo", {"reference_type": ev.doctype, "reference_name": ev.name,
			"owner": "test1@example.com"})
		todo.status = "Closed"
		todo.save()

		ev = frappe.get_doc("Event", ev.name)
		self.assertEquals(ev._assign, json.dumps(["test@example.com"]))

		# cleanup
		ev.delete()

	def test_recurring(self):
		ev = frappe.get_doc({
			"doctype":"Event",
			"subject": "_Test Event",
			"starts_on": "2014-02-01",
			"event_type": "Public",
			"repeat_this_event": 1,
			"repeat_on": "Every Year"
		})
		ev.insert()

		ev_list = get_events("2014-02-01", "2014-02-01", "Administrator", for_reminder=True)
		self.assertTrue(filter(lambda e: e.name==ev.name, ev_list))

		ev_list1 = get_events("2015-01-20", "2015-01-20", "Administrator", for_reminder=True)
		self.assertFalse(filter(lambda e: e.name==ev.name, ev_list1))

		ev_list2 = get_events("2014-02-20", "2014-02-20", "Administrator", for_reminder=True)
		self.assertFalse(filter(lambda e: e.name==ev.name, ev_list2))

		ev_list3 = get_events("2015-02-01", "2015-02-01", "Administrator", for_reminder=True)
		self.assertTrue(filter(lambda e: e.name==ev.name, ev_list3))

