import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('two_factor_authentications', table => {
        table.increments('id').primary();

        table.integer('token_id').unsigned().nullable().unique();
        table.foreign('token_id')
            .references('authentication_tokens.id')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');

        table.string('code', 100).notNullable();
        table.integer('tries', 10).defaultTo(0).notNullable();

        table.dateTime('next_send_at').nullable();
        table.dateTime('expired_tries_at').nullable();

        table.dateTime('created_at').nullable();
        table.dateTime('updated_at').nullable();
        table.dateTime('expired_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('two_factor_authentications');
}

