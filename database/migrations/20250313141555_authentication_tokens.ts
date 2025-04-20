import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('authentication_tokens', table => {
        table.increments('id').primary();

        table.integer('user_id').unsigned().nullable();
        table.foreign('user_id')
            .references('users.id')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');

        table.string('token', 180).unique().notNullable();

        // two-factor authentication requirement
        table.boolean('is_tfa_required').defaultTo(0).notNullable();
        table.boolean('is_tfa_verified').defaultTo(0).notNullable();

        table.dateTime('created_at').nullable();
        table.dateTime('updated_at').nullable();
        table.dateTime('expired_at').nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('authentication_tokens');
}

