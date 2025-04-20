import type {Knex} from "knex";
import {DATA_TYPES} from "../../src/models/setting.model";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('settings', table => {
        table.increments('id').primary();

        table.string('name', 100).unique().notNullable();
        table.string('slug', 100).unique().notNullable();
        table.text('value').nullable();
        table.text('description', 'tinytext').nullable();
        table.enum('type', DATA_TYPES).defaultTo('string');

        table.boolean('is_disabled').notNullable().defaultTo(0);
        table.boolean('is_public').notNullable().defaultTo(1);

        table.dateTime('created_at').nullable();
        table.dateTime('updated_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('settings');
}

