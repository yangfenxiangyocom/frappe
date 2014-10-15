# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
"""build query for doclistview and return results"""

import frappe, json
import frappe.permissions
from frappe.model.db_query import DatabaseQuery
from frappe import _

@frappe.whitelist()
def get():
	return compress(execute(**get_form_params()))

def execute(doctype, query=None, filters=None, fields=None, or_filters=None, docstatus=None,
		group_by=None, order_by=None, limit_start=0, limit_page_length=20,
		as_list=False, with_childnames=False, debug=False):
	return DatabaseQuery(doctype).execute(query, filters, fields, or_filters, docstatus, group_by,
		order_by, limit_start, limit_page_length, as_list, with_childnames, debug)

def get_form_params():
	data = frappe._dict(frappe.local.form_dict)

	del data["cmd"]

	if isinstance(data.get("filters"), basestring):
		data["filters"] = json.loads(data["filters"])
	if isinstance(data.get("fields"), basestring):
		data["fields"] = json.loads(data["fields"])
	if isinstance(data.get("docstatus"), basestring):
		data["docstatus"] = json.loads(data["docstatus"])

	return data

def compress(data):
	"""separate keys and values"""
	if not data: return data
	values = []
	keys = data[0].keys()
	for row in data:
		new_row = []
		for key in keys:
			new_row.append(row[key])
		values.append(new_row)

	#hotfix for data in report
	#find column first, if columns starts with:
	# Status, Source
	#then, the value need to be translated
	column_index =[]
	i = 0
	for column_n in keys:
		if isinstance(column_n,dict) == False:
			if column_n.find('Status') == 0  or column_n.find(_("Status")) or column_n.find("status"):
				column_index.append(i)
			if column_n.find('Source') == 0  or column_n.find(_("Source")) or column_n.find("source"):
				column_index.append(i)
			if column_n.find('Gender') == 0  or column_n.find(_("Gender")) or column_n.find("gender"):
				column_index.append(i)
		i = i + 1

	#translate value
	for index in column_index:
		for result_row in values:
			result_row[index] = _(result_row[index])

	return {
		"keys": keys,
		"values": values
	}


@frappe.whitelist()
def save_report():
	"""save report"""

	data = frappe.local.form_dict
	if frappe.db.exists('Report', data['name']):
		d = frappe.get_doc('Report', data['name'])
	else:
		d = frappe.new_doc('Report')
		d.report_name = data['name']
		d.ref_doctype = data['doctype']

	d.report_type = "Report Builder"
	d.json = data['json']
	frappe.get_doc(d).save()
	frappe.msgprint(_("{0} is saved").format(d.name))
	return d.name

@frappe.whitelist()
def export_query():
	"""export from report builder"""
	form_params = get_form_params()
	form_params["limit_page_length"] = None
	form_params["as_list"] = True
	doctype = form_params.doctype
	del form_params["doctype"]

	frappe.permissions.can_export(doctype, raise_exception=True)

	db_query = DatabaseQuery(doctype)
	ret = db_query.execute(**form_params)

	data = [['Sr'] + get_labels(db_query.fields)]
	for i, row in enumerate(ret):
		data.append([i+1] + list(row))

	# convert to csv
	from cStringIO import StringIO
	import csv

	f = StringIO()
	writer = csv.writer(f)
	for r in data:
		# encode only unicode type strings and not int, floats etc.
		writer.writerow(map(lambda v: isinstance(v, unicode) and v.encode('utf-8') or v, r))

	f.seek(0)
	frappe.response['result'] = unicode(f.read(), 'utf-8')
	frappe.response['type'] = 'csv'
	frappe.response['doctype'] = doctype

def get_labels(fields):
	"""get column labels based on column names"""
	labels = []
	for key in fields:
		key = key.split(" as ")[0]
		doctype, fieldname = key.split(".")[0][4:-1], key.split(".")[1]
		label = frappe.get_meta(doctype).get_label(fieldname) or fieldname.title()
		if label in labels:
			label = doctype + ": " + label
		labels.append(label)

	return labels

@frappe.whitelist()
def delete_items():
	"""delete selected items"""
	import json

	il = json.loads(frappe.form_dict.get('items'))
	doctype = frappe.form_dict.get('doctype')

	for d in il:
		frappe.delete_doc(doctype, d)

@frappe.whitelist()
def get_stats(stats, doctype):
	"""get tag info"""
	import json
	tags = json.loads(stats)
	stats = {}

	columns = frappe.db.get_table_columns(doctype)
	for tag in tags:
		if not tag in columns: continue
		tagcount = execute(doctype, fields=[tag, "count(*)"],
			filters=["ifnull(%s,'')!=''" % tag], group_by=tag, as_list=True)

		if tag=='_user_tags':
			stats[tag] = scrub_user_tags(tagcount)
		else:
			stats[tag] = tagcount

	return stats

def scrub_user_tags(tagcount):
	"""rebuild tag list for tags"""
	rdict = {}
	tagdict = dict(tagcount)
	for t in tagdict:
		if not t:
			continue
		alltags = t.split(',')
		for tag in alltags:
			if tag:
				if not tag in rdict:
					rdict[tag] = 0

				rdict[tag] += tagdict[t]

	rlist = []
	for tag in rdict:
		rlist.append([tag, rdict[tag]])

	return rlist

# used in building query in queries.py
def get_match_cond(doctype):
	cond = DatabaseQuery(doctype).build_match_conditions()
	return (' and ' + cond) if cond else ""

def build_match_conditions(doctype, as_condition=True):
	return DatabaseQuery(doctype).build_match_conditions(as_condition=as_condition)
