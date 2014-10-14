# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import get_request_site_address, encode
from frappe.model.document import Document
from urllib import quote
from frappe.website.router import resolve_route

class WebsiteSettings(Document):
	def validate(self):
		self.validate_top_bar_items()
		self.validate_footer_items()
		self.validate_home_page()

	def validate_home_page(self):
		if frappe.flags.in_install_app:
			return
		if self.home_page and not resolve_route(self.home_page):
			frappe.throw(_("Invalid Home Page") + " (Standard pages - index, login, products, blog, about, contact)")

	def validate_top_bar_items(self):
		"""validate url in top bar items"""
		for top_bar_item in self.get("top_bar_items"):
			if top_bar_item.parent_label:
				parent_label_item = self.get("top_bar_items", {"label": top_bar_item.parent_label})

				if not parent_label_item:
					# invalid item
					frappe.throw(_("{0} does not exist in row {1}").format(top_bar_item.parent_label, top_bar_item.idx))

				elif not parent_label_item[0] or parent_label_item[0].url:
					# parent cannot have url
					frappe.throw(_("{0} in row {1} cannot have both URL and child items").format(top_bar_item.parent_label,
						top_bar_item.idx))

	def validate_footer_items(self):
		"""clear parent label in footer"""
		for footer_item in self.get("footer_items"):
			footer_item.parent_label = None

	def on_update(self):
		# make js and css
		# clear web cache (for menus!)

		from frappe.website.render import clear_cache
		clear_cache()

		# clears role based home pages
		frappe.clear_cache()

def get_website_settings():
	hooks = frappe.get_hooks()

	all_top_items = frappe.db.sql("""\
		select * from `tabTop Bar Item`
		where parent='Website Settings' and parentfield='top_bar_items'
		order by idx asc""", as_dict=1)

	top_items = [d for d in all_top_items if not d['parent_label']]

	# attach child items to top bar
	for d in all_top_items:
		if d['parent_label']:
			for t in top_items:
				if t['label']==d['parent_label']:
					if not 'child_items' in t:
						t['child_items'] = []
					t['child_items'].append(d)
					break

	context = frappe._dict({
		'top_bar_items': top_items,
		'footer_items': frappe.db.sql("""\
			select * from `tabTop Bar Item`
			where parent='Website Settings' and parentfield='footer_items'
			order by idx asc""", as_dict=1),
		"post_login": [
			{"label": _("Reset Password"), "url": "update-password", "icon": "icon-key"},
			{"label": _("Logout"), "url": "/?cmd=web_logout", "icon": "icon-signout"}
		]
	})

	settings = frappe.get_doc("Website Settings", "Website Settings")
	for k in ["banner_html", "brand_html", "copyright", "twitter_share_via",
		"favicon", "facebook_share", "google_plus_one", "twitter_share", "linked_in_share",
		"disable_signup", "no_sidebar"]:
		if hasattr(settings, k):
			context[k] = settings.get(k)

	if not context.get("favicon"):
		context["favicon"] = "/assets/frappe/images/favicon.ico"

	if settings.address:
		context["footer_address"] = settings.address

	for k in ["facebook_share", "google_plus_one", "twitter_share", "linked_in_share",
		"disable_signup"]:
		context[k] = int(context.get(k) or 0)

	if frappe.request:
		context.url = quote(str(get_request_site_address(full_address=True)), safe="/:")

	context.encoded_title = quote(encode(context.title or ""), str(""))

	for update_website_context in hooks.update_website_context or []:
		frappe.get_attr(update_website_context)(context)

	context.web_include_js = hooks.web_include_js or []

	context.web_include_css = hooks.web_include_css or []

	return context
