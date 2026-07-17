import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784313876472 implements MigrationInterface {
    name = 'InitialSchema1784313876472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "case_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_20117784863a479581a353bc33a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5fae3a8b17ecde710acea958f5" ON "case_types" ("slug") `);
        await queryRunner.query(`CREATE TABLE "case_statuses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "label" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "color" character varying(9) NOT NULL DEFAULT '#64748b', "sort_order" integer NOT NULL DEFAULT '0', "is_terminal" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_84defa30d4c04db10dd5dacb142" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_eed94a4f0984649f625a0498cd" ON "case_statuses" ("slug") `);
        await queryRunner.query(`CREATE TYPE "public"."case_files_file_type_enum" AS ENUM('stl', 'image', 'document', 'lab_output')`);
        await queryRunner.query(`CREATE TABLE "case_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "case_id" uuid NOT NULL, "file_type" "public"."case_files_file_type_enum" NOT NULL, "original_filename" character varying(255) NOT NULL, "stored_path" character varying(512) NOT NULL, "mime_type" character varying(150) NOT NULL, "size_bytes" bigint NOT NULL, "uploaded_by_user_id" uuid, CONSTRAINT "PK_083843297d525d3287b9477548a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "case_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "case_id" uuid NOT NULL, "case_status_id" uuid NOT NULL, "changed_by_user_id" uuid, "note" text, CONSTRAINT "PK_c24330886e348483361ab1edf3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "invoice_line_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invoice_id" uuid NOT NULL, "description" character varying(255) NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_price" numeric(10,2) NOT NULL, "total" numeric(10,2) NOT NULL, CONSTRAINT "PK_4e8ccaadaf5d0619db9d219b061" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'issued', 'paid', 'cancelled', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "number" character varying(40) NOT NULL, "dentist_id" uuid NOT NULL, "case_id" uuid, "issue_date" date NOT NULL DEFAULT ('now'::text)::date, "due_date" date, "subtotal" numeric(10,2) NOT NULL DEFAULT '0', "tax" numeric(10,2) NOT NULL DEFAULT '0', "total" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'draft', "pdf_path" character varying(512), "stripe_payment_intent_id" character varying(255), "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6b20aa66f2a835a4f2fbde4872" ON "invoices" ("number") `);
        await queryRunner.query(`CREATE TABLE "cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "reference" character varying(40) NOT NULL, "dentist_id" uuid NOT NULL, "case_type_id" uuid NOT NULL, "patient_reference" character varying(120) NOT NULL, "tooth_region" character varying(120), "material" character varying(120), "shade" character varying(60), "deadline" date, "clinical_notes" text, "current_status_id" uuid NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_264acb3048c240fb89aa34626db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_54644dc5f4b6350d047ab0ce40" ON "cases" ("reference") `);
        await queryRunner.query(`CREATE TABLE "monthly_statements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "dentist_id" uuid NOT NULL, "period_year" integer NOT NULL, "period_month" integer NOT NULL, "opening_balance" numeric(10,2) NOT NULL DEFAULT '0', "closing_balance" numeric(10,2) NOT NULL DEFAULT '0', "total_invoiced" numeric(10,2) NOT NULL DEFAULT '0', "total_paid" numeric(10,2) NOT NULL DEFAULT '0', "pdf_path" character varying(512), "sent_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0f4ddc577fd8cb53f90f2793571" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ef92fcc30a9b6b349f0774398f" ON "monthly_statements" ("dentist_id", "period_year", "period_month") `);
        await queryRunner.query(`CREATE TABLE "dentists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "clinic_name" character varying(255), "clinic_address" text, "billing_address" text, "tier" character varying(60), "notes" text, CONSTRAINT "REL_4efa9779d3ca98711c37ed7c2c" UNIQUE ("user_id"), CONSTRAINT "PK_ae1fbd6ec33d24fc0939c23325d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('dentist_invitation', 'password_reset', 'case_submitted', 'case_status_changed', 'invoice_issued', 'payment_received', 'statement_ready', 'admin_broadcast')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_channel_enum" AS ENUM('email', 'in_app')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_status_enum" AS ENUM('pending', 'sent', 'failed', 'read')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "subject" character varying(255) NOT NULL, "body" text NOT NULL, "channel" "public"."notifications_channel_enum" NOT NULL, "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'pending', "related_case_id" uuid, "related_invoice_id" uuid, "sent_at" TIMESTAMP WITH TIME ZONE, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_148ee02399918b869f27b9673e" ON "notifications" ("user_id", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('dentist', 'admin', 'super_admin')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'disabled', 'invited')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" character varying(255) NOT NULL, "password_hash" character varying(255), "role" "public"."users_role_enum" NOT NULL DEFAULT 'dentist', "first_name" character varying(120) NOT NULL, "last_name" character varying(120) NOT NULL, "phone" character varying(40), "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "last_login_at" TIMESTAMP WITH TIME ZONE, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "password_reset_token_hash" character varying(128), "password_reset_expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "pricing_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "case_type_id" uuid NOT NULL, "dentist_tier" character varying(60), "material" character varying(120), "price" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "effective_from" date NOT NULL DEFAULT ('now'::text)::date, "effective_to" date, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fda27bb8db4630894decda61ff6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "subject" character varying(255) NOT NULL, "message" text NOT NULL, "ip_address" character varying(64), "is_handled" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "action" character varying(120) NOT NULL, "entity_type" character varying(120) NOT NULL, "entity_id" uuid, "metadata" jsonb, "ip_address" character varying(64), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`CREATE TABLE "platform_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(160) NOT NULL, "value" text, "is_secret" boolean NOT NULL DEFAULT false, "updated_by_user_id" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2934aeb70ec285196dcab4a2e96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5d9031e30fac3ec3ec8b9602e1" ON "platform_settings" ("key") `);
        await queryRunner.query(`ALTER TABLE "case_files" ADD CONSTRAINT "FK_3807f4ad71de54ac07d3440acb4" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "case_files" ADD CONSTRAINT "FK_719e1f4a91bcb6d3077c7ee45a1" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "case_status_history" ADD CONSTRAINT "FK_a1ad94445aec272d3de3235feb4" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "case_status_history" ADD CONSTRAINT "FK_8b7b909913ec9048e8eda9e453d" FOREIGN KEY ("case_status_id") REFERENCES "case_statuses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "case_status_history" ADD CONSTRAINT "FK_111522f868eea0855cbb42aa951" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_line_items" ADD CONSTRAINT "FK_e554609a06b180dac66a9a977c5" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_376055a579f767fd39279b23111" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_b1d271efcbf097c3fec7196dc50" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cases" ADD CONSTRAINT "FK_5d9a4de914d2ea2c64704b3c6ff" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cases" ADD CONSTRAINT "FK_a1b3ddae67d91f69067ccee7446" FOREIGN KEY ("case_type_id") REFERENCES "case_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cases" ADD CONSTRAINT "FK_7f179b770f6ea9fc53fab8ba69d" FOREIGN KEY ("current_status_id") REFERENCES "case_statuses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monthly_statements" ADD CONSTRAINT "FK_a9dbfae5a84f0a492a1ade1c27c" FOREIGN KEY ("dentist_id") REFERENCES "dentists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dentists" ADD CONSTRAINT "FK_4efa9779d3ca98711c37ed7c2c8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pricing_rules" ADD CONSTRAINT "FK_2a9670b46c22184f739ca14de25" FOREIGN KEY ("case_type_id") REFERENCES "case_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pricing_rules" DROP CONSTRAINT "FK_2a9670b46c22184f739ca14de25"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "dentists" DROP CONSTRAINT "FK_4efa9779d3ca98711c37ed7c2c8"`);
        await queryRunner.query(`ALTER TABLE "monthly_statements" DROP CONSTRAINT "FK_a9dbfae5a84f0a492a1ade1c27c"`);
        await queryRunner.query(`ALTER TABLE "cases" DROP CONSTRAINT "FK_7f179b770f6ea9fc53fab8ba69d"`);
        await queryRunner.query(`ALTER TABLE "cases" DROP CONSTRAINT "FK_a1b3ddae67d91f69067ccee7446"`);
        await queryRunner.query(`ALTER TABLE "cases" DROP CONSTRAINT "FK_5d9a4de914d2ea2c64704b3c6ff"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_b1d271efcbf097c3fec7196dc50"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_376055a579f767fd39279b23111"`);
        await queryRunner.query(`ALTER TABLE "invoice_line_items" DROP CONSTRAINT "FK_e554609a06b180dac66a9a977c5"`);
        await queryRunner.query(`ALTER TABLE "case_status_history" DROP CONSTRAINT "FK_111522f868eea0855cbb42aa951"`);
        await queryRunner.query(`ALTER TABLE "case_status_history" DROP CONSTRAINT "FK_8b7b909913ec9048e8eda9e453d"`);
        await queryRunner.query(`ALTER TABLE "case_status_history" DROP CONSTRAINT "FK_a1ad94445aec272d3de3235feb4"`);
        await queryRunner.query(`ALTER TABLE "case_files" DROP CONSTRAINT "FK_719e1f4a91bcb6d3077c7ee45a1"`);
        await queryRunner.query(`ALTER TABLE "case_files" DROP CONSTRAINT "FK_3807f4ad71de54ac07d3440acb4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5d9031e30fac3ec3ec8b9602e1"`);
        await queryRunner.query(`DROP TABLE "platform_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TABLE "contact_messages"`);
        await queryRunner.query(`DROP TABLE "pricing_rules"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_148ee02399918b869f27b9673e"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "dentists"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef92fcc30a9b6b349f0774398f"`);
        await queryRunner.query(`DROP TABLE "monthly_statements"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_54644dc5f4b6350d047ab0ce40"`);
        await queryRunner.query(`DROP TABLE "cases"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b20aa66f2a835a4f2fbde4872"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
        await queryRunner.query(`DROP TABLE "invoice_line_items"`);
        await queryRunner.query(`DROP TABLE "case_status_history"`);
        await queryRunner.query(`DROP TABLE "case_files"`);
        await queryRunner.query(`DROP TYPE "public"."case_files_file_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eed94a4f0984649f625a0498cd"`);
        await queryRunner.query(`DROP TABLE "case_statuses"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5fae3a8b17ecde710acea958f5"`);
        await queryRunner.query(`DROP TABLE "case_types"`);
    }

}
