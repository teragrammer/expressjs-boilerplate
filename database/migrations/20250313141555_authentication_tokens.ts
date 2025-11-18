import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("authentication_tokens", table => {
        table.increments("id").primary();

        table.integer("user_id").unsigned().index().nullable();
        table.foreign("user_id")
            .references("users.id")
            .onUpdate("CASCADE")
            .onDelete("CASCADE");

        // meta data
        table.string("ip", 100).nullable();
        table.string("browser", 100).nullable();
        table.string("os", 100).nullable();

        table.dateTime("created_at").index().defaultTo(knex.fn.now()).nullable();
        table.dateTime("updated_at").defaultTo(knex.fn.now()).nullable();
        table.dateTime("expired_at").index().nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("authentication_tokens");
}

