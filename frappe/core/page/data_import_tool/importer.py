# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals

import frappe, json
import frappe.permissions

from frappe import _

from frappe.utils.csvutils import getlink
from frappe.utils.dateutils import parse_date

from frappe.utils import cint, cstr, flt


@frappe.whitelist()
def upload(rows = None, submit_after_import=None, ignore_encoding_errors=False, overwrite=None, ignore_links=False):
	"""upload data"""
	frappe.flags.mute_emails = True
	# extra input params
	params = json.loads(frappe.form_dict.get("params") or '{}')

	if params.get("_submit"):
		submit_after_import = True
	if params.get("ignore_encoding_errors"):
		ignore_encoding_errors = True

	from frappe.utils.csvutils import read_csv_content_from_uploaded_file

	def get_data_keys_definition():
		from  frappe.core.page.data_import_tool.data_import_tool import get_data_keys
		return get_data_keys()

	def bad_template():
		frappe.throw(_("Please do not change the rows above {0}").format(get_data_keys_definition().data_separator))

	def check_data_length():
		max_rows = 5000
		if not data:
			frappe.throw(_("No data found"))
		elif len(data) > max_rows:
			frappe.throw(_("Only allowed {0} rows in one import").format(max_rows))

	def get_start_row():
		for i, row in enumerate(rows):
			if row and row[0]==get_data_keys_definition().data_separator:
				return i+1
		bad_template()

	def get_header_row(key):
		return get_header_row_and_idx(key)[0]

	def get_header_row_and_idx(key):
		for i, row in enumerate(header):
			if row and row[0]==key:
				return row, i
		return [], -1

	def filter_empty_columns(columns):
		empty_cols = filter(lambda x: x in ("", None), columns)

		if empty_cols:
			if columns[-1*len(empty_cols):] == empty_cols:
				# filter empty columns if they exist at the end
				columns = columns[:-1*len(empty_cols)]
			else:
				frappe.msgprint(_("Please make sure that there are no empty columns in the file."),
					raise_exception=1)

		return columns

	def make_column_map():
		doctype_row, row_idx = get_header_row_and_idx(get_data_keys_definition().doctype)
		if row_idx == -1: # old style
			return

		dt = None
		for i, d in enumerate(doctype_row[1:]):
			if d not in ("~", "-"):
				if d: # value in doctype_row
					if doctype_row[i]==dt:
						# prev column is doctype (in case of parentfield)
						doctype_parentfield[dt] = doctype_row[i+1]
					else:
						dt = d
						doctypes.append(d)
						column_idx_to_fieldname[dt] = {}
						column_idx_to_fieldtype[dt] = {}
				if dt:
					column_idx_to_fieldname[dt][i+1] = rows[row_idx + 2][i+1]
					column_idx_to_fieldtype[dt][i+1] = rows[row_idx + 4][i+1]

	def get_doc(start_idx):
		if doctypes:
			doc = {}
			for idx in xrange(start_idx, len(rows)):
				if (not doc) or main_doc_empty(rows[idx]):
					for dt in doctypes:
						d = {}
						for column_idx in column_idx_to_fieldname[dt]:
							try:
								fieldname = column_idx_to_fieldname[dt][column_idx]
								fieldtype = column_idx_to_fieldtype[dt][column_idx]

								d[fieldname] = rows[idx][column_idx]
								if fieldtype in ("Int", "Check"):
									d[fieldname] = cint(d[fieldname])
								elif fieldtype in ("Float", "Currency", "Percent"):
									d[fieldname] = flt(d[fieldname])
								elif fieldtype == "Date":
									d[fieldname] = parse_date(d[fieldname]) if d[fieldname] else None
							except IndexError:
								pass

						# scrub quotes from name and modified
						if d.get("name") and d["name"].startswith('"'):
							d["name"] = d["name"][1:-1]

						if sum([0 if not val else 1 for val in d.values()]):
							d['doctype'] = dt
							if dt == doctype:
								doc.update(d)
							else:
								if not overwrite:
									d['parent'] = doc["name"]
								d['parenttype'] = doctype
								d['parentfield'] = doctype_parentfield[dt]
								doc.setdefault(d['parentfield'], []).append(d)
				else:
					break

			return doc
		else:
			doc = frappe._dict(zip(columns, rows[start_idx][1:]))
			doc['doctype'] = doctype
			return doc

	def main_doc_empty(row):
		return not (row and ((len(row) > 1 and row[1]) or (len(row) > 2 and row[2])))

	# header
	if not rows:
		rows = read_csv_content_from_uploaded_file(ignore_encoding_errors)
	start_row = get_start_row()
	header = rows[:start_row]
	data = rows[start_row:]
	doctype = get_header_row(get_data_keys_definition().main_table)[1]
	columns = filter_empty_columns(get_header_row(get_data_keys_definition().columns)[1:])
	doctypes = []
	doctype_parentfield = {}
	column_idx_to_fieldname = {}
	column_idx_to_fieldtype = {}

	if submit_after_import and not cint(frappe.db.get_value("DocType",
			doctype, "is_submittable")):
		submit_after_import = False

	parenttype = get_header_row(get_data_keys_definition().parent_table)

	if len(parenttype) > 1:
		parenttype = parenttype[1]

	# check permissions
	if not frappe.permissions.can_import(parenttype or doctype):
		frappe.flags.mute_emails = False
		return {"messages": [_("Not allowed to Import") + ": " + _(doctype)], "error": True}

	# allow limit rows to be uploaded
	check_data_length()
	make_column_map()

	frappe.db.begin()
	if overwrite==None:
		overwrite = params.get('overwrite')

	# delete child rows (if parenttype)
	parentfield = None
	if parenttype:
		parentfield = get_parent_field(doctype, parenttype)

		if overwrite:
			delete_child_rows(data, doctype)

	ret = []
	error = False
	for i, row in enumerate(data):
		# bypass empty rows
		if main_doc_empty(row):
			continue

		row_idx = i + start_row
		doc = None

		doc = get_doc(row_idx)
		try:
			frappe.local.message_log = []
			if parentfield:
				parent = frappe.get_doc(parenttype, doc["parent"])
				doc = parent.append(parentfield, doc)
				parent.save()
				ret.append('Inserted row for %s at #%s' % (getlink(parenttype,
					doc.parent), unicode(doc.idx)))
			else:
				if overwrite and frappe.db.exists(doctype, doc["name"]):
					original = frappe.get_doc(doctype, doc["name"])
					original.update(doc)
					original.ignore_links = ignore_links
					original.save()
					ret.append('Updated row (#%d) %s' % (row_idx + 1, getlink(original.doctype, original.name)))
				else:
					doc = frappe.get_doc(doc)
					doc.ignore_links = ignore_links
					doc.insert()
					ret.append('Inserted row (#%d) %s' % (row_idx + 1, getlink(doc.doctype, doc.name)))
				if submit_after_import:
					doc.submit()
					ret.append('Submitted row (#%d) %s' % (row_idx + 1, getlink(doc.doctype, doc.name)))
		except Exception, e:
			error = True
			if doc:
				frappe.errprint(doc if isinstance(doc, dict) else doc.as_dict())
			err_msg = frappe.local.message_log and "\n\n".join(frappe.local.message_log) or cstr(e)
			ret.append('Error for row (#%d) %s : %s' % (row_idx + 1,
				len(row)>1 and row[1] or "", err_msg))
			frappe.errprint(frappe.get_traceback())

	if error:
		frappe.db.rollback()
	else:
		frappe.db.commit()

	frappe.flags.mute_emails = False

	return {"messages": ret, "error": error}

def get_parent_field(doctype, parenttype):
	parentfield = None

	# get parentfield
	if parenttype:
		for d in frappe.get_meta(parenttype).get_table_fields():
			if d.options==doctype:
				parentfield = d.fieldname
				break

		if not parentfield:
			frappe.msgprint(_("Did not find {0} for {0} ({1})").format("parentfield", parenttype, doctype))
			raise Exception

	return parentfield

def delete_child_rows(rows, doctype):
	"""delete child rows for all parents"""
	for p in list(set([r[1] for r in rows])):
		frappe.db.sql("""delete from `tab%s` where parent=%s""" % (doctype, '%s'), p)
