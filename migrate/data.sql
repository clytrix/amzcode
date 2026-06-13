--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;



INSERT INTO public.attendance (id, user_id, work_date, check_in_at, check_out_at, notes, created_at) VALUES ('bd65386f-3546-4654-a197-94ea3e5a472f', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-26', '2026-04-26 06:05:45.469943+00', '2026-04-26 18:16:52.92+00', NULL, '2026-04-26 06:05:45.469943+00');
INSERT INTO public.attendance (id, user_id, work_date, check_in_at, check_out_at, notes, created_at) VALUES ('9f99ed3f-c730-4e9f-9ae2-1c7ed6c366c6', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-26', '2026-04-26 18:17:35.678057+00', '2026-04-26 18:17:57.568+00', NULL, '2026-04-26 18:17:35.678057+00');




--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.bank_accounts (id, user_id, label, account_holder, account_number, bank_name, ifsc_swift, upi_id, is_primary, source, created_at, updated_at) VALUES ('18874a7c-6c11-488a-9a57-6ceb67f72d2a', '2279d581-7bd8-4ea2-b326-61f33a43f6df', 'Primary (from KYC)', 'dewdew', 'weffwef', 'wefdwe', 'ewdfcew', 'wfw', true, 'kyc', '2026-04-27 21:34:56.099409+00', '2026-04-27 21:34:56.099409+00');




--
-- Data for Name: job_categories; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('e4448539-b0b9-446b-94fc-2bc4341a632a', 'Customer Service Associate', 'customer-service', 'Handle customer calls and chats — most common WFH role', 'Headphones', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('adbe1da8-8a3b-4afb-b4a7-7319852082a7', 'Data Entry / Catalog Associate', 'data-entry', 'Update product data, images, prices and descriptions', 'Database', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('0d5dbc7b-86e8-4357-a1d8-f7828cb92e78', 'Virtual Assistant / Seller Support', 'virtual-assistant', 'Help Amazon sellers manage orders and accounts', 'Package', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('89c7b315-f4fc-4732-87b3-6125b63375c6', 'Technical Support', 'technical-support', 'Solve app and website issues, guide customers', 'Wrench', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('a7a89a8a-3db2-47e1-99f9-2b820cd73f2c', 'Content Writing / Review Work', 'content-writing', 'Write product descriptions and SEO content', 'PenTool', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('dca64a08-14d3-4e33-b8ea-f7d0d9799576', 'HR / Recruitment Support', 'hr-recruitment', 'Handle hiring, candidate communication, document verification', 'Users', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('8343b14b-6203-4302-8361-ae4994cdabb4', 'Backend Operations', 'backend-ops', 'Data processing and back-office support', 'Server', '2026-04-23 17:35:52.189807+00');
INSERT INTO public.job_categories (id, name, slug, description, icon, created_at) VALUES ('2f5ad103-8eab-4c9d-b843-74435e2c47a9', 'Development Modules', 'development', 'Web, app and backend development engagements', 'code', '2026-04-26 04:49:45.163991+00');




--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.jobs (id, title, category_id, description, requirements, responsibilities, location, employment_type, salary_min, salary_max, salary_currency, is_active, created_by, created_at, updated_at) VALUES ('08b75c6f-e827-4121-88b4-2d8d40c3c67d', 'test', 'adbe1da8-8a3b-4afb-b4a7-7319852082a7', 'tets', 'test', 'test', 'Remote / Work From Home', 'Full-time', 15000.00, 35000.00, 'INR', true, '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-27 20:27:15.266707+00', '2026-04-27 20:27:15.266707+00');




--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.projects (id, title, description, status, owner_id, created_by, created_at, updated_at) VALUES ('4743977a-bf7a-4b41-964a-22e162ba2a23', 'Test', 'esst', 'planning', '4a47c981-9121-4202-8664-890fd5447d6d', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-26 19:32:59.045123+00', '2026-04-26 19:32:59.045123+00');




--
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.tasks (id, user_id, job_id, title, description, reward_amount, status, submission_notes, submission_url, deadline, assigned_by, created_at, updated_at, reviewed_at, reviewed_by, review_notes, last_reminder_sent_at, project_id, module_id, priority, estimate_hours, checklist, blocked_reason, started_at) VALUES ('1d235e2c-c0aa-46e6-b99c-c361efd77c9f', '4a47c981-9121-4202-8664-890fd5447d6d', NULL, 'Test', 'Test', 500.00, 'in_progress', NULL, NULL, '2026-04-27 20:37:00+00', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-26 15:07:30.240191+00', '2026-04-27 17:00:03.295193+00', NULL, NULL, NULL, '2026-04-27 17:00:01.73+00', NULL, NULL, 'medium', NULL, '[]', NULL, NULL);




--
-- Data for Name: task_credentials; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: credential_access_log; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: data_entry_invoices; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('22b270dd-4d2e-438c-bb43-6dc0487666d1', 'Reliance Retail Ltd', 'INV-2025-00112', '2025-11-12', 12450.00, 2241.00, '27AAACR5055K1Z5', NULL, 'Office supplies bulk order', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('db3d6fad-f885-4c7d-bbc6-76d72dcaa942', 'Tata Consultancy Services', 'TCS/INV/8842', '2025-11-08', 89500.00, 16110.00, '27AAACT2727Q1ZW', NULL, 'Q3 consulting retainer', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('2d22b1c9-4e9b-4d4e-b978-8abac855329b', 'Infosys Limited', 'INF-INV-7321', '2025-11-15', 45200.00, 8136.00, '29AAACI4798L1Z3', NULL, 'Cloud migration services', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('56110ddf-4a94-4d74-9ec6-7d983c42ed14', 'Flipkart Internet Pvt', 'FK-2025-99821', '2025-11-03', 7825.50, 1408.59, '29AAFCF0479L1ZG', NULL, 'IT peripherals', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('57101c35-f5c4-4bf5-91de-fea34557de75', 'Amazon Seller Services', 'AMZ-INV-44210', '2025-10-28', 23499.00, 4229.82, '29AALCA0171E1ZL', NULL, 'Warehouse equipment', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('9bda4c15-9c17-4d06-ad02-5f844bac7bda', 'Wipro Limited', 'WPR/2025/3312', '2025-11-19', 156000.00, 28080.00, '29AAACW0387M1Z6', NULL, 'Annual support contract', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('d2afc6c5-0042-452f-a4e0-ebadd02b75bb', 'HCL Technologies', 'HCL-INV-9982', '2025-11-21', 67400.00, 12132.00, '07AAACH8755L1ZQ', NULL, 'Software licensing', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('9dcb6f99-f441-4b61-b8d0-5ed4ed517e64', 'Mahindra & Mahindra', 'MM-INV-55410', '2025-11-09', 234500.00, 42210.00, '27AAACM3025E1ZL', NULL, 'Fleet vehicle service', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('9da51b54-c2ca-428f-9d95-a84937d04828', 'Bharti Airtel Ltd', 'AIR/B2B/77124', '2025-11-01', 18750.00, 3375.00, '07AAACB2894G1ZN', NULL, 'Corporate connectivity', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('8b7937df-b3c6-429b-b5b3-a5ec8cc81507', 'Asian Paints', 'AP-INV-3322', '2025-10-30', 45670.00, 8220.60, '27AAACA6666M1Z6', NULL, 'Office repainting', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('1b274006-729c-4975-81fe-ad32f3c0ab9d', 'ITC Limited', 'ITC/INV/22188', '2025-11-14', 9875.00, 1777.50, '19AAACI5950L1ZS', NULL, 'Stationery supplies', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('091a6ee5-b0d8-4ee6-adae-a1dbf5e7c6b6', 'Larsen & Toubro', 'LT-2025-66120', '2025-11-17', 567000.00, 102060.00, '27AAACL0140P1Z7', NULL, 'Construction consulting', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('da5e7407-dde7-41b6-af71-1d3617bde5d6', 'Hindustan Unilever', 'HUL-INV-44102', '2025-11-05', 12340.00, 2221.20, '27AAACH1206D1ZS', NULL, 'Pantry consumables', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('f7d9b3a3-a27d-4709-b576-9f9bcb4c9512', 'Maruti Suzuki India', 'MS-INV-88110', '2025-11-11', 89500.00, 16110.00, '06AAACM4076N1Z3', NULL, 'Vehicle maintenance', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('249d2a89-01ff-4606-95ca-4392831c6c69', 'Sun Pharmaceuticals', 'SUN/INV/9921', '2025-11-18', 34890.00, 6280.20, '24AAACS9624A1ZK', NULL, 'Medical supplies', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('4b32bc06-f12d-4b04-9edb-0f700cf1c22b', 'Adani Enterprises', 'ADE-2025-7710', '2025-11-22', 178900.00, 32202.00, '24AAACA9560G1ZF', NULL, 'Logistics services', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('a601b75c-d584-40c6-8e5c-440cb3858596', 'Bajaj Finance Ltd', 'BFL-INV-3344', '2025-11-06', 22500.00, 4050.00, '27AABCB1518L1ZT', NULL, 'Loan processing fee', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('769e1a84-778f-4c24-a39b-47e0af2c383c', 'JSW Steel Limited', 'JSW-INV-66110', '2025-11-13', 445000.00, 80100.00, '27AAACJ4323D1ZP', NULL, 'Steel procurement', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('c048fc65-bf30-44b6-80e4-a579576af37b', 'UltraTech Cement', 'UTC-2025-9988', '2025-11-16', 234000.00, 42120.00, '24AAACL6442L1ZS', NULL, 'Cement supply', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('58d898f5-7ad6-4342-b0e9-8855e88e346e', 'Tata Steel Limited', 'TSL-INV-22110', '2025-11-04', 389000.00, 70020.00, '20AAACT2803M1ZL', NULL, 'Steel procurement', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('2704ded3-5744-4999-8d9e-8c3a30a71b84', 'Nestle India Ltd', 'NES-INV-77882', '2025-10-29', 8765.00, 1577.70, '07AAACN1576C1ZK', NULL, 'Cafeteria supplies', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('b501ac07-ba6e-42c6-b873-2bf4d2c4ad82', 'Pidilite Industries', 'PID-INV-33221', '2025-11-07', 5432.00, 977.76, '27AAACP1119H1ZF', NULL, 'Adhesives bulk', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('b0f43b71-610b-4492-a6d2-9efd83370268', 'Britannia Industries', 'BRI-INV-99100', '2025-11-10', 6543.00, 1177.74, '19AAACB6066L1ZS', NULL, 'Snack supplies', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('0b87d745-2a23-4710-b471-f62743a60180', 'Godrej Consumer', 'GCP-INV-44120', '2025-11-20', 11230.00, 2021.40, '27AAACG2106D1ZH', NULL, 'Toiletries office', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('9dd70563-152f-45e9-b134-cb76de4dcfac', 'Dabur India', 'DAB-INV-66231', '2025-11-23', 4321.00, 777.78, '07AAACD0474Q1ZJ', NULL, 'First-aid supplies', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('5d9332aa-a8f6-4a19-832f-f0c280f1fc39', 'Marico Limited', 'MAR-INV-88321', '2025-11-02', 7890.00, 1420.20, '27AAACM2475P1ZE', NULL, 'Pantry items', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('9a4e5da8-4b0d-4d8d-b2b2-7a25f6813131', 'Vedanta Limited', 'VED-INV-22441', '2025-11-24', 678000.00, 122040.00, '27AAACS7101B1ZW', NULL, 'Mining consulting', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('c4d7ec5a-0ffa-4bec-9735-1742e60c8546', 'NTPC Limited', 'NTPC-INV-9981', '2025-11-25', 245000.00, 44100.00, '07AAACN0255D1Z3', NULL, 'Power consultancy', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('d0cef49a-ed6f-4831-9fbd-782e2426f6fc', 'Power Grid Corp', 'PGC-INV-33442', '2025-11-26', 156000.00, 28080.00, '07AAACP2316Q1ZB', NULL, 'Grid maintenance', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');
INSERT INTO public.data_entry_invoices (id, vendor_name, invoice_number, invoice_date, amount, tax_amount, gst_number, image_url, notes, is_active, created_by, created_at, updated_at) VALUES ('084df443-8fe9-4f8f-b3ed-48578ee46481', 'Coal India Limited', 'CIL-INV-77123', '2025-11-27', 432100.00, 77778.00, '20AAACC7351E1ZX', NULL, 'Coal supply', true, NULL, '2026-04-27 19:33:54.804766+00', '2026-04-27 19:33:54.804766+00');




--
-- Data for Name: data_entry_daily_pool; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('3d03c5ff-2540-4d51-9f5e-9734950769fd', '2026-04-28', 'b0f43b71-610b-4492-a6d2-9efd83370268', 150, 0, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('a80d0400-e1bf-479b-968c-3e92019984df', '2026-04-28', '084df443-8fe9-4f8f-b3ed-48578ee46481', 150, 1, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('8c0c5861-b10f-4c1e-b4b8-6f68f922384e', '2026-04-28', 'f7d9b3a3-a27d-4709-b576-9f9bcb4c9512', 150, 2, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('73e6ab92-c44c-4103-aac2-373a332e995b', '2026-04-28', '249d2a89-01ff-4606-95ca-4392831c6c69', 150, 3, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('8610cbf4-39b4-436f-8353-136deccbf2d0', '2026-04-28', 'c048fc65-bf30-44b6-80e4-a579576af37b', 150, 4, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('ed29e8da-c527-4905-b042-4e35ec3116b8', '2026-04-28', '1b274006-729c-4975-81fe-ad32f3c0ab9d', 150, 5, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('a3c04e19-25a3-479d-8848-054ad0a0f56d', '2026-04-28', '22b270dd-4d2e-438c-bb43-6dc0487666d1', 150, 6, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('8d71defa-ee5d-4679-b7aa-14c06a116aa2', '2026-04-28', '769e1a84-778f-4c24-a39b-47e0af2c383c', 150, 7, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('15045d2c-2a47-4a66-9bd8-bfe832e3a7f2', '2026-04-28', '5d9332aa-a8f6-4a19-832f-f0c280f1fc39', 150, 8, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('9e30f525-218e-499f-9231-4d45ccdb0be5', '2026-04-28', '9da51b54-c2ca-428f-9d95-a84937d04828', 150, 9, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('848bd1d3-001f-4fcd-9bb8-d4ac977296eb', '2026-04-28', '2d22b1c9-4e9b-4d4e-b978-8abac855329b', 150, 10, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('7e69a541-6555-4b94-beb4-0978e8667b53', '2026-04-28', 'd0cef49a-ed6f-4831-9fbd-782e2426f6fc', 150, 11, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('fdc6a603-20f8-4a3f-b475-5baa287db562', '2026-04-28', '9dcb6f99-f441-4b61-b8d0-5ed4ed517e64', 150, 12, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('239deb1f-ce26-4e9a-83ca-be134a2056dd', '2026-04-28', '9a4e5da8-4b0d-4d8d-b2b2-7a25f6813131', 150, 13, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('157a9806-7fa8-4140-9ada-65f9bcdb8308', '2026-04-28', '58d898f5-7ad6-4342-b0e9-8855e88e346e', 150, 14, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('a23a48a3-1698-488d-b11d-e14d4269011f', '2026-04-28', '9bda4c15-9c17-4d06-ad02-5f844bac7bda', 150, 15, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('10ca304a-409e-491e-9616-1fcf6363a737', '2026-04-28', 'd2afc6c5-0042-452f-a4e0-ebadd02b75bb', 150, 16, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('bebd969c-2c96-4370-8b39-330327212303', '2026-04-28', '4b32bc06-f12d-4b04-9edb-0f700cf1c22b', 150, 17, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('42b7bad2-2da8-4bf1-899e-731b530c3d87', '2026-04-28', 'c4d7ec5a-0ffa-4bec-9735-1742e60c8546', 150, 18, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('03a40632-4e32-4ccd-9135-b0d457c7f804', '2026-04-28', '8b7937df-b3c6-429b-b5b3-a5ec8cc81507', 150, 19, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('5faaf00d-a393-437d-a650-fd8a303b996f', '2026-04-28', '57101c35-f5c4-4bf5-91de-fea34557de75', 150, 20, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('a4c024bc-f0c5-40b6-a998-a00536c8a9dc', '2026-04-28', 'db3d6fad-f885-4c7d-bbc6-76d72dcaa942', 150, 21, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('a51f1b9b-cc34-4939-9456-97d076c599f3', '2026-04-28', '091a6ee5-b0d8-4ee6-adae-a1dbf5e7c6b6', 150, 22, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('43db59e7-0480-44d8-b5aa-cd68a7bfe18e', '2026-04-28', '0b87d745-2a23-4710-b471-f62743a60180', 150, 23, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('71395d9a-3994-456b-bbc8-c92413f6cb11', '2026-04-28', 'b501ac07-ba6e-42c6-b873-2bf4d2c4ad82', 150, 24, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('442d859f-35b0-48f0-afa0-e701d2c3d4df', '2026-04-28', '56110ddf-4a94-4d74-9ec6-7d983c42ed14', 150, 25, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('be4cd8c3-0678-40d6-9b3b-d345a3e8c6dd', '2026-04-28', '2704ded3-5744-4999-8d9e-8c3a30a71b84', 150, 26, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('4f8e74a3-5034-40ba-a396-da5fad960ab9', '2026-04-28', 'a601b75c-d584-40c6-8e5c-440cb3858596', 150, 27, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('20ae19c8-a37a-4977-a559-8990e71c5e76', '2026-04-28', 'da5e7407-dde7-41b6-af71-1d3617bde5d6', 150, 28, '2026-04-27 19:34:02.484578+00');
INSERT INTO public.data_entry_daily_pool (id, pool_date, invoice_id, reward_amount, "position", created_at) VALUES ('406a9782-79fd-4c6d-9193-56cfe2744453', '2026-04-28', '9dd70563-152f-45e9-b134-cb76de4dcfac', 150, 29, '2026-04-27 19:34:02.484578+00');




--
-- Data for Name: data_entry_submissions; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: earnings; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('444a47f6-0c5c-4013-8a00-7be2c55ad6b7', 'task_assigned', 'Task assigned', 'New task assigned: {{task_title}}', '<p>Hi {{employee_name}},</p>
<p>A new task has been assigned to you on Amazon Jobs Portal.</p>
<div style="background:#f7f8fa;border:1px solid #e7e7e7;border-radius:8px;padding:14px;margin:14px 0">
  <div style="font-weight:700;font-size:16px;margin-bottom:6px">{{task_title}}</div>
  <div style="font-size:13px;color:#565959;white-space:pre-wrap">{{task_description}}</div>
  <div style="margin-top:10px;font-size:12px"><b>Reward:</b> ₹{{reward_amount}} · <b>Deadline:</b> {{deadline}}</div>
</div>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open task</a></p>
<p style="margin:14px 0;font-size:12px;color:#565959">Or copy this link: {{task_url}}</p>', 'Sent when an admin assigns a new task to an employee.', '{employee_name,task_title,task_description,reward_amount,deadline,task_url}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('1fb9981c-ca06-48dc-a395-924aa20f3fe3', 'task_due_soon', 'Task due soon', 'Reminder: "{{task_title}}" is due soon', '<p>Hi {{employee_name}},</p>
<p>This is a friendly reminder that your task <b>{{task_title}}</b> is due on <b>{{deadline}}</b>.</p>
<p>Reward on approval: <b>₹{{reward_amount}}</b></p>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open task</a></p>
<p style="margin:14px 0;font-size:12px;color:#565959">Sign in to submit your work or request more time.</p>', 'Sent automatically when a task deadline is within 24 hours.', '{employee_name,task_title,reward_amount,deadline,task_url}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('5cdb1e98-fd14-47cc-b010-e206bedd82ef', 'task_overdue', 'Task overdue', 'Overdue: {{task_title}}', '<p>Hi {{employee_name}},</p>
<p>Your task <b>{{task_title}}</b> was due <b>{{deadline}}</b> and is now <b style="color:#b12704">overdue</b>. Please submit it as soon as possible.</p>
<p>Reward on approval: <b>₹{{reward_amount}}</b></p>
<p style="margin:14px 0"><a href="{{task_url}}" style="background:#b12704;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Submit task now</a></p>', 'Sent automatically when a task passes its deadline without submission.', '{employee_name,task_title,reward_amount,deadline,task_url}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('c8e85983-1b44-42e4-8b0f-b47d89088070', 'kyc_documents_submitted', 'KYC — documents submitted', 'KYC received — under review', '<p>Hi {{employee_name}},</p>
<p>Thanks — we''ve received your KYC submission and your security deposit payment.</p>
<p>Our team will verify your documents within 24 hours and email you with the outcome.</p>
<p style="font-size:12px;color:#565959">Payment reference: <b>{{payment_reference}}</b></p>', 'Sent when an employee completes KYC submission with payment.', '{employee_name,payment_reference}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('dcd3040c-58c2-4935-8153-8ef2fde6b9f5', 'kyc_fee_paid', 'KYC — fee paid', 'Payment received for KYC verification', '<p>Hi {{employee_name}},</p>
<p>We''ve received your KYC processing fee of <b>${{fee_amount}}</b>. Your submission will move into review shortly.</p>
<p style="font-size:12px;color:#565959">Payment reference: <b>{{payment_reference}}</b></p>', 'Sent when the KYC fee payment is recorded.', '{employee_name,fee_amount,payment_reference}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('121a2725-3571-4cd9-9919-5274412dc8e3', 'kyc_in_review', 'KYC — review in progress', 'Your KYC is now in review', '<p>Hi {{employee_name}},</p>
<p>An admin has started reviewing your KYC documents. You''ll receive another email shortly with the final decision.</p>', 'Sent when an admin opens the submission for active review.', '{employee_name}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('9401dade-5af8-4128-b16c-5e9de375b1c7', 'kyc_approved', 'KYC — approved', 'Your KYC has been approved 🎉', '<p>Hi {{employee_name}},</p>
<p>Great news — your KYC verification has been <b style="color:#067d62">approved</b>. You can now request withdrawals from the dashboard.</p>
<p style="margin:14px 0"><a href="{{dashboard_url}}" style="background:#067d62;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Go to dashboard</a></p>', 'Sent when the admin approves the KYC submission.', '{employee_name,dashboard_url}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('11a8d57e-24d9-4378-acaf-092f0a3cf993', 'kyc_rejected', 'KYC — rejected', 'Update on your KYC submission', '<p>Hi {{employee_name}},</p>
<p>Unfortunately your KYC submission was <b style="color:#b12704">not approved</b>. Please review the note below, correct any issues, and resubmit.</p>
<div style="background:#f7f8fa;border-left:3px solid #b12704;padding:10px 14px;margin:14px 0;font-size:13px"><b>Reason:</b><br/>{{admin_notes}}</div>
<p style="margin:14px 0"><a href="{{kyc_url}}" style="background:#FF9900;color:#0F1111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Resubmit KYC</a></p>', 'Sent when an admin rejects the KYC submission.', '{employee_name,admin_notes,kyc_url}', NULL, '2026-04-26 16:19:30.489269+00', '2026-04-26 16:19:30.489269+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('9c1c50c9-9615-4d92-ac11-6875bf35354e', 'module_assigned', 'Module assigned', 'You''ve been assigned to {{module_title}} on {{project_title}}', '<p>Hi {{employee_name}},</p>
  <p>You''ve been added to the <b>{{module_title}}</b> module of project <b>{{project_title}}</b>.</p>
  <p>{{module_description}}</p>
  <p><a href="{{project_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Open project</a></p>
  <p>Good luck!</p>', 'Sent when an admin assigns an employee to a project module.', '{employee_name,module_title,project_title,module_description,project_url}', NULL, '2026-04-26 16:58:16.567239+00', '2026-04-26 16:58:16.567239+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('b6803c36-7810-47ef-af08-a4deb99ebc90', 'task_comment_added', 'Task comment added', 'New comment on "{{task_title}}"', '<p>Hi {{employee_name}},</p>
  <p><b>{{author_name}}</b> commented on your task <b>{{task_title}}</b>:</p>
  <blockquote style="border-left:3px solid #FF9900;padding:6px 12px;color:#333;margin:12px 0">{{comment_body}}</blockquote>
  <p><a href="{{task_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">View task</a></p>', 'Sent when someone leaves a comment on a task you''re part of.', '{employee_name,author_name,task_title,comment_body,task_url}', NULL, '2026-04-26 16:58:16.567239+00', '2026-04-26 16:58:16.567239+00');
INSERT INTO public.email_templates (id, template_key, name, subject, body_html, description, variables, updated_by, created_at, updated_at) VALUES ('7d0ca36c-d115-4476-b0c3-3f891be9d628', 'task_changes_requested', 'Changes requested', 'Changes requested on "{{task_title}}"', '<p>Hi {{employee_name}},</p>
  <p>Your reviewer has requested changes on <b>{{task_title}}</b>.</p>
  <div style="background:#fff7ed;border-left:3px solid #FF9900;padding:10px 14px;margin:14px 0">
    <b>Feedback:</b><br/>{{review_notes}}
  </div>
  <p>The task is back in your queue — make the updates and resubmit when ready.</p>
  <p><a href="{{task_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Open task</a></p>', 'Sent when an admin requests changes on a submitted task.', '{employee_name,task_title,review_notes,task_url}', NULL, '2026-04-26 16:58:16.567239+00', '2026-04-26 16:58:16.567239+00');




--
-- Data for Name: employment_packages; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('be559a44-247a-430c-8ee0-20e3a9d4a3ea', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', NULL, NULL, 35000, 'INR', '{"description": "1500 for wifi "}', '2026-04-26', NULL, true, NULL, '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-26 21:40:57.214805+00', '2026-04-26 21:40:57.214805+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('7b6bb06d-115f-4653-ba27-73c78368b78c', 'ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', NULL, NULL, 450000, 'INR', '{"description": "1000 for wifi"}', '2026-04-27', NULL, true, 'approved ', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:21:25.805942+00', '2026-04-27 18:21:25.805942+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('1fe58876-d5be-474d-bcb2-e9b80a2d7bde', '6e4d5891-3c6f-4280-b974-1355e1da7ab5', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi"}', '2026-04-27', NULL, true, 'selected ', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:21:58.301196+00', '2026-04-27 18:21:58.301196+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('080805c1-b061-4835-8ed7-12b7e150a8bd', 'ce4d54b6-a1e3-4d52-b899-dd32c525523a', NULL, NULL, 45000, 'INR', '{"description": "selected"}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:22:18.299134+00', '2026-04-27 18:22:18.299134+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('7a1046e3-d307-4cdf-a1b4-3347259da4a5', 'f8a6983c-4341-4d86-b854-8fa92ac60454', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi "}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:22:39.054659+00', '2026-04-27 18:22:39.054659+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('73a636a3-abe8-4500-9338-fd10861ee5cc', '1c4b5011-f986-408c-838a-0ad39e96a9bb', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi"}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:23:00.504568+00', '2026-04-27 18:23:00.504568+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('856d81ca-932c-4184-9ded-3cdde82a2416', '3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi "}', '2026-04-27', NULL, true, 'selected ', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:23:20.630821+00', '2026-04-27 18:23:20.630821+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('10c7b8bc-48c9-4a58-9a5a-ffaa8cbeb06e', 'da1d9531-46ca-4b0f-8c42-ca55612f0229', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi "}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:23:38.605486+00', '2026-04-27 18:23:38.605486+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('a1d41f01-310f-42e8-87f8-b54d868876cf', '0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi "}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:24:26.344684+00', '2026-04-27 18:24:26.344684+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('2e698f89-6500-4129-9b32-ae01fb917b95', '9a9bf917-6d6a-48a6-824c-23521bb12577', NULL, NULL, 45000, 'INR', '{"description": "1000 for wifi"}', '2026-04-27', NULL, true, 'selected', '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 18:25:03.872909+00', '2026-04-27 18:25:03.872909+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('b2271534-de2c-4be5-a0db-1e5f8934c619', '63bacc15-694c-44da-9bf4-39631e6c0118', NULL, NULL, 20000, 'INR', '{}', '2026-04-27', '2026-04-27', false, 'Invalid ', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-27 18:16:59.657704+00', '2026-04-27 18:47:26.222019+00');
INSERT INTO public.employment_packages (id, user_id, job_id, application_id, monthly_salary, currency, perks, starts_on, ends_on, is_active, notes, created_by, created_at, updated_at) VALUES ('80395bb9-5e60-468f-9080-d54b09b5acc6', '4a47c981-9121-4202-8664-890fd5447d6d', '08b75c6f-e827-4121-88b4-2d8d40c3c67d', 'bf91c7d7-163a-43d3-98de-d32bf1539fb8', 50000, 'INR', '{}', '2026-04-27', NULL, true, NULL, '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-27 23:40:02.500821+00', '2026-04-27 23:40:02.500821+00');




--
-- Data for Name: fx_rates; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.fx_rates (base, quote, rate, fetched_at) VALUES ('USD', 'INR', 94.0, '2026-04-27 23:23:05.120161+00');




--
-- Data for Name: incentive_pocket; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: job_applications; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.job_applications (id, job_id, user_id, cover_letter, experience, status, admin_notes, created_at, updated_at, contact_email, contact_whatsapp, expected_salary, cv_path, github_url, linkedin_url) VALUES ('bf91c7d7-163a-43d3-98de-d32bf1539fb8', '08b75c6f-e827-4121-88b4-2d8d40c3c67d', '4a47c981-9121-4202-8664-890fd5447d6d', 'test', 'test', 'approved', NULL, '2026-04-27 22:23:38.279334+00', '2026-04-27 23:40:02.219349+00', 'webersera@outlook.com', '+918114779102', 20000.00, '4a47c981-9121-4202-8664-890fd5447d6d/08b75c6f-e827-4121-88b4-2d8d40c3c67d-1777328615219.pdf', NULL, NULL);




--
-- Data for Name: kyc_submissions; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('eba11afd-aed6-441f-ab8e-2acd13ae99e5', '1f074288-27c3-4a84-8827-63c8e2168d55', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 06:36:46.078188+00', '2026-04-27 06:36:46.078188+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('b0fea689-b8b0-4ffc-afff-65081b2139d0', '9a9bf917-6d6a-48a6-824c-23521bb12577', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 19:13:56.469481+00', '2026-04-27 19:13:56.469481+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('1577faf2-3e3b-443a-98c1-c819bae23951', '4a47c981-9121-4202-8664-890fd5447d6d', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Reset by admin — please re-submit your KYC.', NULL, NULL, '2026-04-24 03:35:08.925259+00', '2026-04-27 20:26:22.804112+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('41775683-d79e-48e8-bf04-4c5a9beab06b', '54d161b8-ffcb-413e-a86b-4b9060fcbc12', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:17.87341+00', '2026-04-27 21:26:17.87341+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('7a7aac0a-1572-4635-8746-cb36c26fb26d', '63bacc15-694c-44da-9bf4-39631e6c0118', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:18.205465+00', '2026-04-27 21:26:18.205465+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('e57ee1de-1cab-4c44-a230-f0d07dd5d9d6', '80769e37-7683-4838-90a3-987c8c5fad48', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:18.794036+00', '2026-04-27 21:26:18.794036+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('db42b2e9-c4d7-4b16-9169-5d65c9c8439d', '53fc206e-7e07-4025-ae3e-892d4fd59e8f', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.131187+00', '2026-04-27 21:26:19.131187+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('42b97d78-dc35-4933-88c5-9e74edf41827', '0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.476656+00', '2026-04-27 21:26:19.476656+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('5d58283c-705b-415c-bf74-14862cda31ee', 'da1d9531-46ca-4b0f-8c42-ca55612f0229', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.809502+00', '2026-04-27 21:26:19.809502+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('186dbf6e-30f3-49c1-bc12-05157c518590', '1c4b5011-f986-408c-838a-0ad39e96a9bb', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.137807+00', '2026-04-27 21:26:20.137807+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('f1ecd3ae-796d-4123-b010-a829193546fd', '3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.468967+00', '2026-04-27 21:26:20.468967+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('744ac0ae-6841-4b44-bf51-d6d82e321f43', '6e4d5891-3c6f-4280-b974-1355e1da7ab5', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.802726+00', '2026-04-27 21:26:20.802726+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('b0c70f9a-e96b-4fee-953f-68cffba62ddb', 'f8a6983c-4341-4d86-b854-8fa92ac60454', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:21.131959+00', '2026-04-27 21:26:21.131959+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('d972e7f4-4a4b-4dca-b67c-f9356e4f1418', 'ce4d54b6-a1e3-4d52-b899-dd32c525523a', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:21.790701+00', '2026-04-27 21:26:21.790701+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('71953e20-d1ed-4d9b-9529-71b6d687871b', 'ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:22.119217+00', '2026-04-27 21:26:22.119217+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('f06c563e-b884-4a54-b351-d629f8dfb9a0', '53ab8f42-590e-4ddd-85e1-02f295721698', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 22:19:14.365894+00', '2026-04-27 22:19:14.365894+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('8346bba4-9546-4b82-9a8e-0eaca32c4dc0', '2279d581-7bd8-4ea2-b326-61f33a43f6df', 'approved', 79.00, '2026-04-27 19:18:44.724+00', 'PAY-1777317524724-FUJKOA', 'njcfd', '2026-04-28', 'wefewf', 'wefwef', '2279d581-7bd8-4ea2-b326-61f33a43f6df/document_front_url-1777317487979.png', '2279d581-7bd8-4ea2-b326-61f33a43f6df/document_back_url-1777317493716.png', '2279d581-7bd8-4ea2-b326-61f33a43f6df/selfie_url-1777317499487.png', 'dewdew', 'weffwef', 'wefdwe', 'ewdfcew', 'wfw', NULL, '2279d581-7bd8-4ea2-b326-61f33a43f6df', '2026-04-27 19:20:33.994+00', '2026-04-27 21:26:21.460324+00', '2026-04-27 23:23:05.120161+00', 'wefdewfd', 'wefdewf', 'ewdfewqdf', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.kyc_submissions (id, user_id, status, fee_amount, fee_paid_at, fee_payment_reference, full_name, date_of_birth, document_type, document_number, document_front_url, document_back_url, selfie_url, bank_account_holder, bank_account_number, bank_name, bank_ifsc_swift, upi_id, admin_notes, reviewed_by, reviewed_at, created_at, updated_at, address, pan_number, aadhaar_number, triggered_by_withdrawal_id, payment_utr, payment_inr_amount, payment_submitted_at, payment_screenshot_url) VALUES ('b7835a9a-4b19-4609-b3d0-527096999d11', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', 'not_started', 79.00, NULL, NULL, NULL, NULL, NULL, NULL, '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428/document_front_url-1777295572378.jpg', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428/document_back_url-1777295558593.jpg', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428/selfie_url-1777295534566.jpg', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-27 21:26:17.503477+00', '2026-04-27 23:23:05.120161+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);




--
-- Data for Name: login_ips; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('de919bda-bf2e-4aa9-9669-2fd426387c0d', '4a47c981-9121-4202-8664-890fd5447d6d', '2401:4900:b0bd:7238:6c8d:4a02:d86b:349a', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', '2026-04-24 03:35:17.085+00', '2026-04-24 03:35:09.139438+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('d4704a8a-0f95-4bb0-a95b-d60cf23b529c', '4a47c981-9121-4202-8664-890fd5447d6d', '27.60.222.135', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', '2026-04-25 08:04:46.961+00', '2026-04-25 08:04:47.085774+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('4ab57368-9fc0-4bbe-95e5-842a920b6fa2', '4a47c981-9121-4202-8664-890fd5447d6d', '2401:4900:74d7:7aac:b4ae:c3f2:73f0:d9e2', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', '2026-04-26 17:46:16.209+00', '2026-04-26 17:46:04.668251+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('5809f957-d74c-41d4-871c-c9d11b87b51d', '4a47c981-9121-4202-8664-890fd5447d6d', '106.222.185.83', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', '2026-04-26 17:57:25.515+00', '2026-04-26 17:57:25.624708+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('eeccc4b5-d000-49e1-bb76-3df451415755', '1f074288-27c3-4a84-8827-63c8e2168d55', '2401:4900:73fc:32de:1365:f673:1f8d:3fd4', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-04-27 06:37:51.662+00', '2026-04-27 06:36:46.49972+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('26b310d8-ce63-4131-b099-fabfd05478ec', '9a9bf917-6d6a-48a6-824c-23521bb12577', '103.10.224.220', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', '2026-04-27 19:14:05.538+00', '2026-04-27 19:13:56.863034+00');
INSERT INTO public.login_ips (id, user_id, ip_address, user_agent, last_seen_at, created_at) VALUES ('7b4d7fe4-b1a4-416c-975d-54d55b57a3e5', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', '2401:4900:704d:b649:275d:a778:8cdf:86c0', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-04-27 23:12:38.798+00', '2026-04-27 23:12:38.916253+00');




--
-- Data for Name: otp_codes; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('99c62564-60b9-4048-86a1-bef6198db299', 'webersera@outlook.com', 'c59b4b7f9cbfc3baf405505cd3ea92b2a229b23563cb5d4e26cba842bd2e6256', 'signup', '2401:4900:b0bd:7238:6c8d:4a02:d86b:349a', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', 0, '2026-04-24 03:35:08.426+00', '2026-04-24 03:43:52.754+00', '2026-04-24 03:33:52.889839+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('78cd7d85-dc56-4e5a-94e3-71427628b3b7', 'webersera@outlook.com', '41098f738f49f5e16ddae7726678464d7f5694ce55ad2dd081856d254767102c', 'new_ip', '27.60.222.135', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', 0, '2026-04-25 08:04:46.793+00', '2026-04-25 08:14:00.05+00', '2026-04-25 08:04:00.201443+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('97d2f2dc-60c3-49e0-93fe-1fff51053702', 'webersera@outlook.com', 'dbc3655899026a0a7a9fb644d3d5062b6d2d98762acad1c4def89a3d7b5932a8', 'new_ip', '2401:4900:74d7:7aac:b4ae:c3f2:73f0:d9e2', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', 0, '2026-04-26 17:46:04.333+00', '2026-04-26 17:55:17.963+00', '2026-04-26 17:45:18.085806+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('f0ee3da9-b6fd-4fbf-b4f3-9bdea0fb7f96', 'webersera@outlook.com', 'e253399dbcf15df5b979050d78df70299f766ed497a6eacd98a0d74622105307', 'new_ip', '106.222.185.83', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', 0, '2026-04-26 17:57:25.19+00', '2026-04-26 18:07:02.269+00', '2026-04-26 17:57:02.408222+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('40c61cc7-aad5-4d6f-926d-93cae4cca2b6', 'rahulkumar2007bug@gmail.com', 'd46d1664705be36c54038d01ab16f8cc24116b1dab44de7beb3316dff283c8b9', 'signup', '2401:4900:73fc:32de:1365:f673:1f8d:3fd4', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', 0, '2026-04-27 06:36:45.616+00', '2026-04-27 06:44:08.98+00', '2026-04-27 06:34:09.110829+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('48d4f42b-560c-47ab-b5e1-1eb63a717738', 'shindesweety1617@gmail.com', 'd060e53e607048309ea45a96acc428f9cc46aaf12ad978283dbd1f95f59c3f7a', 'signup', '103.10.224.220', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', 0, '2026-04-27 19:11:17.308+00', '2026-04-27 19:18:32.15+00', '2026-04-27 19:08:32.26362+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('e99fd46f-35be-4ac7-8862-c1c8864ac157', 'shindesweety1617@gmail.com', '6cacf6c8d19b271fe42b4e1159e4ce29d83e3a66201139ded36598bddb75f1b3', 'signup', '103.10.224.220', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', 0, '2026-04-27 19:13:08.506+00', '2026-04-27 19:21:17.481+00', '2026-04-27 19:11:17.599577+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('57fb7bd9-4f7c-4a97-b8aa-58e5855fe5c4', 'shindesweety1617@gmail.com', 'bc39fd1694a771ff3389ca0334e8417e821218be76c31a8ce72e22d57fc99f20', 'signup', '103.10.224.220', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', 0, '2026-04-27 19:13:23.163+00', '2026-04-27 19:23:09.085+00', '2026-04-27 19:13:09.236913+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('bfbb8afa-23e5-4d67-ab9c-bd297a4d4bbe', 'shindesweety1617@gmail.com', '954a4a72cb148acede15d16f2950ca2ad45c0a7fc31fd2f340e7976dee8e7940', 'signup', '103.10.224.220', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', 0, '2026-04-27 19:13:56.016+00', '2026-04-27 19:23:23.38+00', '2026-04-27 19:13:23.521989+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('c81ff313-1dcf-4292-88f7-df9ef9b9401d', 'prout2197@gmail.com', 'be6898a8743a3bd8b72d21b64b66124a9589fe1bdb311ae77cc80d14edbdba67', 'signup', '2401:4900:75a3:6617:ed38:f433:11:70b8', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', 0, NULL, '2026-04-28 00:33:45.368+00', '2026-04-28 00:23:45.481037+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('9b60a617-80c6-493d-84cc-a523ce4e982a', 'biswajitsahoo777777@gmail.com', '2472feb91724fbeb337d15e27c21c5ba79812d2f0d9f73899d544897cda01758', 'signup', '2402:3a80:18ab:b3dc:26e2:5b29:8fe0:c8c2', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', 1, '2026-04-27 21:27:56.49+00', '2026-04-27 21:37:17.175+00', '2026-04-27 21:27:17.305255+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('c3837aa1-61fb-47dd-a3a0-c929b725d7d1', 'janardanprasad1982bug@gmail.com', '0b9e0e6c40a6a95cb553294051e781aa9e4554f14c9da30c067c94b0de649b83', 'new_ip', '2401:4900:704d:b649:275d:a778:8cdf:86c0', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 0, '2026-04-27 23:12:38.525+00', '2026-04-27 23:22:12.144+00', '2026-04-27 23:12:12.249859+00');
INSERT INTO public.otp_codes (id, email, code_hash, purpose, ip_address, user_agent, attempts, consumed_at, expires_at, created_at) VALUES ('c3f5f816-8bbb-49e3-8114-4ac290fa0705', 'lilawatik568@gmail.com', '6f256378b6edf5beb1e6558d941c53f5010ed8e6dfafbc5c137b7d35375f60b2', 'signup', '103.173.120.241', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', 0, '2026-04-28 00:44:20.965+00', '2026-04-28 00:53:59.411+00', '2026-04-28 00:43:59.53584+00');




--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('site.branding', '{"tagline": "Remote Work From Home Jobs", "site_name": "AMZ.Jobs", "support_email": "support@AMZ.Jobs"}', true, 'Site branding', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('kyc.config', '{"enabled": true, "fee_usd": 79, "required_for_withdrawal": true}', true, 'KYC settings', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('withdrawals.config', '{"enabled": true, "max_amount": 500000, "min_amount": 5000, "daily_limit": 100000}', true, 'Withdrawal limits', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('email.zeptomail', '{"region": "in", "enabled": true, "from_name": "AMZ.Jobs", "from_email": ""}', false, 'ZeptoMail config (token stays in secret)', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('custom.code', '{"head_html": "", "analytics_id": "", "body_end_html": ""}', true, 'Custom code injection', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('site.maintenance', '{"enabled": false, "message": "We are performing scheduled maintenance. Please check back soon."}', true, 'Maintenance mode', NULL, '2026-04-26 20:09:39.17225+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('telegram.widget', '{"enabled": true, "position": "bottom-right", "bot_username": "awtjobs", "welcome_message": "Hi! How can we help?"}', true, 'Telegram support widget', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-27 18:47:06.060726+00', '2026-04-26 20:09:39.17225+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('payments.upi', '{"upi_id": "", "payee_name": "", "instructions": "Scan the QR or pay to the UPI ID. After paying, copy the UTR / Transaction reference and submit it below.", "qr_image_url": "https://nzjrhzvtbgnqilyuzsiy.supabase.co/storage/v1/object/public/payment-assets/qr-1777317760589.png", "usd_to_inr_rate": 94}', true, 'Manual UPI payment configuration for KYC verification fee', '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-27 19:22:49.695801+00', '2026-04-27 18:48:47.738871+00');
INSERT INTO public.platform_settings (key, value, is_public, description, updated_by, updated_at, created_at) VALUES ('site.signup', '{"enabled": true, "require_email_verification": false}', true, 'Signup configuration', NULL, '2026-04-27 22:16:36.179757+00', '2026-04-26 20:09:39.17225+00');




--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('1f074288-27c3-4a84-8827-63c8e2168d55', 'rahulkumar2007bug@gmail.com', 'Monu', '', NULL, NULL, NULL, NULL, '2026-04-27 06:36:46.078188+00', '2026-04-27 06:36:46.078188+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('53ab8f42-590e-4ddd-85e1-02f295721698', 'cloudsovereign@gmail.com', 'Prasanta Rout', '08114779102', NULL, NULL, NULL, NULL, '2026-04-27 22:19:14.365894+00', '2026-04-27 22:19:14.365894+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('f8a6983c-4341-4d86-b854-8fa92ac60454', 'biswajitsahoo777777@gmail.com', 'Biswajit sahoo', '', NULL, NULL, NULL, NULL, '2026-04-27 21:26:21.131959+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('2279d581-7bd8-4ea2-b326-61f33a43f6df', 'nationdata7@gmail.com', 'RAJU SINGH', '', NULL, NULL, NULL, NULL, '2026-04-27 21:26:21.460324+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('ce4d54b6-a1e3-4d52-b899-dd32c525523a', 'navinverama007@gmail.com', 'Tanmay verma', '9120973062', NULL, NULL, NULL, NULL, '2026-04-27 21:26:21.790701+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', 'artichaudharychaudhary32286@gmail.com', 'Arti kumari', '7542057220', NULL, 'Danapur ', 'Patna', 'India', '2026-04-27 21:26:22.119217+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('4a47c981-9121-4202-8664-890fd5447d6d', 'webersera@outlook.com', 'Admin', '8114779102', NULL, NULL, NULL, NULL, '2026-04-24 03:35:08.925259+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', 'janardanprasad1982bug@gmail.com', 'Rahul', '', NULL, NULL, NULL, NULL, '2026-04-27 21:26:17.503477+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('54d161b8-ffcb-413e-a86b-4b9060fcbc12', 'ram822j@gmail.com', 'Harsh', '', NULL, NULL, NULL, NULL, '2026-04-27 21:26:17.87341+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('63bacc15-694c-44da-9bf4-39631e6c0118', 'bestm4254@gmail.com', 'Ggggggjsdhj', 'Vhjrrty875556', NULL, NULL, NULL, NULL, '2026-04-27 21:26:18.205465+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('9a9bf917-6d6a-48a6-824c-23521bb12577', 'shindesweety1617@gmail.com', 'Sweety shinde', '9307972592', NULL, NULL, NULL, NULL, '2026-04-27 19:13:56.469481+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('80769e37-7683-4838-90a3-987c8c5fad48', 'sumanarender23@gmail.com', 'SumaNarender', '9390233778', NULL, NULL, NULL, NULL, '2026-04-27 21:26:18.794036+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('53fc206e-7e07-4025-ae3e-892d4fd59e8f', 'sujanhalder745@gmail.com', 'Sujan haldar', '08101661750', NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.131187+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', 'lilawatik568@gmail.com', 'Lilawati Kumari', '6238680135', NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.476656+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('da1d9531-46ca-4b0f-8c42-ca55612f0229', 'sonalijain0808@gmail.com', 'Sonali jain', '07428144071', NULL, NULL, NULL, NULL, '2026-04-27 21:26:19.809502+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('1c4b5011-f986-408c-838a-0ad39e96a9bb', 'sr8097964@gmail.com', 'Simran Rani', '7607613983', NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.137807+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', 'srikreshma1@gmail.com', 'Reshma Sri K', '', NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.468967+00', '2026-04-27 23:23:05.120161+00', NULL);
INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, address, city, country, created_at, updated_at, whatsapp) VALUES ('6e4d5891-3c6f-4280-b974-1355e1da7ab5', 'yogeswari.chandrasekar@gmail.com', 'yogeswari', '9042809220', NULL, NULL, NULL, NULL, '2026-04-27 21:26:20.802726+00', '2026-04-27 23:23:05.120161+00', NULL);




--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.project_members (id, project_id, user_id, role, created_at) VALUES ('87f7b5b6-9714-40f2-89b5-896f78e4c3c1', '4743977a-bf7a-4b41-964a-22e162ba2a23', '4a47c981-9121-4202-8664-890fd5447d6d', 'lead', '2026-04-26 19:33:22.406422+00');




--
-- Data for Name: project_resources; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: salary_disbursements; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('5de9daac-0e3c-459e-87a8-2d4ad0023ed6', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', 'be559a44-247a-430c-8ee0-20e3a9d4a3ea', 2026, 3, 35000, 0, 0, 0, 35000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:27:55.283614+00', '2026-04-27 18:27:55.283614+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('9de8ab16-9ae8-4e21-9c0a-52cc78ea6da7', '63bacc15-694c-44da-9bf4-39631e6c0118', 'b2271534-de2c-4be5-a0db-1e5f8934c619', 2026, 3, 20000, 0, 0, 0, 20000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:27:56.542012+00', '2026-04-27 18:27:56.542012+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('4d2a5c7d-6086-4ec3-bf00-eb7e4d1abd3c', 'ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', '7b6bb06d-115f-4653-ba27-73c78368b78c', 2026, 3, 450000, 0, 0, 0, 450000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:27:58.78053+00', '2026-04-27 18:27:58.78053+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('0f8aba3c-505b-4747-a4a7-b2a378118bca', '6e4d5891-3c6f-4280-b974-1355e1da7ab5', '1fe58876-d5be-474d-bcb2-e9b80a2d7bde', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:27:59.237787+00', '2026-04-27 18:27:59.237787+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('0e465764-eabc-48bf-9355-e979d069cf08', 'ce4d54b6-a1e3-4d52-b899-dd32c525523a', '080805c1-b061-4835-8ed7-12b7e150a8bd', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:27:59.729989+00', '2026-04-27 18:27:59.729989+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('39b54188-eb8a-4c49-ade5-32f63a4c19c1', 'f8a6983c-4341-4d86-b854-8fa92ac60454', '7a1046e3-d307-4cdf-a1b4-3347259da4a5', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:00.344048+00', '2026-04-27 18:28:00.344048+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('082414fb-4b0c-4310-9b5d-850c625276be', '1c4b5011-f986-408c-838a-0ad39e96a9bb', '73a636a3-abe8-4500-9338-fd10861ee5cc', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:00.764181+00', '2026-04-27 18:28:00.764181+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('4464f3fe-454e-4c7f-8f8f-8990b08ceefc', '3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', '856d81ca-932c-4184-9ded-3cdde82a2416', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:01.255445+00', '2026-04-27 18:28:01.255445+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('3f99b86a-c190-4e9a-b51f-9fbafb1bde84', 'da1d9531-46ca-4b0f-8c42-ca55612f0229', '10c7b8bc-48c9-4a58-9a5a-ffaa8cbeb06e', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:01.755935+00', '2026-04-27 18:28:01.755935+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('05aea1a3-e826-461a-958d-46c87e9ba09b', '0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', 'a1d41f01-310f-42e8-87f8-b54d868876cf', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:02.179309+00', '2026-04-27 18:28:02.179309+00');
INSERT INTO public.salary_disbursements (id, user_id, package_id, period_year, period_month, basic_amount, overtime_amount, bonus, deductions, net_amount, status, hold_reason, paid_at, generated_by, created_at, updated_at) VALUES ('f50b702c-5a4d-4297-aa7a-5bd2a9498277', '9a9bf917-6d6a-48a6-824c-23521bb12577', '2e698f89-6500-4129-9b32-ae01fb917b95', 2026, 3, 45000, 0, 0, 0, 45000, 'held', 'KYC not approved', NULL, NULL, '2026-04-27 18:28:02.689477+00', '2026-04-27 18:28:02.689477+00');




--
-- Data for Name: salary_slips; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.salary_slips (id, user_id, period_month, period_year, basic_salary, bonus, deductions, net_amount, notes, generated_by, created_at) VALUES ('e555eb0f-1537-4c8a-b0bc-002e15fd432c', '4a47c981-9121-4202-8664-890fd5447d6d', 4, 2026, 18000.00, 12000.00, 0.00, 30000.00, NULL, '4a47c981-9121-4202-8664-890fd5447d6d', '2026-04-25 08:06:21.46652+00');




--
-- Data for Name: task_activity; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: task_attachments; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: task_time_logs; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: ticket_messages; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: trusted_devices; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.trusted_devices (id, user_id, device_id, device_name, user_agent, last_ip, last_seen_at, created_at) VALUES ('c9c69ac7-5b8d-4428-a9f4-fbe943c1e2f7', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', '71071601-8e32-46a3-aa88-5c4526864039', 'Chrome on Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2401:4900:704d:b649:275d:a778:8cdf:86c0', '2026-04-27 23:12:38.658+00', '2026-04-27 23:12:38.777897+00');
INSERT INTO public.trusted_devices (id, user_id, device_id, device_name, user_agent, last_ip, last_seen_at, created_at) VALUES ('c9264b31-61d7-4099-bab9-a0ad3ed07af5', '4a47c981-9121-4202-8664-890fd5447d6d', '519b4d09-121d-4b17-811e-8cb6b609b6ea', 'Edge on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', '2401:4900:75a3:6617:ed38:f433:11:70b8', '2026-04-28 00:31:31.495+00', '2026-04-26 17:57:25.472508+00');
INSERT INTO public.trusted_devices (id, user_id, device_id, device_name, user_agent, last_ip, last_seen_at, created_at) VALUES ('56eeade5-3a69-4953-859f-e684b0193e0c', '1f074288-27c3-4a84-8827-63c8e2168d55', 'd5c59905-5dc7-4295-a7a9-e4b68871f19c', NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2401:4900:704d:b649:275d:a778:8cdf:86c0', '2026-04-27 18:59:19.457+00', '2026-04-27 06:36:46.324564+00');
INSERT INTO public.trusted_devices (id, user_id, device_id, device_name, user_agent, last_ip, last_seen_at, created_at) VALUES ('0f3067c8-36b4-4d29-8812-c71fe289ce25', '9a9bf917-6d6a-48a6-824c-23521bb12577', '080f71a4-5ab8-4e06-836d-5d4369e4b753', NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36', '103.10.224.220', '2026-04-27 19:21:38.978+00', '2026-04-27 19:13:56.679374+00');




--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('9c6855c0-65f6-489d-97ea-4e2e5e3b37b3', '4a47c981-9121-4202-8664-890fd5447d6d', 'employee', '2026-04-24 03:35:08.925259+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('cbc877fc-e82b-475d-a91d-fa23e359d04b', '4a47c981-9121-4202-8664-890fd5447d6d', 'admin', '2026-04-25 07:21:46.206429+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('ded6e16b-6e4b-4366-8e00-83022a1ae99b', '1f074288-27c3-4a84-8827-63c8e2168d55', 'employee', '2026-04-27 06:36:46.078188+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('73350138-467f-424c-98f2-b809951479e4', '9a9bf917-6d6a-48a6-824c-23521bb12577', 'employee', '2026-04-27 19:13:56.469481+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('b4136f8b-0ec4-4f0b-bf73-17e0e40f037f', '3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', 'employee', '2026-04-27 21:26:17.503477+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('5a76cdef-28cb-43eb-9c1c-1293b4512d6a', '54d161b8-ffcb-413e-a86b-4b9060fcbc12', 'employee', '2026-04-27 21:26:17.87341+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('c62a799d-61d3-4254-9b92-28aefdc746d6', '63bacc15-694c-44da-9bf4-39631e6c0118', 'employee', '2026-04-27 21:26:18.205465+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('9c7ae25d-deb8-4280-9162-242627e1239b', '80769e37-7683-4838-90a3-987c8c5fad48', 'employee', '2026-04-27 21:26:18.794036+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('b6f6dbaa-4dfc-4edd-8a21-5569bc684a03', '53fc206e-7e07-4025-ae3e-892d4fd59e8f', 'employee', '2026-04-27 21:26:19.131187+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('e98cede4-5795-414a-a235-796b248903b7', '0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', 'employee', '2026-04-27 21:26:19.476656+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('10df700b-c462-4e34-b641-134bcb2dd3fe', 'da1d9531-46ca-4b0f-8c42-ca55612f0229', 'employee', '2026-04-27 21:26:19.809502+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('d09e0359-4169-4925-9e87-3259b0965de0', '1c4b5011-f986-408c-838a-0ad39e96a9bb', 'employee', '2026-04-27 21:26:20.137807+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('76b84ade-a210-4492-bbb6-25e83b5afed3', '3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', 'employee', '2026-04-27 21:26:20.468967+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('4b0ae078-2f5a-4254-9175-2eb339004dfa', '6e4d5891-3c6f-4280-b974-1355e1da7ab5', 'employee', '2026-04-27 21:26:20.802726+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('6497d24e-cbc6-4861-be42-c8792caee4ca', 'f8a6983c-4341-4d86-b854-8fa92ac60454', 'employee', '2026-04-27 21:26:21.131959+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('41bb2cc2-f2af-49dc-8056-76cec6d0eb34', '2279d581-7bd8-4ea2-b326-61f33a43f6df', 'employee', '2026-04-27 21:26:21.460324+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('187095de-2cbd-4535-a8f9-aeb060ccf750', 'ce4d54b6-a1e3-4d52-b899-dd32c525523a', 'employee', '2026-04-27 21:26:21.790701+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('26783d5b-be2c-4029-8372-9135c2c9dd8c', 'ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', 'employee', '2026-04-27 21:26:22.119217+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('3d9735f8-cb5d-4d9e-a23d-71dea9cfda77', '2279d581-7bd8-4ea2-b326-61f33a43f6df', 'admin', '2026-04-27 21:34:56.099409+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('93e6d1ed-c13e-4f9f-9616-fd25e3f00e9a', '53ab8f42-590e-4ddd-85e1-02f295721698', 'employee', '2026-04-27 22:19:14.365894+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('2fcbafba-e0be-488d-a008-be46f9f0c728', '53ab8f42-590e-4ddd-85e1-02f295721698', 'admin', '2026-04-28 00:22:47.584651+00');




--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--



INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('1f074288-27c3-4a84-8827-63c8e2168d55', 0, 0, '2026-04-27 18:48:47.738871+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('9a9bf917-6d6a-48a6-824c-23521bb12577', 0, 0, '2026-04-27 19:13:56.469481+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('4a47c981-9121-4202-8664-890fd5447d6d', 0, 0, '2026-04-27 18:48:47.738871+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('3cda2a6c-d1bb-4bd7-9366-368a4eaf6428', 0, 0, '2026-04-27 21:26:17.503477+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('54d161b8-ffcb-413e-a86b-4b9060fcbc12', 0, 0, '2026-04-27 21:26:17.87341+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('63bacc15-694c-44da-9bf4-39631e6c0118', 0, 0, '2026-04-27 21:26:18.205465+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('80769e37-7683-4838-90a3-987c8c5fad48', 0, 0, '2026-04-27 21:26:18.794036+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('53fc206e-7e07-4025-ae3e-892d4fd59e8f', 0, 0, '2026-04-27 21:26:19.131187+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('0d0ac2ee-6fa7-45f0-855c-3b8f57f2a0c8', 0, 0, '2026-04-27 21:26:19.476656+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('da1d9531-46ca-4b0f-8c42-ca55612f0229', 0, 0, '2026-04-27 21:26:19.809502+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('1c4b5011-f986-408c-838a-0ad39e96a9bb', 0, 0, '2026-04-27 21:26:20.137807+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('3a9e5ae8-8180-4f45-a9df-c4a54f0385e6', 0, 0, '2026-04-27 21:26:20.468967+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('6e4d5891-3c6f-4280-b974-1355e1da7ab5', 0, 0, '2026-04-27 21:26:20.802726+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('f8a6983c-4341-4d86-b854-8fa92ac60454', 0, 0, '2026-04-27 21:26:21.131959+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('2279d581-7bd8-4ea2-b326-61f33a43f6df', 0, 0, '2026-04-27 21:26:21.460324+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('ce4d54b6-a1e3-4d52-b899-dd32c525523a', 0, 0, '2026-04-27 21:26:21.790701+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('ccd7f3d8-6fca-4f7a-a400-c7701af0ba86', 0, 0, '2026-04-27 21:26:22.119217+00');
INSERT INTO public.wallets (user_id, salary_balance, incentive_balance, updated_at) VALUES ('53ab8f42-590e-4ddd-85e1-02f295721698', 0, 0, '2026-04-27 22:19:14.365894+00');




--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: -
--







--
-- PostgreSQL database dump complete
--

