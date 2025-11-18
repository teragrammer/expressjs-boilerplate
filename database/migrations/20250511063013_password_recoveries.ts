import type {Knex} from "knex";
import {TYPES} from "../../src/models/password-recovery.model";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('password_recoveries', table => {
        table.increments('id').primary();

        table.enum('type', TYPES).defaultTo(TYPES[0]).notNullable();
        table.string('send_to', 100).index().unique().notNullable();
        table.string('code', 100).notNullable();

        table.dateTime('next_resend_at').index().notNullable();
        table.dateTime('expired_at').index().notNullable();

        table.integer('tries').defaultTo(0).notNullable();
        table.dateTime('next_try_at').index().nullable();

        table.dateTime('created_at').index().defaultTo(knex.fn.now()).nullable();
        table.dateTime('updated_at').defaultTo(knex.fn.now()).nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('password_recoveries');
}

