import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Language = 'th' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getName: (item: { name: string; nameEn?: string } | undefined | null) => string;
  getDescription: (item: { description?: string; descriptionEn?: string } | undefined | null) => string;
  formatDate: (date: string | Date, includeTime?: boolean) => string;
}

const translations: Record<Language, Record<string, string>> = {
  th: {
    // Brand & Common
    app_name: 'KinD Restaurant POS',
    kind_pos: 'KinD POS',
    restaurant_system: 'ระบบจัดการร้านอาหาร',
    menu: 'เมนู',
    close: 'ปิด',
    cancel: 'ยกเลิก',
    save: 'บันทึก',
    confirm: 'ยืนยัน',
    delete: 'ลบ',
    edit: 'แก้ไข',
    add: 'เพิ่ม',
    search: 'ค้นหา',
    all: 'ทั้งหมด',
    back: 'ย้อนกลับ',
    total: 'รวม',
    status: 'สถานะ',
    actions: 'จัดการ',
    quantity: 'จำนวน',
    price: 'ราคา',
    cost: 'ต้นทุน',
    note: 'หมายเหตุ',
    optional: 'ไม่บังคับ',
    required: 'จำเป็น',
    yes: 'ใช่',
    no: 'ไม่ใช่',
    done: 'เสร็จสิ้น',
    items_unit: 'รายการ',
    baht: '฿',

    // Roles
    role_owner: 'เจ้าของร้าน',
    role_cashier: 'แคชเชียร์',
    role_waiter: 'พนักงานบริการ',

    // Navigation / Drawer
    nav_tables: 'ผังโต๊ะอาหาร',
    nav_tables_sub: 'ผังร้าน ย้าย/รวมโต๊ะ และการจอง',
    nav_pos: 'จุดขาย & สั่งอาหาร (POS)',
    nav_pos_sub: 'เลือกเมนู รับออเดอร์',
    nav_bills: 'บิลและประวัติการขาย',
    nav_bills_sub: 'ดูบิล พิมพ์ซ้ำ ยกเลิกบิล',
    nav_menu: 'จัดการเมนูอาหาร',
    nav_menu_sub: 'เพิ่ม/แก้ไขราคา ท็อปปิ้ง',
    nav_dashboard: 'แดชบอร์ดภาพรวม',
    nav_dashboard_sub: 'สรุปยอดขายประจำวัน',
    nav_reports: 'รายงานยอดขายและกะ',
    nav_reports_sub: 'สถิติ กำไร และเปิด/ปิดกะ',
    nav_settings: 'ตั้งค่าระบบ',
    nav_settings_sub: 'ข้อมูลร้าน โต๊ะ QR ภาษี',
    nav_header_tables: 'ผังโต๊ะอาหาร',
    nav_header_tables_sub: 'จัดวางโต๊ะ สถานะออเดอร์ ย้ายโต๊ะ และการจอง',
    nav_header_pos: 'จุดขายและสั่งอาหาร',
    nav_header_pos_sub: 'เลือกเมนู รับออเดอร์ และยืนยันบิล',
    nav_header_bills: 'บิลและประวัติการขาย',
    nav_header_bills_sub: 'ค้นหา ตรวจสอบ พิมพ์ซ้ำ และยกเลิกบิล',
    nav_header_menu: 'จัดการเมนูอาหาร',
    nav_header_menu_sub: 'เพิ่ม ลบ แก้ไขราคา ท็อปปิ้ง และสถานะขายหมด',
    nav_header_dashboard: 'แดชบอร์ดภาพรวม',
    nav_header_dashboard_sub: 'สรุปภาพรวมยอดขายและสถานะร้านวันนี้',
    nav_header_reports: 'รายงานยอดขายและกะ',
    nav_header_reports_sub: 'กราฟวิเคราะห์ยอดขาย กำไร และกะการทำงาน',
    nav_header_settings: 'ตั้งค่าระบบ',
    nav_header_settings_sub: 'ข้อมูลร้าน ภาษี เครื่องพิมพ์ QR ชำระเงิน และผังโต๊ะ',

    // Header & Simulations
    sim_call_waiter: 'จำลองเรียกพนักงาน',
    sim_call_waiter_title: 'จำลองกดเรียกพนักงานบริการ',
    sim_request_bill: 'จำลองขอเช็คบิล',
    sim_request_bill_title: 'จำลองกดขอเช็คบิล',
    sim_select_table: 'เลือกโต๊ะที่ต้องการให้ส่งสัญญาณแจ้งเตือน',
    shift_open_badge: 'กะเปิดอยู่ (เงินทอน: {cash})',
    notifications: 'การแจ้งเตือน',
    no_notifications: 'ไม่มีการแจ้งเตือนใหม่',
    clear_all_notifications: 'ล้างการแจ้งเตือนทั้งหมด',
    logout_confirm: 'ล็อคหน้าจอ / ออกจากระบบ',

    // Login Screen
    login_prompt: 'กรุณากดรหัส PIN 4 หลักเพื่อเข้าสู่ระบบ',
    invalid_pin: 'รหัส PIN ไม่ถูกต้อง',
    keypad_clear: 'ล้าง',
    quick_select_user: 'แตะเลือกผู้ใช้เพื่อดูหรือทดสอบ PIN เริ่มต้น:',
    demo_pin_hint: 'PIN เริ่มต้น: {pin}',

    // Bottom Bar
    bottom_bill: 'บิล (Bills)',
    bottom_open_bills: '{count} บิลเปิดอยู่',
    bottom_table_bill: 'โต๊ะ {table}: {total}',
    bottom_view_all: 'ดูทั้งหมด',
    bottom_add_category: 'เพิ่มหมวด',
    bottom_manage_categories: 'จัดการ',
    bottom_finish_manage: 'เสร็จสิ้น',
    bottom_new_category_title: 'เพิ่มหมวดหมู่อาหารใหม่',
    bottom_category_name_label: 'ชื่อหมวดหมู่อาหาร',
    bottom_category_name_en_label: 'ชื่อภาษาอังกฤษ (Optional)',
    bottom_category_icon_label: 'เลือกอิโมจิไอคอน',
    bottom_category_color_label: 'เลือกสีประจำหมวด',
    bottom_delete_category_title: 'ยืนยันการลบหมวดหมู่',
    bottom_delete_category_msg: 'คุณต้องการลบหมวดหมู่ "{name}" หรือไม่? เมนูในหมวดนี้จะถูกย้ายไปยัง "ทั่วไป"',

    // Tables & Floor Plan
    all_zones: 'ทุกโซน',
    zone_indoor: 'ในห้องแอร์',
    zone_outdoor: 'ลานรับลม',
    zone_vip: 'ห้อง VIP',
    zone_tables_count: '{count} โต๊ะ',
    table_available: 'ว่าง',
    table_occupied: 'มีลูกค้า',
    table_payment_pending: 'รอเช็คบิล',
    table_reserved: 'จองแล้ว',
    table_guests: '{count} ท่าน',
    table_seated_time: 'นั่งแล้ว {time}',
    table_edit_layout: 'แก้ไขผังร้าน',
    table_finish_edit: 'เสร็จสิ้นการแก้ไข',
    table_add_table: '+ เพิ่มโต๊ะ / ที่นั่ง',
    table_rotate: 'หมุน',
    table_open_modal_title: 'เปิดโต๊ะ {table}',
    table_guest_count_label: 'ระบุจำนวนลูกค้าที่มานั่ง',
    table_open_and_order: 'เปิดโต๊ะและเริ่มสั่งอาหาร',
    table_move_title: 'ย้ายโต๊ะ {table} ไปยังโต๊ะใหม่',
    table_merge_title: 'รวมโต๊ะ {table} กับโต๊ะอื่น',
    table_reserve_title: 'จองโต๊ะ {table}',
    table_reserve_name: 'ชื่อผู้จอง',
    table_reserve_phone: 'เบอร์ติดต่อ',
    table_reserve_time: 'เวลานัดหมาย',
    table_reserve_guests: 'จำนวนคน',
    table_reserve_note: 'คำขอเพิ่มเติม (เช่น ขอยืมเก้าอี้เด็ก)',
    table_reserve_btn: 'บันทึกการจอง',
    table_cancel_reserve: 'ยกเลิกการจอง',

    // POS & Order Taking
    pos_search_placeholder: 'ค้นหาเมนูอาหาร/เครื่องดื่ม...',
    order_type_dine_in: 'ทานที่ร้าน',
    order_type_takeaway: 'สั่งกลับบ้าน',
    order_type_delivery: 'เดลิเวอรี',
    delivery_form_title: 'ข้อมูลจัดส่งเดลิเวอรี',
    delivery_customer_name: 'ชื่อผู้รับ',
    delivery_phone: 'เบอร์โทรศัพท์ผู้รับ',
    delivery_address: 'ที่อยู่จัดส่ง',
    switch_table: 'สลับโต๊ะ...',
    table_has_order: '(มีออเดอร์)',
    table_empty: '(ว่าง)',
    cart_empty_title: 'ยังไม่มีรายการสั่งอาหาร',
    cart_empty_desc: 'แตะที่เมนูอาหารด้านซ้ายเพื่อเลือกรายการ',
    cart_unconfirmed_badge: 'ยังไม่ยืนยัน',
    cart_confirmed_badge: 'ยืนยันแล้ว',
    cart_subtotal: 'ยอดรวมรายการ (Subtotal)',
    cart_discount: 'ส่วนลด',
    cart_service_charge: 'ค่าบริการ',
    cart_vat: 'ภาษีมูลค่าเพิ่ม',
    cart_grand_total: 'ยอดสุทธิ (Grand Total)',
    cart_confirm_order: 'ยืนยันออเดอร์',
    cart_confirm_order_count: 'ยืนยันออเดอร์ ({count})',
    cart_pay_now: 'ชำระเงิน / เช็คบิล',
    cart_table_label: 'โต๊ะ {table}',
    cart_bill_no: 'บิล #{no}',
    cart_guests_count: 'จำนวนลูกค้า: {count} ท่าน',
    cart_delivery_to: 'ส่งถึง: {name} ({phone})',
    void_item_btn: 'ยกเลิกรายการ',
    void_item_title: 'ยกเลิกรายการอาหาร: {name}',
    void_item_reason_label: 'เหตุผลในการยกเลิก',
    void_item_reason_placeholder: 'เช่น ลูกค้ายกเลิก, วัตถุดิบหมด, คีย์ผิด',
    void_item_confirm: 'ยืนยันการยกเลิก',
    sold_out_overlay: 'ขายหมดแล้ว',
    recommended_badge: 'แนะนำ',
    promo_badge: 'โปรโมชั่น',

    // Food Type Detail & Options Modal
    food_detail_options_title: 'ตัวเลือกและขนาด (Options & Variants)',
    food_detail_add_button: 'เพิ่ม',
    food_detail_added_toast: 'เพิ่มแล้ว!',
    food_detail_single_choice_hint: '(เลือกได้ 1 รายการ)',
    food_detail_multi_choice_hint: '(เลือกได้หลายรายการ)',
    food_detail_kitchen_note: 'ข้อความเพิ่มเติมถึงครัว (เช่น ไม่ใส่ผักชี, หวานน้อย, เผ็ดพิเศษ)',
    food_detail_kitchen_note_placeholder: 'พิมพ์ข้อความที่ต้องการแจ้งครัว...',
    food_detail_close: 'ปิดหน้าต่าง',
    option_standard: 'ปกติ',
    option_sold_out: 'หมด',

    // Menu Management
    menu_mgmt_title: 'จัดการเมนูอาหารและหมวดหมู่',
    menu_mgmt_sub: 'เพิ่ม ลบ แก้ไขราคาเมนู ท็อปปิ้ง รูปภาพ และกำหนดสินค้าขายหมด',
    menu_mgmt_add_btn: '+ เพิ่มเมนูใหม่',
    menu_mgmt_cat_btn: 'จัดการหมวดหมู่',
    menu_mgmt_search: 'ค้นหาชื่อเมนู...',
    menu_form_new_title: 'เพิ่มเมนูอาหารใหม่',
    menu_form_edit_title: 'แก้ไขเมนู: {name}',
    menu_form_name_th: 'ชื่อเมนูอาหาร (ภาษาไทย)',
    menu_form_name_en: 'ชื่อเมนูอาหาร (English Name)',
    menu_form_cat: 'หมวดหมู่อาหาร',
    menu_form_desc_th: 'คำอธิบาย (ภาษาไทย)',
    menu_form_desc_en: 'คำอธิบาย (English Description)',
    menu_form_photo_label: 'รูปภาพประกอบเมนู',
    menu_form_photo_upload_btn: 'อัปโหลดรูปจากอุปกรณ์',
    menu_form_photo_camera_btn: 'ถ่ายภาพ',
    menu_form_photo_remove: 'ลบรูปภาพ',
    menu_form_photo_url_label: 'หรือระบุ URL รูปภาพ',
    menu_form_options_header: 'รายการตัวเลือกและราคา (Options / Variants)',
    menu_form_add_option_btn: '+ เพิ่มตัวเลือก',
    menu_form_option_name_th: 'ชื่อตัวเลือก (ไทย เช่น หมูสับ, ไก่)',
    menu_form_option_name_en: 'ชื่อตัวเลือก (English เช่น Minced Pork)',
    menu_form_option_price: 'ราคาขาย (฿)',
    menu_form_option_cost: 'ต้นทุน (฿)',
    menu_form_option_sold_out: 'ขายหมด',
    menu_form_promo_active: 'เปิดใช้ราคาโปรโมชั่น',
    menu_form_promo_price: 'ราคาโปรโมชั่น (฿)',
    menu_form_recommended: 'เมนูแนะนำ',
    menu_form_sold_out: 'สถานะขายหมดทั้งเมนู',
    menu_form_save_btn: 'บันทึกเมนู',
    menu_storage_full_err: 'พื้นที่จัดเก็บในเบราว์เซอร์เต็ม กรุณาใช้ไฟล์รูปภาพขนาดเล็กลง หรือใช้ URL แทน',
    menu_delete_confirm_title: 'ยืนยันการลบเมนูอาหาร',
    menu_delete_confirm_msg: 'คุณต้องการลบเมนู "{name}" ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้',

    // Billing & Payments
    payment_modal_title: 'ชำระเงิน - {table}',
    payment_method_cash: 'เงินสด',
    payment_method_qr: 'สแกน QR',
    payment_method_card: 'บัตรเครดิต/เดบิต',
    payment_method_transfer: 'โอนเงิน',
    payment_method_ewallet: 'E-Wallet',
    cash_amount_received: 'จำนวนเงินที่รับมา',
    cash_change: 'เงินทอน',
    cash_quick_bills: 'ปุ่มลัดธนบัตร:',
    qr_payment_title: 'สแกน QR ชำระเงิน',
    qr_exact_amount: 'ยอดชำระที่ถูกต้อง:',
    qr_select_label: 'เลือกบัญชีรับเงิน:',
    qr_confirm_received: 'ยืนยันได้รับเงินแล้ว',
    card_slip_label: 'เลขอ้างอิงสลิป / รหัส 4 ตัวท้าย (ถ้ามี)',
    transfer_ref_label: 'เลขอ้างอิงการโอนเงิน (ถ้ามี)',
    ewallet_ref_label: 'ชื่อแอพ / รหัสอ้างอิง',
    btn_complete_payment: 'บันทึกชำระเงิน ({amount})',
    payment_success_title: 'ชำระเงินเรียบร้อยแล้ว!',
    btn_print_receipt: 'พิมพ์ใบเสร็จรับเงิน',
    btn_close_bill: 'ปิดบิล',

    // Receipt Print
    receipt_title: 'ใบเสร็จรับเงิน / Tax Invoice',
    receipt_date: 'วันที่',
    receipt_time: 'เวลา',
    receipt_cashier: 'พนักงาน',
    receipt_bill_no: 'เลขที่บิล',
    receipt_order_type: 'ประเภท',
    receipt_subtotal: 'ยอดรวม',
    receipt_discount: 'ส่วนลด',
    receipt_service_charge: 'ค่าบริการ',
    receipt_vat: 'ภาษีมูลค่าเพิ่ม (VAT 7%)',
    receipt_grand_total: 'ยอดสุทธิ',
    receipt_paid_by: 'ชำระโดย',
    receipt_change_amount: 'เงินทอน',
    receipt_member_points: 'คะแนนสะสม',
    receipt_tax_id: 'เลขประจำตัวผู้เสียภาษี',

    // Bills History
    bills_history_title: 'ประวัติบิลและการขาย',
    bills_history_sub: 'ตรวจสอบรายการขาย พิมพ์ใบเสร็จซ้ำ และยกเลิกบิล',
    bills_search: 'ค้นหาเลขที่บิล, ชื่อโต๊ะ...',
    bills_filter_all: 'ทุกสถานะ',
    bills_filter_open: 'บิลเปิดอยู่',
    bills_filter_paid: 'ชำระแล้ว',
    bills_filter_voided: 'ยกเลิกแล้ว',
    bills_reprint_btn: 'พิมพ์ซ้ำ',
    bills_void_btn: 'ยกเลิกบิล',

    // Dashboard & Reports
    dash_title: 'แดชบอร์ดภาพรวมร้านอาหาร',
    dash_sub: 'สรุปข้อมูลการขาย ประสิทธิภาพ และสถานะปัจจุบัน',
    dash_today_sales: 'ยอดขายวันนี้',
    dash_total_bills: 'จำนวนบิลที่ปิดแล้ว',
    dash_avg_bill: 'ยอดเฉลี่ยต่อบิล',
    dash_open_tables: 'โต๊ะที่กำลังใช้งาน',
    dash_top_selling: 'เมนูขายดี 5 อันดับแรก',
    report_title: 'รายงานการเงินและกะทำงาน',
    report_sub: 'วิเคราะห์ยอดขาย กำไร วิธีชำระเงิน และการเปิด/ปิดกะ',
    report_filter_today: 'วันนี้',
    report_filter_7days: '7 วันล่าสุด',
    report_filter_30days: '30 วันล่าสุด',
    report_filter_custom: 'กำหนดเอง',
    report_export_csv: 'ส่งออก CSV',
    report_shift_title: 'ข้อมูลกะการทำงานปัจจุบัน',
    report_open_shift: 'เปิดกะใหม่',
    report_close_shift: 'ปิดกะและนับเงิน',
    report_starting_cash: 'เงินทอนเริ่มต้น',
    report_counted_cash: 'เงินสดที่นับได้จริง',
    report_cash_diff: 'ผลต่างเงินสด',
    report_sales_by_hour: 'ยอดขายรายชั่วโมง',
    report_sales_by_cat: 'สัดส่วนยอดขายตามหมวดหมู่',
    report_sales_by_method: 'สัดส่วนวิธีชำระเงิน',
    report_gross_profit: 'กำไรขั้นต้น (Gross Profit)',

    // Settings
    settings_title: 'ตั้งค่าระบบ KinD POS',
    settings_sub: 'กำหนดข้อมูลร้านค้า ภาษี ค่าบริการ QR ชำระเงิน และพนักงาน',
    settings_tab_shop: 'ข้อมูลร้านค้า',
    settings_tab_tax: 'ภาษี & ค่าบริการ',
    settings_tab_qr: 'QR ชำระเงิน',
    settings_tab_staff: 'พนักงาน & PIN',
    settings_tab_backup: 'สำรองข้อมูล & รีเซ็ต',
  },
  en: {
    // Brand & Common
    app_name: 'KinD Restaurant POS',
    kind_pos: 'KinD POS',
    restaurant_system: 'Restaurant Management System',
    menu: 'Menu',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    all: 'All',
    back: 'Back',
    total: 'Total',
    status: 'Status',
    actions: 'Actions',
    quantity: 'Qty',
    price: 'Price',
    cost: 'Cost',
    note: 'Note',
    optional: 'Optional',
    required: 'Required',
    yes: 'Yes',
    no: 'No',
    done: 'Done',
    items_unit: 'items',
    baht: '฿',

    // Roles
    role_owner: 'Owner',
    role_cashier: 'Cashier',
    role_waiter: 'Server',

    // Navigation / Drawer
    nav_tables: 'Tables Floor Plan',
    nav_tables_sub: 'Floor layout, move/merge, and reservations',
    nav_pos: 'POS & Order Taking',
    nav_pos_sub: 'Browse menu and take orders',
    nav_bills: 'Bills & Order History',
    nav_bills_sub: 'View bills, reprint, and void',
    nav_menu: 'Menu Management',
    nav_menu_sub: 'Add/edit dishes, prices, and options',
    nav_dashboard: 'Overview Dashboard',
    nav_dashboard_sub: 'Daily summary and live stats',
    nav_reports: 'Reports & Shifts',
    nav_reports_sub: 'Sales charts, profit, and shift management',
    nav_settings: 'System Settings',
    nav_settings_sub: 'Shop info, tables, QR codes, and taxes',
    nav_header_tables: 'Tables Floor Plan',
    nav_header_tables_sub: 'Floor plan, order status, move tables, and reservations',
    nav_header_pos: 'Point of Sale (POS)',
    nav_header_pos_sub: 'Browse dishes, take orders, and confirm bills',
    nav_header_bills: 'Bills & Sales History',
    nav_header_bills_sub: 'Search, review, reprint receipts, and void bills',
    nav_header_menu: 'Menu Management',
    nav_header_menu_sub: 'Add, delete, edit prices, options, and availability',
    nav_header_dashboard: 'Overview Dashboard',
    nav_header_dashboard_sub: 'Real-time sales performance and store status',
    nav_header_reports: 'Sales & Shift Reports',
    nav_header_reports_sub: 'Sales analytics, profit charts, and shift open/close',
    nav_header_settings: 'System Settings',
    nav_header_settings_sub: 'Shop info, VAT, printers, payment QRs, and table zones',

    // Header & Simulations
    sim_call_waiter: 'Simulate Call Server',
    sim_call_waiter_title: 'Simulate Customer Calling Server',
    sim_request_bill: 'Simulate Request Bill',
    sim_request_bill_title: 'Simulate Customer Requesting Bill',
    sim_select_table: 'Select the table to trigger the alert',
    shift_open_badge: 'Shift Open (Change: {cash})',
    notifications: 'Notifications',
    no_notifications: 'No new notifications',
    clear_all_notifications: 'Clear all notifications',
    logout_confirm: 'Lock Screen / Logout',

    // Login Screen
    login_prompt: 'Please enter your 4-digit PIN to sign in',
    invalid_pin: 'Invalid PIN code',
    keypad_clear: 'Clear',
    quick_select_user: 'Tap a user to view or test default demo PINs:',
    demo_pin_hint: 'Default PIN: {pin}',

    // Bottom Bar
    bottom_bill: 'Bills',
    bottom_open_bills: '{count} Open Bills',
    bottom_table_bill: 'T{table}: {total}',
    bottom_view_all: 'View All',
    bottom_add_category: 'Add Cat',
    bottom_manage_categories: 'Manage',
    bottom_finish_manage: 'Done',
    bottom_new_category_title: 'Add New Food Category',
    bottom_category_name_label: 'Category Name (Thai)',
    bottom_category_name_en_label: 'Category Name (English)',
    bottom_category_icon_label: 'Select Emoji Icon',
    bottom_category_color_label: 'Select Color',
    bottom_delete_category_title: 'Delete Category Confirmation',
    bottom_delete_category_msg: 'Are you sure you want to delete "{name}"? Items will be moved to "General".',

    // Tables & Floor Plan
    all_zones: 'All Zones',
    zone_indoor: 'Indoor (A/C)',
    zone_outdoor: 'Outdoor',
    zone_vip: 'VIP Room',
    zone_tables_count: '{count} tables',
    table_available: 'Available',
    table_occupied: 'Occupied',
    table_payment_pending: 'Bill Requested',
    table_reserved: 'Reserved',
    table_guests: '{count} Guests',
    table_seated_time: 'Seated {time}',
    table_edit_layout: 'Edit Layout',
    table_finish_edit: 'Done Editing',
    table_add_table: '+ Add Table / Chair',
    table_rotate: 'Rotate',
    table_open_modal_title: 'Open Table {table}',
    table_guest_count_label: 'Enter number of seated guests',
    table_open_and_order: 'Open Table & Start Order',
    table_move_title: 'Move Table {table} to New Table',
    table_merge_title: 'Merge Table {table} with Another Table',
    table_reserve_title: 'Reserve Table {table}',
    table_reserve_name: 'Customer Name',
    table_reserve_phone: 'Phone Number',
    table_reserve_time: 'Reservation Time',
    table_reserve_guests: 'Party Size',
    table_reserve_note: 'Special Request (e.g. baby chair)',
    table_reserve_btn: 'Save Reservation',
    table_cancel_reserve: 'Cancel Reservation',

    // POS & Order Taking
    pos_search_placeholder: 'Search food or drinks...',
    order_type_dine_in: 'Dine-In',
    order_type_takeaway: 'Takeaway',
    order_type_delivery: 'Delivery',
    delivery_form_title: 'Delivery Customer Information',
    delivery_customer_name: 'Customer Name',
    delivery_phone: 'Phone Number',
    delivery_address: 'Delivery Address',
    switch_table: 'Switch Table...',
    table_has_order: '(Active)',
    table_empty: '(Free)',
    cart_empty_title: 'Order cart is currently empty',
    cart_empty_desc: 'Tap any dish card on the left to add items',
    cart_unconfirmed_badge: 'Unsent',
    cart_confirmed_badge: 'Confirmed',
    cart_subtotal: 'Subtotal',
    cart_discount: 'Discount',
    cart_service_charge: 'Service Charge',
    cart_vat: 'VAT',
    cart_grand_total: 'Grand Total',
    cart_confirm_order: 'Confirm Order',
    cart_confirm_order_count: 'Confirm Order ({count})',
    cart_pay_now: 'Pay / Checkout',
    cart_table_label: 'Table {table}',
    cart_bill_no: 'Bill #{no}',
    cart_guests_count: 'Guests: {count}',
    cart_delivery_to: 'Deliver to: {name} ({phone})',
    void_item_btn: 'Void Item',
    void_item_title: 'Void Item: {name}',
    void_item_reason_label: 'Reason for voiding',
    void_item_reason_placeholder: 'e.g. Customer cancelled, out of ingredients',
    void_item_confirm: 'Confirm Void',
    sold_out_overlay: 'Sold Out',
    recommended_badge: 'Popular',
    promo_badge: 'Promo',

    // Food Type Detail & Options Modal
    food_detail_options_title: 'Options & Sizes',
    food_detail_add_button: 'Add',
    food_detail_added_toast: 'Added!',
    food_detail_single_choice_hint: '(Choose 1 item)',
    food_detail_multi_choice_hint: '(Choose multiple items)',
    food_detail_kitchen_note: 'Special Instructions (e.g. no cilantro, less sweet, extra spicy)',
    food_detail_kitchen_note_placeholder: 'Type special instructions for the kitchen...',
    food_detail_close: 'Close',
    option_standard: 'Standard',
    option_sold_out: 'Sold Out',

    // Menu Management
    menu_mgmt_title: 'Menu & Category Management',
    menu_mgmt_sub: 'Add, remove, edit prices, options, photos, and mark sold-out items',
    menu_mgmt_add_btn: '+ Add New Dish',
    menu_mgmt_cat_btn: 'Manage Categories',
    menu_mgmt_search: 'Search dish name...',
    menu_form_new_title: 'Add New Food / Drink Item',
    menu_form_edit_title: 'Edit Item: {name}',
    menu_form_name_th: 'Dish Name (Thai)',
    menu_form_name_en: 'Dish Name (English)',
    menu_form_cat: 'Category',
    menu_form_desc_th: 'Description (Thai)',
    menu_form_desc_en: 'Description (English)',
    menu_form_photo_label: 'Dish Photo',
    menu_form_photo_upload_btn: 'Upload from Device',
    menu_form_photo_camera_btn: 'Take Photo',
    menu_form_photo_remove: 'Remove Photo',
    menu_form_photo_url_label: 'Or provide Image URL',
    menu_form_options_header: 'Options & Variants List',
    menu_form_add_option_btn: '+ Add Option',
    menu_form_option_name_th: 'Option Name (Thai, e.g. หมูสับ)',
    menu_form_option_name_en: 'Option Name (English, e.g. Minced Pork)',
    menu_form_option_price: 'Price (฿)',
    menu_form_option_cost: 'Cost (฿)',
    menu_form_option_sold_out: 'Sold Out',
    menu_form_promo_active: 'Enable Promotional Price',
    menu_form_promo_price: 'Promo Price (฿)',
    menu_form_recommended: 'Chef Recommended',
    menu_form_sold_out: 'Mark Entire Dish Sold Out',
    menu_form_save_btn: 'Save Item',
    menu_storage_full_err: 'Browser storage full. Please use a smaller image file or an image URL.',
    menu_delete_confirm_title: 'Delete Dish Confirmation',
    menu_delete_confirm_msg: 'Are you sure you want to delete "{name}"? This action cannot be undone.',

    // Billing & Payments
    payment_modal_title: 'Payment - {table}',
    payment_method_cash: 'Cash',
    payment_method_qr: 'PromptPay / QR',
    payment_method_card: 'Credit / Debit Card',
    payment_method_transfer: 'Bank Transfer',
    payment_method_ewallet: 'E-Wallet',
    cash_amount_received: 'Amount Received',
    cash_change: 'Change',
    cash_quick_bills: 'Quick Banknote:',
    qr_payment_title: 'Scan QR to Pay',
    qr_exact_amount: 'Exact Amount to Pay:',
    qr_select_label: 'Receiving Account:',
    qr_confirm_received: 'Confirm Payment Received',
    card_slip_label: 'Slip Reference / Last 4 Digits (Optional)',
    transfer_ref_label: 'Transfer Reference (Optional)',
    ewallet_ref_label: 'App Name / Ref Code',
    btn_complete_payment: 'Complete Payment ({amount})',
    payment_success_title: 'Payment Successful!',
    btn_print_receipt: 'Print Receipt',
    btn_close_bill: 'Close Bill',

    // Receipt Print
    receipt_title: 'Receipt / Tax Invoice',
    receipt_date: 'Date',
    receipt_time: 'Time',
    receipt_cashier: 'Cashier',
    receipt_bill_no: 'Bill No.',
    receipt_order_type: 'Order Type',
    receipt_subtotal: 'Subtotal',
    receipt_discount: 'Discount',
    receipt_service_charge: 'Service Charge',
    receipt_vat: 'VAT (7%)',
    receipt_grand_total: 'Total Amount',
    receipt_paid_by: 'Paid by',
    receipt_change_amount: 'Change',
    receipt_member_points: 'Member Points',
    receipt_tax_id: 'Tax ID',

    // Bills History
    bills_history_title: 'Bills & Sales History',
    bills_history_sub: 'Review sales orders, reprint receipts, and void bills',
    bills_search: 'Search bill number, table...',
    bills_filter_all: 'All Statuses',
    bills_filter_open: 'Open Bills',
    bills_filter_paid: 'Paid',
    bills_filter_voided: 'Voided',
    bills_reprint_btn: 'Reprint',
    bills_void_btn: 'Void Bill',

    // Dashboard & Reports
    dash_title: 'Restaurant Overview Dashboard',
    dash_sub: 'Real-time sales performance and operational stats',
    dash_today_sales: "Today's Sales",
    dash_total_bills: 'Closed Bills',
    dash_avg_bill: 'Average per Bill',
    dash_open_tables: 'Active Seated Tables',
    dash_top_selling: 'Top 5 Selling Items',
    report_title: 'Financial & Shift Reports',
    report_sub: 'Analyze revenue, margins, payment channels, and manage shifts',
    report_filter_today: 'Today',
    report_filter_7days: 'Last 7 Days',
    report_filter_30days: 'Last 30 Days',
    report_filter_custom: 'Custom',
    report_export_csv: 'Export CSV',
    report_shift_title: 'Current Shift Status',
    report_open_shift: 'Open New Shift',
    report_close_shift: 'Close Shift & Count Cash',
    report_starting_cash: 'Starting Float',
    report_counted_cash: 'Counted Drawer Cash',
    report_cash_diff: 'Cash Discrepancy',
    report_sales_by_hour: 'Hourly Sales Breakdown',
    report_sales_by_cat: 'Sales by Category',
    report_sales_by_method: 'Payment Methods Share',
    report_gross_profit: 'Gross Profit',

    // Settings
    settings_title: 'KinD POS Settings',
    settings_sub: 'Manage store profile, tax rules, payment QR codes, and staff',
    settings_tab_shop: 'Shop Info',
    settings_tab_tax: 'Taxes & Service',
    settings_tab_qr: 'Payment QR Codes',
    settings_tab_staff: 'Staff & PINs',
    settings_tab_backup: 'Backup & Reset',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('kind_pos_lang_v2');
      if (saved === 'en' || saved === 'th') return saved;
      return 'th';
    } catch {
      return 'th';
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('kind_pos_lang_v2', lang);
      document.documentElement.lang = lang;
    } catch (e) {
      console.warn('Failed to save language to localStorage', e);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'th' ? 'en' : 'th');
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.th;
      let text = dict[key] || translations.th[key] || key;

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return text;
    },
    [language]
  );

  const getName = useCallback(
    (item: { name: string; nameEn?: string } | undefined | null): string => {
      if (!item) return '';
      if (language === 'en' && item.nameEn && item.nameEn.trim()) {
        return item.nameEn;
      }
      return item.name;
    },
    [language]
  );

  const getDescription = useCallback(
    (item: { description?: string; descriptionEn?: string } | undefined | null): string => {
      if (!item) return '';
      if (language === 'en' && item.descriptionEn && item.descriptionEn.trim()) {
        return item.descriptionEn;
      }
      return item.description || '';
    },
    [language]
  );

  const formatDate = useCallback(
    (dateInput: string | Date, includeTime = true): string => {
      if (!dateInput) return '-';
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return String(dateInput);

      if (language === 'th') {
        const thaiMonths = [
          'ม.ค.',
          'ก.พ.',
          'มี.ค.',
          'เม.ย.',
          'พ.ค.',
          'มิ.ย.',
          'ก.ค.',
          'ส.ค.',
          'ก.ย.',
          'ต.ค.',
          'พ.ย.',
          'ธ.ค.',
        ];
        const day = d.getDate();
        const month = thaiMonths[d.getMonth()];
        const year = d.getFullYear() + 543;
        const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        return includeTime ? `${day} ${month} ${year} ${time} น.` : `${day} ${month} ${year}`;
      } else {
        const dateStr = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const timeStr = d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return includeTime ? `${dateStr}, ${timeStr}` : dateStr;
      }
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        getName,
        getDescription,
        formatDate,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
