"""
Database trigger installation and removal
"""

from sqlalchemy import DDL


def install_in_place_timestamp_triggers(engine):
    """
    Install update_time propagation triggers for history table
    """
    statements = get_in_place_timestamp_install_sql(engine.name)
    execute_statements(engine, statements)


def drop_in_place_timestamp_triggers(engine):
    """
    Remove update_time propagation triggers for history table
    """
    statements = get_timestamp_drop_sql(engine.name)
    execute_statements(engine, statements)


def install_history_audit_triggers(engine):
    statements = get_timestamp_audit_install_sql(engine.name)
    execute_statements(engine, statements)


def drop_history_audit_triggers(engine):
    """
    Remove update_time propagation triggers for history table
    """
    statements = get_timestamp_audit_drop_sql(engine.name)
    execute_statements(engine, statements)


def execute_statements(engine, statements):
    for sql in statements:
        cmd = DDL(sql)
        cmd.execute(bind=engine)


def get_in_place_timestamp_install_sql(variant):
    """
    Generate a list of SQL statements for installation of timestamp triggers
    """

    sql = get_timestamp_drop_sql(variant)

    if 'postgres' in variant:
        # PostgreSQL has a separate function definition and a trigger
        # assignment. The first two statements the functions, and
        # the later assign those functions to triggers on tables

        fn_name = 'update_history_update_time'
        sql.append(build_pg_timestamp_fn(fn_name, 'history', source_key='history_id'))
        sql.append(build_pg_trigger('history_dataset_association', fn_name))
        sql.append(build_pg_trigger('history_dataset_collection_association', fn_name))

    else:
        # Other database variants are more granular. Requiring separate
        # statements for INSERT/UPDATE/DELETE, and the body of the trigger
        # is not necessarily reusable with a function

        for operation in ['INSERT', 'UPDATE', 'DELETE']:

            # change hda -> update history
            sql.append(build_timestamp_trigger(
                operation,
                'history_dataset_association',
                'history',
                source_key='history_id'
            ))

            # change hdca -> update history
            sql.append(build_timestamp_trigger(
                operation,
                'history_dataset_collection_association',
                'history',
                source_key='history_id'
            ))

    return sql


def get_timestamp_audit_drop_sql(variant):
    sql = []
    if 'postgres' in variant:
        sql.append('DROP FUNCTION IF EXISTS update_history_audit_table_from_history_contents() CASCADE;')
    return sql


def get_timestamp_audit_install_sql(variant):
    sql = get_timestamp_audit_drop_sql(variant)
    if 'postgres' in variant:
        history_contents_fn_name = 'update_history_audit_table_from_history_contents'
        sql.append(build_pg_history_audit_fn(history_contents_fn_name))
        sql.append(build_pg_statement_trigger('history_dataset_association', history_contents_fn_name))
        sql.append(build_pg_statement_trigger('history_dataset_collection_association', history_contents_fn_name))
        # If we want to drop history.update_time we'd need to build these triggers as well
        # history_fn_name = 'update_history_audit_table_from_history'
        # sql.append(build_pg_statement_trigger('history', history_fn_name))
    return sql


def build_pg_history_audit_fn(fn_name, history_id_literal="history_id"):
    return f"""
CREATE OR REPLACE FUNCTION {fn_name}() RETURNS TRIGGER AS $history_audit$
    BEGIN
        INSERT INTO history_audit (history_id, update_time)
            SELECT n.{history_id_literal}, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') FROM new_table n;
        RETURN NULL;
    END;
$history_audit$ LANGUAGE plpgsql;
    """


def get_timestamp_drop_sql(variant):
    """
    Generate a list of statements to drop the timestamp update triggers
    """

    sql = []

    if 'postgres' in variant:
        sql.append("DROP FUNCTION IF EXISTS update_history_update_time() CASCADE;")
    else:
        for operation in ['INSERT', 'UPDATE', 'DELETE']:
            for when in ['BEFORE', 'AFTER']:
                sql.append(build_drop_trigger(operation, 'history_dataset_association', when))
                sql.append(build_drop_trigger(operation, 'history_dataset_collection_association', when))

    return sql


def build_pg_timestamp_fn(fn_name, target_table, source_key, target_key='id'):
    """Generates a PostgreSQL history update timestamp function"""

    return f"""
        CREATE OR REPLACE FUNCTION {fn_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
        AS $BODY$
            BEGIN
                IF (TG_OP = 'DELETE') THEN
                    UPDATE {target_table}
                    SET update_time = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                    WHERE {target_key} = OLD.{source_key};
                    RETURN OLD;
                ELSEIF (TG_OP = 'UPDATE') THEN
                    UPDATE {target_table}
                    SET update_time = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                    WHERE {target_key} = NEW.{source_key} OR {target_key} = OLD.{source_key};
                    RETURN NEW;
                ELSIF (TG_OP = 'INSERT') THEN
                    UPDATE {target_table}
                    SET update_time = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                    WHERE {target_key} = NEW.{source_key};
                    RETURN NEW;
                END IF;
            END;
        $BODY$;
    """


def build_pg_trigger(source_table, fn_name, when='AFTER'):
    """Assigns a PostgreSQL trigger to indicated table, calling user-defined function"""
    when_initial = when.lower()[0]
    trigger_name = f"trigger_{source_table}_{when_initial}iudr"
    return f"""
        CREATE TRIGGER {trigger_name}
            {when} INSERT OR DELETE OR UPDATE
            ON {source_table}
            FOR EACH ROW
            EXECUTE PROCEDURE {fn_name}();
    """


def build_pg_statement_trigger(source_table, fn_name, when='AFTER'):
    when_initial = when.lower()[0]
    trigger_name = f"trigger_{source_table}_{when_initial}_ur"
    return f"""
CREATE TRIGGER {trigger_name}
    {when} UPDATE ON {source_table}
    REFERENCING NEW TABLE AS new_table
    FOR EACH STATEMENT EXECUTE FUNCTION {fn_name}();
    """


def build_timestamp_trigger(operation, source_table, target_table, source_key, target_key='id', when='AFTER'):
    """Creates a non-PostgreSQL update_time trigger"""

    trigger_name = get_trigger_name(operation, source_table, when)

    # three different update clauses depending on update/insert/delete
    clause = ""
    if operation == "DELETE":
        clause = f"{target_key} = OLD.{source_key}"
    elif operation == "UPDATE":
        clause = f"{target_key} = NEW.{source_key} OR {target_key} = OLD.{source_key}"
    else:
        clause = f"{target_key} = NEW.{source_key}"

    return f"""
        CREATE TRIGGER {trigger_name}
            {when} {operation}
            ON {source_table}
            FOR EACH ROW
            BEGIN
                UPDATE {target_table}
                SET update_time = CURRENT_TIMESTAMP
                WHERE {clause};
            END;
    """


def build_drop_trigger(operation, source_table, when='AFTER'):
    """Drops a non-PostgreSQL trigger by name"""
    trigger_name = get_trigger_name(operation, source_table, when)
    return f"DROP TRIGGER IF EXISTS {trigger_name}"


def get_trigger_name(operation, source_table, when):
    """Non-PostgreSQL trigger name"""
    op_initial = operation.lower()[0]
    when_initial = when.lower()[0]
    return f"trigger_{source_table}_{when_initial}{op_initial}r"
