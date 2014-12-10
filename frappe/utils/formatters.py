# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import formatdate, fmt_money, flt, cstr, cint
from frappe.model.meta import get_field_currency, get_field_precision
from frappe import _
import re

def format_value(value, df, doc=None, currency=None):
	# Convert dict to object if necessary
	if (isinstance(df, dict)):
		df = frappe._dict(df)
	
	if df.get("fieldtype")=="Date":
		return formatdate(value)

	elif df.get("fieldtype") == "Currency" or (df.get("fieldtype")=="Float" and (df.options or "").strip()):
		return fmt_money(value, precision=get_field_precision(df, doc),
			currency=currency if currency else (get_field_currency(df, doc) if doc else None))

	elif df.get("fieldtype") == "Float":
		precision = get_field_precision(df, doc)

		# show 1.000000 as 1
		# options should not specified
		if not df.options and value is not None:
			temp = cstr(value).split(".")
			if len(temp)==1 or cint(temp[1])==0:
				precision = 0

		return fmt_money(value, precision=precision)

	elif df.get("fieldtype") == "Percent":
		return "{}%".format(flt(value, 2))

	if value is None:
		value = ""

	if df.get("fieldtype") in ("Text", "Small Text"):
		if not re.search("(\<br|\<div|\<p)", value):
			return value.replace("\n", "<br>")

	if df.get("fieldtype") == "Select":
		value = _(value);

	return value

