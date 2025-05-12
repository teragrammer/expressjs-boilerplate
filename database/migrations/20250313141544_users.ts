import type { Knex } from "knex";
import {GENDERS, STATUSES} from "../../src/models/user.model";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('users', table => {
        table.increments('id').primary();

        table.string('first_name', 100).nullable();
        table.string('middle_name', 100).nullable();
        table.string('last_name', 100).nullable();
        table.enum('gender', GENDERS).nullable();

        table.text('address', 'tinytext').nullable();
        table.string('phone', 22).unique().nullable();
        table.boolean('is_phone_verified').defaultTo(0).notNullable();
        table.string('email', 180).unique().nullable();
        table.boolean('is_email_verified').defaultTo(0).notNullable();

        // user type
        table.integer('role_id').unsigned().notNullable();
        table.foreign('role_id')
            .references('roles.id')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');

        table.string('username', 16).unique().nullable();
        table.text('password', 'tinytext').nullable();
        table.enum('status', STATUSES).defaultTo('Activated');

        table.integer('login_tries', 2).defaultTo(0);
        table.dateTime('failed_login_expired_at').nullable();

        table.text('comments', 'tinytext').nullable();

        table.dateTime('created_at').nullable();
        table.dateTime('updated_at').nullable();
        table.dateTime('deleted_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('users');
}

