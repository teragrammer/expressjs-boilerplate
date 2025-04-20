import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('roles', table => {
        table.increments('id').primary();

        table.string('name', 100).notNullable();
        table.string('slug', 100).unique().notNullable();
        table.text('description', 'tinytext').nullable();
        table.boolean('is_public').notNullable().defaultTo(0);

        table.dateTime('created_at').nullable();
        table.dateTime('updated_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('roles');
}

